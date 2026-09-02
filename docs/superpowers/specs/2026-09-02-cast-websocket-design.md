# 投屏改用 WebSocket 推送设计

日期：2026-09-02

## 背景

当前投屏是「Upstash 信箱 + 电视轮询」：手机 POST 命令写入 Redis（key `kvideo:cast:${profileId}`，TTL 120 秒），电视端 `TvCastReceiver` 每 5 秒 GET 一次。

两个问题：

1. **延迟最差 5 秒。**
2. **配额风险。** Upstash 免费版每月 50 万条命令。电视亮屏时每 5 秒一次 = 每天 17,280 条，整月常开约 51.8 万条，**正好超**。按每天开 8 小时算约 17 万条则安全。配额耗尽后投屏会直接失效，且没有任何提示。

## 目标

命令即时送达；去掉 Upstash 这个依赖和它的配额风险。

## 非目标

- 不支持反向推送（电视→手机），用户已明确不需要
- 不改 `android-tv/` 原生代码
- 不改手机端和桌面端的既有样式

## 平台事实（均已查证）

- Next.js edge 路由在 next-on-pages 上**可以**完成 WebSocket 升级；官方维护者有可用示例，需要对 `accept()` 做类型断言。
- Pages 的请求可能落在不同 Worker 实例上，实例间不共享内存，因此**两个客户端之间的中转必须由 Durable Object 持有**。
- **不能在 Pages 项目内定义或部署 Durable Object**，只能单独部署一个 Worker，再从 Pages 绑定。
- 免费版可用 DO，**仅限 SQLite 存储后端**。
- 仓库已有 `getOptionalRequestContext().env` 的绑定读取方式（`lib/server/runtime-env.ts`），DO 绑定可直接沿用。
- 会话认证是 cookie（`kvideo_session`）+ JWT 校验。

## 架构

```
手机  ──POST /api/cast────────────┐
                                  │  (Pages 认证 → 取 profileId)
                                  ▼
                          env.CAST.idFromName(profileId)
                                  │
                                  ▼
                            Durable Object
                                  │  WS push
                                  ▼
电视  ──GET /api/cast/socket──────┘   (101 升级，同样先经 Pages 认证)
```

### 决策一：两端都只连 Pages 域名

认证靠 cookie，而 cookie 只会发往同源。因此电视的 WebSocket 和手机的 POST 都打到 Pages 域名，由 Pages 路由完成认证、取出 `profileId`，再通过**绑定**转发给 DO：

```ts
const stub = env.CAST.get(env.CAST.idFromName(session.profileId));
return stub.fetch(request);   // 升级请求原样转交
```

DO Worker 因此不需要自己实现认证，也**不应该对外可达**——部署时关掉它的 workers.dev 路由，只留绑定这一条入口。`profileId` 一律由服务端会话解出，绝不采信客户端传来的值。

### 决策二：只有电视持长连接

手机是普通 POST，用完即走。理由：手机端投屏是一次性动作，为它维持长连接没有收益，反而要处理移动网络下的重连和后台挂起。

### 决策三：用 Hibernation API

电视可能连着好几个小时不动。用 `ctx.acceptWebSocket(server)` 而不是 `server.accept()`，空闲时 DO 可以从内存驱逐而连接不断，**休眠期间不计费**。ping/pong 保活由运行时自动处理，不会唤醒 DO。

```ts
export class CastRoom extends DurableObject {
  async fetch(request: Request) {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  // 手机的命令走普通 HTTP 进来，广播给所有已连接的电视
  async broadcast(command: unknown) {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) ws.send(JSON.stringify({ type: 'cast', command }));
    return sockets.length;
  }
}
```

### 决策四：不做补投，改为明确告知

当前 Redis 信箱有 120 秒 TTL，电视上线后可能拿到一条「旧」命令——现有代码专门用 `hasPolledOnceRef` 忽略首次轮询拿到的内容来绕开这个问题。

改成纯推送后这类问题整体消失：**电视只会收到它在线期间到达的命令**。若投屏时电视没连上，POST 返回送达数 0，手机直接显示「电视未连接」。

这比现在「静默塞进信箱、可能 120 秒后才播、也可能永远不播」更好——用户当场就知道结果。代价是关掉电视再投屏不会被记住，但那本来也不是这个功能要解决的场景。

### 决策五：绑定缺失时回退到轮询

`/api/cast/socket` 在读不到 `env.CAST` 时返回 503。电视端收到 503 就**沿用现有的 5 秒轮询**。

这一条是为了让上线可以分两步走：先部署 Pages（此时没有绑定，行为与今天完全一致），再部署 DO Worker 并加绑定，电视自动切到 WebSocket。任何一步出问题都能退回可用状态，不需要同时改两处。

### 决策六：重连策略

指数退避，上限 30 秒；`visibilitychange` 回到可见时立即重连一次。电视 WebView 息屏或切走再回来是常态，不能靠一次连接活一整天。

## 消息格式

电视只需要认一种：

```json
{ "type": "cast", "command": { ...与现有 normalizeCastCommand 校验后的结构一致... } }
```

命令结构不变，`normalizeCastCommand` 原样复用——手机端和电视端的解析逻辑都不用动。

## 文件

| 文件 | 职责 |
|---|---|
| `workers/cast-room/src/index.ts` | 新 Worker，导出 `CastRoom` DO 类 |
| `workers/cast-room/wrangler.toml` | 该 Worker 的部署配置 |
| `app/api/cast/socket/route.ts` | 认证 + 转发 WS 升级给 DO |
| `app/api/cast/route.ts` | POST 改为写 DO（绑定缺失时仍写 Redis） |
| `components/tv/TvCastReceiver.tsx` | 优先 WS，503 时回退轮询 |
| `wrangler.toml` | 加 DO 绑定声明 |

## 风险

| 风险 | 应对 |
|---|---|
| **本地开发跑不通 WS** —— next-on-pages 维护者实测本地不工作 | 用 preview 部署验证；本地只验回退路径 |
| 部署件从 1 个变成 2 个 | 决策五让两者解耦，Worker 没部署也不影响现状 |
| DO Worker 若对外可达则绕过认证 | 关闭 workers.dev 路由，只留绑定入口 |
| 电视 WebView 太旧不支持 WS | Android WebView 4.4 起支持；且回退路径仍在 |
| 连接被中间设备掐断 | Hibernation 自带 ping/pong 保活 + 指数退避重连 |

## 验证计划

1. 单元测试：命令校验与 DO 广播返回的送达数
2. preview 部署上真机验证：手机投屏 → 电视立即起播（对比现在最差 5 秒）
3. 电视未连接时手机显示「电视未连接」
4. 拔掉绑定，确认自动退回 5 秒轮询且行为与今天一致

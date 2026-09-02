# kvideo-cast-room

手机→电视投屏的中转 Durable Object。

## 为什么是独立的一个 Worker

Cloudflare **不允许在 Pages 项目里定义 Durable Object**，只能部署成独立 Worker 再由 Pages 绑定。
它也保持成独立的 npm 包，因为 `@cloudflare/workers-types` 会全局改写 `Request.json()` 等类型，
装进主项目会让 Next.js 的类型检查报一堆错。

## 部署

```bash
cd workers/cast-room
npm install
npx wrangler deploy
```

然后在 Cloudflare 控制台给 Pages 项目加绑定（根 `wrangler.toml` 已声明，控制台里也要确认）：

- 变量名 `CAST_ROOM`
- 类名 `CastRoom`
- Worker `kvideo-cast-room`

## 安全

这个 Worker **自己不做任何认证**——认证由它前面的 Pages 路由完成，`profileId` 由服务端会话解出。
因此 `workers_dev = false` 必须保持关闭，否则就等于对外暴露了一个无认证的中转。

## 部署顺序

可以分两步，互不阻塞：

1. 先发 Pages。此时没有绑定，`/api/cast/socket` 返回 503，电视自动沿用 5 秒轮询，行为和今天完全一样。
2. 再发这个 Worker 并加绑定。电视下次连接时自动切到 WebSocket 推送。

任何一步出问题都能停在上一步，不需要两边同时改。

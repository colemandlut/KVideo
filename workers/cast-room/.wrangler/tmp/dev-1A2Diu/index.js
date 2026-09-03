var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { DurableObject } from "cloudflare:workers";
function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - padded.length % 4) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
__name(base64UrlToBytes, "base64UrlToBytes");
async function verifyTicket(ticket, secret) {
  const [encoded, signature] = ticket.split(".");
  if (!encoded || !signature) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  let valid;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(encoded)
    );
  } catch {
    return null;
  }
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded)));
    if (typeof payload.profileId !== "string" || !payload.profileId) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload.profileId;
  } catch {
    return null;
  }
}
__name(verifyTicket, "verifyTicket");
var CastRoom = class extends DurableObject {
  static {
    __name(this, "CastRoom");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/socket")) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket upgrade", { status: 426 });
      }
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname.endsWith("/broadcast") && request.method === "POST") {
      const command = await request.json();
      const sockets = this.ctx.getWebSockets();
      const payload = JSON.stringify({ type: "cast", command });
      let delivered = 0;
      for (const ws of sockets) {
        try {
          ws.send(payload);
          delivered += 1;
        } catch {
        }
      }
      return Response.json({ delivered });
    }
    return new Response("Not found", { status: 404 });
  }
  /**
   * The TV never sends anything but keepalives, and those are answered by the
   * auto-response pair without reaching this handler. Anything else is ignored
   * rather than trusted - this relay only ever pushes downward.
   */
  async webSocketMessage() {
  }
  async webSocketClose(ws, code, reason) {
    if (code === 1006) return;
    try {
      ws.close(code, reason);
    } catch {
    }
  }
};
var src_default = {
  /**
   * Public entry point. Only /socket is exposed, and only to a caller holding
   * a valid unexpired ticket. The phone's commands do not come through here -
   * they arrive over the Pages binding, which is already authenticated.
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/socket") {
      return new Response("Not found", { status: 404 });
    }
    if (!env.CAST_TICKET_SECRET) {
      return new Response("Relay is not configured", { status: 503 });
    }
    const ticket = url.searchParams.get("ticket");
    if (!ticket) {
      return new Response("Missing ticket", { status: 401 });
    }
    const profileId = await verifyTicket(ticket, env.CAST_TICKET_SECRET);
    if (!profileId) {
      return new Response("Invalid or expired ticket", { status: 401 });
    }
    const stub = env.CAST_ROOM.get(env.CAST_ROOM.idFromName(profileId));
    return stub.fetch(request);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-4Swk16/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-4Swk16/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  CastRoom,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map

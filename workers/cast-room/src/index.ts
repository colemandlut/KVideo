/**
 * Cast relay Durable Object.
 *
 * The TV holds one WebSocket per profile; the phone POSTs a command over plain
 * HTTP. A Durable Object is what makes that possible at all: Pages spreads
 * requests across Worker isolates that share no memory, so the socket the TV
 * opened is not reachable from the isolate handling the phone's POST. Routing
 * both through `idFromName(profileId)` puts them in the same instance.
 *
 * This Worker must NOT be publicly routable. It performs no authentication of
 * its own - the Pages function in front of it verifies the session cookie and
 * derives `profileId` server-side, then forwards here over a binding. Leaving
 * a workers.dev route enabled would expose an unauthenticated relay.
 */
import { DurableObject } from 'cloudflare:workers';

interface Env {
  CAST_ROOM: DurableObjectNamespace;
}

export class CastRoom extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Answer app-level keepalives in the runtime, without waking the object.
    // A TV can sit connected for hours; every wake-up it avoids is duration
    // it is not billed for.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // endsWith, not equality: the upgrade arrives as the caller's own request
    // object (see app/api/cast/socket/route.ts for why it cannot be rewritten),
    // so the path here is the site's /api/cast/socket.
    if (url.pathname.endsWith('/socket')) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected websocket upgrade', { status: 426 });
      }

      const [client, server] = Object.values(new WebSocketPair());

      // acceptWebSocket, not server.accept(): this is what lets the object be
      // evicted from memory while the connection stays open. An idle TV then
      // costs nothing.
      this.ctx.acceptWebSocket(server);

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const command = await request.json();
      const sockets = this.ctx.getWebSockets();
      const payload = JSON.stringify({ type: 'cast', command });

      let delivered = 0;
      for (const ws of sockets) {
        try {
          ws.send(payload);
          delivered += 1;
        } catch {
          // A socket that died without a close event would otherwise abort the
          // whole broadcast and hide the fact that other TVs did receive it.
        }
      }

      return Response.json({ delivered });
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * The TV never sends anything but keepalives, and those are answered by the
   * auto-response pair above without reaching this handler. Anything else is
   * ignored rather than trusted - this relay only ever pushes downward.
   */
  async webSocketMessage(): Promise<void> {
    // Intentionally empty.
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    // 1006 is "abnormal closure" and is not a valid code to send back; the
    // socket is already gone in that case, so closing it would throw.
    if (code === 1006) return;
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
  }
}

/**
 * The DO class needs a host Worker, but nothing should reach it directly.
 */
export default {
  async fetch(): Promise<Response> {
    return new Response('Not found', { status: 404 });
  },
};

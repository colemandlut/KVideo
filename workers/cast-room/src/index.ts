/**
 * Cast relay Durable Object, plus the public entry point the TV connects to.
 *
 * The TV holds one WebSocket per profile; the phone POSTs a command over plain
 * HTTP through the Pages app, which reaches this same object over a binding. A
 * Durable Object is what makes the two sides reachable from each other at all:
 * Pages spreads requests across isolates that share no memory, so the socket
 * the TV opened is invisible to the isolate handling the phone's POST. Routing
 * both through `idFromName(profileId)` puts them in one instance.
 *
 * The socket cannot be served from the Pages app itself. next-on-pages cannot
 * return a 101 upgrade from a Next route handler - the runtime rejects it with
 * "Web Socket request did not return status 101 Switching Protocols response
 * with Web Socket" and the request hangs - and that adapter is deprecated and
 * unsupported on the app's Next version. So this Worker is publicly reachable
 * and authenticates the TV itself, using a short-lived ticket that the Pages
 * app signs after checking the session cookie.
 */
import { DurableObject } from 'cloudflare:workers';

const MAX_NAME_LENGTH = 40;
const DEFAULT_TV_NAME = '电视';

interface SocketInfo {
  id: string;
  name: string;
}

/**
 * A socket that predates attachments, or whose attachment failed to
 * deserialize, still has to appear in the list - otherwise a TV would be
 * invisible to the phone and simply unreachable.
 */
function readSocketInfo(ws: WebSocket): SocketInfo {
  const raw = ws.deserializeAttachment() as Partial<SocketInfo> | null;
  return {
    id: typeof raw?.id === 'string' ? raw.id : '',
    name: typeof raw?.name === 'string' && raw.name ? raw.name : DEFAULT_TV_NAME,
  };
}

interface Env {
  CAST_ROOM: DurableObjectNamespace;
  CAST_TICKET_SECRET: string;
}

interface TicketPayload {
  room: string;
  exp: number;
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Returns the room a ticket vouches for, or null.
 *
 * Verification is by recomputing the signature, so a forged or edited ticket
 * simply does not match. The room is read only after that check passes -
 * nothing a client sends is ever used to pick which room it lands in, which is
 * what keeps one household's TVs unreachable from another's phone.
 */
async function verifyTicket(ticket: string, secret: string): Promise<string | null> {
  const [encoded, signature] = ticket.split('.');
  if (!encoded || !signature) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(encoded),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded))) as TicketPayload;
    if (typeof payload.room !== 'string' || !payload.room) return null;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload.room;
  } catch {
    return null;
  }
}

export class CastRoom extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Answer app-level keepalives in the runtime, without waking the object.
    // A TV can sit connected for hours; every wake-up it avoids is duration it
    // is not billed for.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/socket')) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected websocket upgrade', { status: 426 });
      }

      const [client, server] = Object.values(new WebSocketPair());

      // acceptWebSocket, not server.accept(): this is what lets the object be
      // evicted from memory while the connection stays open, so an idle TV
      // costs nothing.
      this.ctx.acceptWebSocket(server);

      // Attached rather than held in a field: the object is evicted from memory
      // while sockets stay open, and an attachment is the only per-socket state
      // that survives that. A plain Map would come back empty and every TV
      // would lose its name the first time the room went idle.
      server.serializeAttachment({
        id: crypto.randomUUID(),
        name: (url.searchParams.get('name') || '').slice(0, MAX_NAME_LENGTH) || DEFAULT_TV_NAME,
      } satisfies SocketInfo);

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname.endsWith('/targets')) {
      return Response.json({
        targets: this.ctx.getWebSockets().map((ws) => readSocketInfo(ws)),
      });
    }

    if (url.pathname.endsWith('/broadcast') && request.method === 'POST') {
      const { command, targetId } = (await request.json()) as {
        command: unknown;
        targetId?: string;
      };

      // No target means every TV in the room, which is what a one-TV home wants
      // and what the phone sends when it did not need to ask.
      const sockets = this.ctx
        .getWebSockets()
        .filter((ws) => !targetId || readSocketInfo(ws).id === targetId);
      const payload = JSON.stringify({ type: 'cast', command });

      let delivered = 0;
      for (const ws of sockets) {
        try {
          ws.send(payload);
          delivered += 1;
        } catch {
          // A socket that died without a close event would otherwise abort the
          // whole broadcast and hide that other TVs did receive it.
        }
      }

      return Response.json({ delivered });
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * The TV never sends anything but keepalives, and those are answered by the
   * auto-response pair without reaching this handler. Anything else is ignored
   * rather than trusted - this relay only ever pushes downward.
   */
  async webSocketMessage(): Promise<void> {
    // Intentionally empty.
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    // 1006 is "abnormal closure" and is not a code that may be sent back; the
    // socket is already gone, so closing it would throw.
    if (code === 1006) return;
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
  }
}

export default {
  /**
   * Public entry point. Only /socket is exposed, and only to a caller holding
   * a valid unexpired ticket. The phone's commands do not come through here -
   * they arrive over the Pages binding, which is already authenticated.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== '/socket') {
      return new Response('Not found', { status: 404 });
    }

    if (!env.CAST_TICKET_SECRET) {
      return new Response('Relay is not configured', { status: 503 });
    }

    const ticket = url.searchParams.get('ticket');
    if (!ticket) {
      return new Response('Missing ticket', { status: 401 });
    }

    const room = await verifyTicket(ticket, env.CAST_TICKET_SECRET);
    if (!room) {
      return new Response('Invalid or expired ticket', { status: 401 });
    }

    const stub = env.CAST_ROOM.get(env.CAST_ROOM.idFromName(room));
    return stub.fetch(request);
  },
};

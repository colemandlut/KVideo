/**
 * Short-lived tickets that let the TV open its cast socket directly against
 * the relay Worker.
 *
 * Why a ticket at all: the socket cannot be served from this origin.
 * next-on-pages cannot return a 101 upgrade from a Next route handler - the
 * runtime reports "Web Socket request did not return status 101 Switching
 * Protocols response with Web Socket" and the request hangs - and the adapter
 * is deprecated and unsupported on this project's Next version, so that is not
 * going to change. The socket therefore has to terminate on the Worker's own
 * hostname, and a cookie cannot travel there because it is a different origin.
 *
 * So Pages authenticates as usual and mints a ticket the Worker can verify on
 * its own: the room key plus an expiry, signed with a secret both sides share.
 * The room is decided entirely on the Pages side and only read after the
 * signature checks out, so nothing a client sends chooses where it lands.
 */

const TICKET_TTL_MS = 60_000;

interface TicketPayload {
  /** Which room to join - see lib/server/cast-room-key.ts. */
  room: string;
  exp: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * `<base64url(payload)>.<base64url(hmac)>`. Deliberately not a JWT: there is
 * one issuer, one verifier and one algorithm here, and a hand-rolled header
 * would only add a place for an "alg: none" style mistake to hide.
 */
export async function createCastTicket(room: string, secret: string, now: number): Promise<string> {
  const payload: TicketPayload = { room, exp: now + TICKET_TTL_MS };
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encoded}.${await sign(encoded, secret)}`;
}

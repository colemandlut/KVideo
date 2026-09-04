import { getOptionalRequestContext } from '@cloudflare/next-on-pages';

/**
 * Minimal shape of the Durable Object binding this project uses. Typed here
 * rather than pulled from @cloudflare/workers-types so the Next.js build does
 * not need the full Workers global type set.
 */
interface CastRoomStub {
  fetch(request: Request): Promise<Response>;
}

interface CastRoomNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): CastRoomStub;
}

/**
 * The relay Durable Object for one room (account + network), or null when the
 * binding is not configured.
 *
 * Null is a normal, expected state, not an error: the Pages project can be
 * deployed before the cast Worker exists, and callers fall back to the Redis
 * mailbox in that case. That is what lets the two deployments be rolled out
 * independently instead of having to land together.
 */
export function getCastRoom(roomKey: string): CastRoomStub | null {
  try {
    const env = getOptionalRequestContext()?.env as unknown as
      | Record<string, unknown>
      | undefined;
    const namespace = env?.CAST_ROOM as CastRoomNamespace | undefined;

    if (!namespace || typeof namespace.idFromName !== 'function') {
      return null;
    }

    return namespace.get(namespace.idFromName(roomKey));
  } catch {
    // Outside Cloudflare's request runtime (local `next dev`, tests).
    return null;
  }
}

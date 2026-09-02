import { NextRequest, NextResponse } from 'next/server';
import { authenticationRequiredResponse } from '@/lib/server/api-responses';
import { getServerSession } from '@/lib/server/auth';
import { getCastRoom } from '@/lib/server/cast-room';

export const runtime = 'edge';

/**
 * WebSocket entry point for the TV.
 *
 * The upgrade has to be served from this origin rather than from the cast
 * Worker directly: the session lives in a cookie, and a cookie is only sent
 * same-origin. So authentication happens here, `profileId` is derived from the
 * verified session (never from anything the client sent), and only then is the
 * upgrade handed to the Durable Object for that profile.
 *
 * A 503 means the binding is absent - the TV falls back to polling, which is
 * how this can ship before the Worker is deployed.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const profileId = session?.profileId;

  if (!profileId) {
    return authenticationRequiredResponse();
  }

  const room = getCastRoom(profileId);
  if (!room) {
    return NextResponse.json(
      { error: 'Realtime cast is not configured on this deployment' },
      { status: 503 }
    );
  }

  // Deliberately last: the TV probes this route with a PLAIN GET to find out
  // which transport to use, and only a check that runs after the binding
  // lookup can answer that. Rejecting a missing upgrade header first would
  // return 426 even on a deployment with no relay bound, leaving the TV to
  // discover that by failing the handshake three times instead.
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return NextResponse.json({ error: 'Expected a websocket upgrade' }, { status: 426 });
  }

  // Forwarded as-is so the upgrade headers survive; the Durable Object returns
  // the 101 with the client half of the socket pair attached.
  return room.fetch(new Request('https://cast-room/socket', request));
}

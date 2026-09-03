import { NextRequest, NextResponse } from 'next/server';
import { authenticationRequiredResponse } from '@/lib/server/api-responses';
import { getServerSession } from '@/lib/server/auth';
import { createCastTicket } from '@/lib/server/cast-ticket';
import { getRuntimeEnvValue } from '@/lib/server/runtime-env';

export const runtime = 'edge';

/**
 * Hands the TV a signed, one-minute ticket and the address of the relay.
 *
 * The socket itself is not served from here - see lib/server/cast-ticket.ts
 * for why it cannot be. This endpoint is the authenticated half: the session
 * cookie is verified here, and `profileId` comes from that verified session,
 * never from the request.
 *
 * A 503 means the relay is not configured on this deployment, which is a
 * normal state rather than an error: the TV falls back to polling the mailbox,
 * exactly as it does today.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const profileId = session?.profileId;

  if (!profileId) {
    return authenticationRequiredResponse();
  }

  const secret = getRuntimeEnvValue('CAST_TICKET_SECRET');
  const host = getRuntimeEnvValue('CAST_WS_HOST');

  if (!secret || !host) {
    return NextResponse.json(
      { error: 'Realtime cast is not configured on this deployment' },
      { status: 503 }
    );
  }

  const ticket = await createCastTicket(profileId, secret, Date.now());

  return NextResponse.json(
    { url: `wss://${host}/socket`, ticket },
    // The ticket is per-request and expires in a minute; a cached copy handed
    // to a later reconnect would already be dead.
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

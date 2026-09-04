import { NextRequest, NextResponse } from 'next/server';
import { authenticationRequiredResponse } from '@/lib/server/api-responses';
import { getServerSession } from '@/lib/server/auth';
import { getCastRoom } from '@/lib/server/cast-room';
import { deriveCastRoomKey, readClientAddress } from '@/lib/server/cast-room-key';

export const runtime = 'edge';

/**
 * The TVs currently connected on the caller's own network.
 *
 * The phone asks for this before casting so it can offer a choice when a house
 * has more than one TV. An empty list is a normal answer - no TV is awake -
 * and the phone still posts the command, which falls through to the mailbox.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const profileId = session?.profileId;

  if (!profileId) {
    return authenticationRequiredResponse();
  }

  const roomKey = await deriveCastRoomKey(profileId, readClientAddress(request));
  const room = getCastRoom(roomKey);

  if (!room) {
    return NextResponse.json({ targets: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const response = await room.fetch(new Request('https://cast-room/targets'));
    const data = (await response.json()) as { targets?: unknown };
    const targets = Array.isArray(data.targets) ? data.targets : [];
    return NextResponse.json({ targets }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Cast targets error:', error);
    return NextResponse.json({ targets: [] }, { status: 500 });
  }
}

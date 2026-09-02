import { NextRequest, NextResponse } from 'next/server';
import { authenticationRequiredResponse } from '@/lib/server/api-responses';
import { getServerSession } from '@/lib/server/auth';
import { getCastRoom } from '@/lib/server/cast-room';
import { normalizeCastCommand } from '@/lib/server/cast-command';
import { getRedisClient } from '@/lib/server/redis';

// 确保这行代码在整个文件中只出现一次
export const runtime = 'edge';

const CAST_TTL_SECONDS = 120;

function castUnavailableResponse() {
  return NextResponse.json(
    { error: 'Server-side cast is not configured on this deployment' },
    { status: 503 }
  );
}

function castKey(profileId: string) {
  return `kvideo:cast:${profileId}`;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  const profileId = session?.profileId;

  if (!profileId) {
    return authenticationRequiredResponse();
  }

  const room = getCastRoom(profileId);
  const redis = getRedisClient();

  if (!room && !redis) {
    return castUnavailableResponse();
  }

  let command;
  try {
    command = normalizeCastCommand(await request.json(), Date.now());
  } catch {
    command = null;
  }

  if (!command) {
    return NextResponse.json(
      { error: 'Invalid cast payload: id, source and title are required' },
      { status: 400 }
    );
  }

  // Push first: a connected TV starts playing immediately instead of waiting
  // out a poll interval.
  let delivered = 0;
  if (room) {
    try {
      const response = await room.fetch(
        new Request('https://cast-room/broadcast', {
          method: 'POST',
          body: JSON.stringify(command),
          headers: { 'content-type': 'application/json' },
        })
      );
      const result = (await response.json()) as { delivered?: number };
      delivered = typeof result.delivered === 'number' ? result.delivered : 0;
    } catch (error) {
      console.error('Cast relay error:', error);
    }
  }

  // Nobody was listening on a socket. That does not mean nobody is listening:
  // a TV whose WebSocket failed to connect falls back to polling the mailbox,
  // and pushing into an empty room would drop the command on the floor for it.
  // So the mailbox is still written whenever the push reached no one - one
  // Redis write in the uncommon case, instead of one on every single poll.
  if (delivered === 0 && redis) {
    try {
      await redis.set(castKey(profileId), command, { ex: CAST_TTL_SECONDS });
    } catch (error) {
      console.error('Redis Cast Set Error:', error);
      return NextResponse.json({ error: 'Failed to save cast command' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, ts: command.ts, delivered });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const profileId = session?.profileId;

  if (!profileId) {
    return authenticationRequiredResponse();
  }

  const redis = getRedisClient();
  if (!redis) {
    return castUnavailableResponse();
  }

  try {
    const stored = await redis.get(castKey(profileId));
    const command = normalizeCastCommand(stored);

    if (stored && !command) {
      console.warn('Cast Get: stored value did not match the expected command shape');
    }

    return NextResponse.json({ success: true, command });
  } catch (error) {
    console.error('Redis Cast Get Error:', error);
    return NextResponse.json({ error: 'Failed to fetch cast command' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticationRequiredResponse } from '@/lib/server/api-responses';
import { getServerSession } from '@/lib/server/auth';
import { getRedisClient } from '@/lib/server/redis';

// 确保这行代码在整个文件中只出现一次
export const runtime = 'edge';

const MAX_TITLE_LENGTH = 300;
const CAST_TTL_SECONDS = 120;

interface CastCommand {
  id: string;
  source: string;
  title: string;
  episode: number;
  t: number;
  ts: number;
}

function castUnavailableResponse() {
  return NextResponse.json(
    { error: 'Server-side cast is not configured on this deployment' },
    { status: 503 }
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseCastBody(body: unknown): CastCommand | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const { id, source, title, episode, t } = body as Record<string, unknown>;

  if (
    (typeof id !== 'string' && typeof id !== 'number') ||
    (typeof id === 'string' && id.trim().length === 0)
  ) {
    return null;
  }
  if (!isNonEmptyString(source) || !isNonEmptyString(title)) {
    return null;
  }

  let episodeNum = 0;
  if (episode !== undefined && episode !== null) {
    episodeNum = Number(episode);
    if (!Number.isInteger(episodeNum) || episodeNum < 0) {
      return null;
    }
  }

  let tNum = 0;
  if (t !== undefined && t !== null) {
    tNum = Number(t);
    if (!Number.isFinite(tNum)) {
      return null;
    }
  }
  tNum = Math.max(0, tNum);

  return {
    id: String(id),
    source: source.trim(),
    title: title.trim().slice(0, MAX_TITLE_LENGTH),
    episode: episodeNum,
    t: tNum,
    ts: Date.now(),
  };
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

  const redis = getRedisClient();
  if (!redis) {
    return castUnavailableResponse();
  }

  try {
    const body = await request.json();
    const command = parseCastBody(body);

    if (!command) {
      return NextResponse.json(
        { error: 'Invalid cast payload: id, source and title are required' },
        { status: 400 }
      );
    }

    await redis.set(castKey(profileId), command, { ex: CAST_TTL_SECONDS });

    return NextResponse.json({ success: true, ts: command.ts });
  } catch (error) {
    console.error('Redis Cast Set Error:', error);
    return NextResponse.json({ error: 'Failed to save cast command' }, { status: 500 });
  }
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
    const command = await redis.get(castKey(profileId));
    return NextResponse.json({ success: true, command: command || null });
  } catch (error) {
    console.error('Redis Cast Get Error:', error);
    return NextResponse.json({ error: 'Failed to fetch cast command' }, { status: 500 });
  }
}

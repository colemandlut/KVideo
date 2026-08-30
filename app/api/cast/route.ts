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

/**
 * Validates and normalizes a candidate cast command.
 *
 * Used by both POST (validating the client's request body, with a
 * server-generated `overrideTs`) and GET (validating whatever came back out
 * of Redis, which may be a stale or foreign-shaped value left by another
 * project sharing this database) so the two paths cannot drift apart.
 */
function normalizeCastCommand(value: unknown, overrideTs?: number): CastCommand | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const { id, source, title, episode, t } = record;
  const ts = overrideTs ?? record.ts;

  if (
    (typeof id !== 'string' && typeof id !== 'number') ||
    (typeof id === 'string' && id.trim().length === 0)
  ) {
    return null;
  }
  if (!isNonEmptyString(source) || !isNonEmptyString(title)) {
    return null;
  }
  if (typeof ts !== 'number' || !Number.isFinite(ts)) {
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
    ts,
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
    const command = normalizeCastCommand(body, Date.now());

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

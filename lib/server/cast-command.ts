/**
 * Shared shape and validation for cast commands.
 *
 * Lives outside the route so the POST path, the Durable Object relay and the
 * unit tests all agree on what a valid command is. Two independent copies of
 * this drifting apart is exactly how a command becomes deliverable on one path
 * and silently rejected on the other.
 */

export const MAX_TITLE_LENGTH = 300;

export interface CastCommand {
  id: string;
  source: string;
  title: string;
  episode: number;
  t: number;
  ts: number;
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
export function normalizeCastCommand(value: unknown, overrideTs?: number): CastCommand | null {
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

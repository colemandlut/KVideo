// Shared normalisation for the Douban API routes.
//
// Douban exposes the same titles through several endpoints whose item shapes
// do not agree with each other:
//
//   /j/search_subjects        -> { subjects: [{ id, title, cover, rate, url }] }
//   /j/new_search_subjects    -> { data:     [{ id, title, cover, rate, url }] }
//   /rexxar/.../items         -> { subject_collection_items: [ ...three shapes ] }
//
// The rexxar collection endpoint is the awkward one: the poster lives under
// `pic` for the tv_* / show_hot lists, under `cover_url` for movie_top250, and
// under a nested `cover.url` object for movie_showing. Its `url` is also
// sometimes a `douban.com/doubanapp/dispatch/...` deep link rather than a real
// subject page.
//
// Everything here funnels those variants into the single shape the existing
// `/api/douban/recommend` route returns, so `TvMovie` / `TvPosterCard` consume
// all of them with no client change.

/** Exactly the fields `TvMovie` (components/tv/TvPosterCard.tsx) declares. */
export interface DoubanSubject {
  id: string;
  title: string;
  cover: string;
  rate: string;
  url: string;
}

/**
 * Douban hotlink-blocks its own posters, so every cover has to be served
 * through the existing image proxy route.
 */
export function proxyCover(rawCover: string): string {
  if (!rawCover) return '';
  return `/api/douban/image?url=${encodeURIComponent(rawCover)}`;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Pull the poster out of whichever field this particular collection uses.
 * `pic.normal` is the s_ratio_poster size the existing recommend route already
 * serves, so it is preferred over the larger m_ratio_poster variants.
 */
export function extractCover(item: Record<string, unknown>): string {
  const pic = asRecord(item.pic);
  const cover = item.cover;

  return (
    asString(pic.normal) ||
    asString(pic.large) ||
    asString(item.cover_url) ||
    asString(asRecord(cover).url) ||
    asString(cover)
  );
}

/**
 * Ratings are a `{ value }` object on the collection endpoint and a plain
 * string on the search endpoints. Unreleased titles carry `rating: null` or
 * `value: 0`, and `new_search_subjects` returns `rate: ""` for them.
 *
 * Those all normalise to an empty string: `TvPosterCard` renders the rating
 * badge behind a `movie.rate ?` guard, so an empty string correctly hides it.
 * Never substitute a placeholder number here — that would show a fake rating.
 */
export function extractRate(item: Record<string, unknown>): string {
  const rating = item.rating;

  if (typeof rating === 'object' && rating !== null) {
    const value = (rating as Record<string, unknown>).value;
    // `0` is Douban's "not rated yet" sentinel, not a real score.
    if (typeof value === 'number' && value > 0) return value.toFixed(1);
    if (typeof value === 'string' && value && Number(value) > 0) return value;
    return '';
  }

  const rate = item.rate;
  if (typeof rate === 'number') return rate > 0 ? rate.toFixed(1) : '';
  if (typeof rate === 'string' && Number(rate) > 0) return rate;

  return '';
}

/**
 * Prefer a canonical subject URL built from the id. movie_showing hands back a
 * `doubanapp/dispatch` deep link, which is not a page a browser can open.
 */
export function extractUrl(item: Record<string, unknown>): string {
  const id = asString(item.id);
  if (id) return `https://movie.douban.com/subject/${id}/`;
  return asString(item.url);
}

/** Normalise one upstream item into the shared `{ id, title, cover, rate, url }`. */
export function normaliseSubject(raw: unknown): DoubanSubject | null {
  const item = asRecord(raw);
  const id = asString(item.id);
  const title = asString(item.title);

  // An entry with no id and no title is unusable to the UI.
  if (!id && !title) return null;

  return {
    id,
    title,
    cover: proxyCover(extractCover(item)),
    rate: extractRate(item),
    url: extractUrl(item),
  };
}

/** Normalise a whole upstream list, dropping unusable entries. */
export function normaliseSubjects(raw: unknown): DoubanSubject[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normaliseSubject)
    .filter((subject): subject is DoubanSubject => subject !== null);
}

/** Headers that make Douban treat the request as a normal browser. */
export function doubanHeaders(referer: string): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    Referer: referer,
  };
}

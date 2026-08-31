import { NextResponse } from 'next/server';
import { doubanHeaders, normaliseSubjects } from '@/lib/server/douban-subject';

export const runtime = 'edge';

// The collection id is interpolated straight into the upstream URL, so it MUST
// come from a fixed whitelist. Accepting an arbitrary id would turn this route
// into an open proxy for any m.douban.com rexxar path.
//
// The revalidate window is per-list, keyed to how fast each list actually moves:
//   - movie_top250 is a near-static all-time ranking -> 24h
//   - movie_showing tracks cinema showtimes, and tv_hot / show_hot are live
//     popularity charts -> 1h
//   - the remaining curated lists turn over every few days -> 6h
const COLLECTIONS: Record<string, { revalidate: number }> = {
  movie_top250: { revalidate: 86400 },
  movie_showing: { revalidate: 3600 },
  movie_weekly_best: { revalidate: 21600 },
  tv_hot: { revalidate: 3600 },
  tv_domestic: { revalidate: 21600 },
  tv_american: { revalidate: 21600 },
  tv_japanese: { revalidate: 21600 },
  tv_korean: { revalidate: 21600 },
  tv_animation: { revalidate: 21600 },
  tv_documentary: { revalidate: 21600 },
  show_hot: { revalidate: 3600 },
};

// Not exported: Next.js route modules only allow a fixed set of export names.
const COLLECTION_IDS = Object.keys(COLLECTIONS);

const MAX_COUNT = 100;

function parseNonNegativeInt(raw: string | null, fallback: number): number | null {
  if (raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const id = searchParams.get('id') || '';
  const collection = Object.prototype.hasOwnProperty.call(COLLECTIONS, id)
    ? COLLECTIONS[id]
    : undefined;

  if (!collection) {
    return NextResponse.json(
      {
        subjects: [],
        error: `Unknown collection id. Expected one of: ${COLLECTION_IDS.join(', ')}`,
      },
      { status: 400 }
    );
  }

  const start = parseNonNegativeInt(searchParams.get('start'), 0);
  if (start === null) {
    return NextResponse.json(
      { subjects: [], error: 'Invalid start: expected a non-negative integer' },
      { status: 400 }
    );
  }

  const rawCount = searchParams.get('count') ?? searchParams.get('limit');
  const count = parseNonNegativeInt(rawCount, 20);
  if (count === null || count < 1 || count > MAX_COUNT) {
    return NextResponse.json(
      { subjects: [], error: `Invalid count: expected an integer between 1 and ${MAX_COUNT}` },
      { status: 400 }
    );
  }

  try {
    const url =
      `https://m.douban.com/rexxar/api/v2/subject_collection/${id}/items` +
      `?start=${start}&count=${count}`;

    const response = await fetch(url, {
      headers: doubanHeaders('https://m.douban.com/'),
      next: { revalidate: collection.revalidate },
    });

    if (!response.ok) {
      throw new Error(`Douban API returned ${response.status}`);
    }

    const data = await response.json();

    // Collection items live under `subject_collection_items`, not `subjects`.
    return NextResponse.json({
      subjects: normaliseSubjects(data?.subject_collection_items),
      total: typeof data?.total === 'number' ? data.total : 0,
      start,
      count,
    });
  } catch (error) {
    console.error('Douban collection API error:', error);
    return NextResponse.json(
      { subjects: [], error: 'Failed to fetch collection' },
      { status: 500 }
    );
  }
}

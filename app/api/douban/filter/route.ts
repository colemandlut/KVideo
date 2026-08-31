import { NextResponse } from 'next/server';
import { doubanHeaders, normaliseSubjects } from '@/lib/server/douban-subject';

export const runtime = 'edge';

// Douban's explore endpoint has no `type` param. Movies are the unfiltered
// default (empty tags) and TV is expressed by passing the 电视剧 tag.
const TYPE_TAGS: Record<string, string> = {
  movie: '',
  tv: '电视剧',
};

// The only sort keys the upstream accepts. Anything else is rejected rather
// than forwarded, so a bad value fails loudly here instead of upstream.
const SORTS: Record<string, string> = {
  U: '综合',
  T: '近期热度',
  S: '评分',
  R: '最新',
};

const DEFAULT_SORT = 'T';
const YEAR_RANGE_PATTERN = /^\d{4},\d{4}$/;
// Genres/countries are free-text Douban facet names; cap them so a caller
// cannot push an unbounded string into the upstream query string.
const MAX_FACET_LENGTH = 64;

function badRequest(error: string) {
  return NextResponse.json({ subjects: [], error }, { status: 400 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const type = searchParams.get('type') || 'movie';
  if (!Object.prototype.hasOwnProperty.call(TYPE_TAGS, type)) {
    return badRequest(`Invalid type: expected one of ${Object.keys(TYPE_TAGS).join(', ')}`);
  }

  const sort = searchParams.get('sort') || DEFAULT_SORT;
  if (!Object.prototype.hasOwnProperty.call(SORTS, sort)) {
    return badRequest(`Invalid sort: expected one of ${Object.keys(SORTS).join(', ')}`);
  }

  const rawStart = searchParams.get('start');
  if (rawStart !== null && rawStart !== '' && !/^\d+$/.test(rawStart)) {
    return badRequest('Invalid start: expected a non-negative integer');
  }
  const start = rawStart ? Number(rawStart) : 0;
  if (!Number.isSafeInteger(start)) {
    return badRequest('Invalid start: expected a non-negative integer');
  }

  const yearRange = searchParams.get('year_range') || '';
  if (yearRange && !YEAR_RANGE_PATTERN.test(yearRange)) {
    return badRequest('Invalid year_range: expected the form YYYY,YYYY');
  }

  const genres = searchParams.get('genres') || '';
  const countries = searchParams.get('countries') || '';
  if (genres.length > MAX_FACET_LENGTH || countries.length > MAX_FACET_LENGTH) {
    return badRequest(`Invalid genres/countries: max ${MAX_FACET_LENGTH} characters`);
  }

  try {
    // Every Chinese value has to be percent-encoded. Douban answers 400 to raw
    // UTF-8 in the query string, so encodeURIComponent here is load-bearing.
    const url =
      'https://movie.douban.com/j/new_search_subjects' +
      `?sort=${encodeURIComponent(sort)}` +
      '&range=0,10' +
      `&tags=${encodeURIComponent(TYPE_TAGS[type])}` +
      `&start=${start}` +
      `&genres=${encodeURIComponent(genres)}` +
      `&countries=${encodeURIComponent(countries)}` +
      `&year_range=${encodeURIComponent(yearRange)}`;

    const response = await fetch(url, {
      headers: doubanHeaders('https://movie.douban.com/explore'),
      // Filter results reorder with popularity and new releases, so an hour
      // matches the existing recommend route rather than the longer collection
      // windows.
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Douban API returned ${response.status}`);
    }

    const data = await response.json();

    // Filter results live under `data`, not `subjects`.
    return NextResponse.json({
      subjects: normaliseSubjects(data?.data),
      start,
      sort,
      type,
    });
  } catch (error) {
    console.error('Douban filter API error:', error);
    return NextResponse.json(
      { subjects: [], error: 'Failed to fetch filtered subjects' },
      { status: 500 }
    );
  }
}

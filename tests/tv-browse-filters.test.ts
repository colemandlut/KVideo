import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BROWSE_COUNTRIES,
  BROWSE_GENRES,
  BROWSE_PAGE_SIZE,
  BROWSE_SORTS,
  BROWSE_YEARS,
  DEFAULT_BROWSE_SELECTION,
  buildBrowseQuery,
  type BrowseSelection,
} from '@/lib/tv/browse-filters';

const ALL: BrowseSelection = DEFAULT_BROWSE_SELECTION;

const THAI_WUXIA_80S: BrowseSelection = {
  type: 'movie',
  genre: '武侠',
  country: '泰国',
  yearRange: '1980,1989',
  sort: 'S',
};

test('an untouched selection sends only the two params the route requires', () => {
  // Every dimension left on 全部 has to be absent, not empty: `genres=` is not
  // how the upstream expresses "no genre", and an untouched page must produce
  // the same URL - and therefore the same cache key - every time.
  assert.equal(buildBrowseQuery(ALL, 0), 'type=movie&sort=T');
});

test('每个维度的「全部」清空该维', () => {
  const query = new URLSearchParams(buildBrowseQuery(THAI_WUXIA_80S, 0));
  assert.equal(query.get('genres'), '武侠');
  assert.equal(query.get('countries'), '泰国');
  assert.equal(query.get('year_range'), '1980,1989');

  // Clearing one dimension must drop only that key and leave the rest intact.
  const cleared = new URLSearchParams(buildBrowseQuery({ ...THAI_WUXIA_80S, country: '' }, 0));
  assert.equal(cleared.has('countries'), false);
  assert.equal(cleared.get('genres'), '武侠');
  assert.equal(cleared.get('year_range'), '1980,1989');

  // And clearing all three leaves the bare type/sort query again.
  assert.equal(
    buildBrowseQuery({ ...THAI_WUXIA_80S, genre: '', country: '', yearRange: '', sort: 'T' }, 0),
    'type=movie&sort=T'
  );
});

test('Chinese facet values are percent-encoded in the query string', () => {
  // Douban answers 400 to raw UTF-8, so this must never reach the network
  // unencoded - and URLSearchParams, not manual concatenation, is what
  // guarantees it.
  const query = buildBrowseQuery({ ...ALL, genre: '科幻' }, 0);
  assert.ok(query.includes('genres=%E7%A7%91%E5%B9%BB'), query);
  assert.ok(!query.includes('科幻'));
});

test('start is omitted on the first page and set on later ones', () => {
  assert.equal(buildBrowseQuery(ALL, 0).includes('start='), false);
  assert.equal(new URLSearchParams(buildBrowseQuery(ALL, BROWSE_PAGE_SIZE)).get('start'), '20');
  assert.equal(new URLSearchParams(buildBrowseQuery(ALL, 3 * BROWSE_PAGE_SIZE)).get('start'), '60');
});

test('the TV type is carried through as the filter route expects', () => {
  assert.equal(new URLSearchParams(buildBrowseQuery({ ...ALL, type: 'tv' }, 0)).get('type'), 'tv');
});

test('every year option is either 全部 or the route year_range pattern', () => {
  // The filter route rejects anything that is not /^\d{4},\d{4}$/, so a typo
  // in the table below would 400 instead of filtering.
  for (const option of BROWSE_YEARS) {
    if (option.value === '') {
      assert.equal(option.label, '全部');
      continue;
    }
    assert.match(option.value, /^\d{4},\d{4}$/);
    const [from, to] = option.value.split(',').map(Number);
    assert.ok(from <= to, `${option.label} spans backwards`);
  }
});

test('每个维度都有且只有一个「全部」，排序则没有', () => {
  for (const options of [BROWSE_GENRES, BROWSE_COUNTRIES, BROWSE_YEARS]) {
    assert.equal(options.filter((option) => option.value === '').length, 1);
    // 全部 leads the row so clearing a filter is always the leftmost press.
    assert.equal(options[0].label, '全部');
  }

  // Sort always orders the list; an empty sort would fall back to the route's
  // default rather than clearing anything, so there is no 全部 pill for it.
  assert.equal(BROWSE_SORTS.some((option) => option.value === ''), false);
  assert.ok(BROWSE_SORTS.some((option) => option.value === DEFAULT_BROWSE_SELECTION.sort));
});

test('sort keys are exactly the four the filter route accepts', () => {
  assert.deepEqual(BROWSE_SORTS.map((option) => option.value), ['U', 'T', 'S', 'R']);
});

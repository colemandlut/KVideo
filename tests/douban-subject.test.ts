import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractCover,
  extractRate,
  extractUrl,
  normaliseSubjects,
} from '@/lib/server/douban-subject';

// Douban's collection endpoint puts the poster in a different field depending
// on which list you asked for. These three fixtures are trimmed from real
// responses (2026-09-01) for tv_hot, movie_top250 and movie_showing. A cover
// extractor that handles only one of them still returns 200 with every card
// blank, which is why this is pinned rather than left to manual checking.
const TV_HOT_ITEM = {
  id: '36096785',
  title: '早春晴朗',
  pic: { normal: 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p1.jpg' },
  rating: { value: 8.1 },
  url: 'https://movie.douban.com/subject/36096785/',
};

const TOP250_ITEM = {
  id: '1292052',
  title: '肖申克的救赎',
  cover_url: 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2.jpg',
  rating: { value: 9.7 },
  url: 'https://movie.douban.com/subject/1292052/',
};

const SHOWING_ITEM = {
  id: '35376890',
  title: '奥德赛',
  cover: { url: 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p3.jpg' },
  rating: null,
  // Not a page a browser can open - the canonical URL has to come from `id`.
  url: 'https://douban.com/doubanapp/dispatch?uri=/movie/35376890/',
};

test('covers are found in all three shapes the collection endpoint uses', () => {
  assert.equal(extractCover(TV_HOT_ITEM), 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p1.jpg');
  assert.equal(extractCover(TOP250_ITEM), 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2.jpg');
  assert.equal(extractCover(SHOWING_ITEM), 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p3.jpg');
});

test('the plain-string cover of the search endpoints still works', () => {
  assert.equal(
    extractCover({ cover: 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p4.jpg' }),
    'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p4.jpg',
  );
  assert.equal(extractCover({}), '');
});

test('unrated titles produce an empty rating, never a fake score', () => {
  assert.equal(extractRate(TV_HOT_ITEM), '8.1');
  // Douban's "not rated yet" sentinels, one per endpoint.
  assert.equal(extractRate(SHOWING_ITEM), '');
  assert.equal(extractRate({ rating: { value: 0 } }), '');
  assert.equal(extractRate({ rate: '' }), '');
  assert.equal(extractRate({}), '');
});

test('a doubanapp deep link is replaced by the real subject page', () => {
  assert.equal(extractUrl(SHOWING_ITEM), 'https://movie.douban.com/subject/35376890/');
  assert.equal(extractUrl(TV_HOT_ITEM), 'https://movie.douban.com/subject/36096785/');
});

test('normaliseSubjects proxies every cover and drops unusable items', () => {
  const subjects = normaliseSubjects([TV_HOT_ITEM, TOP250_ITEM, SHOWING_ITEM, {}, null]);

  assert.equal(subjects.length, 3);
  for (const subject of subjects) {
    assert.ok(
      subject.cover.startsWith('/api/douban/image?url='),
      `cover not proxied: ${subject.cover}`,
    );
  }
});

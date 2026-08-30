import test from 'node:test';
import assert from 'node:assert/strict';

import { moveFocus, clampFocus, findFirstFocusable, isAtRowEnd } from '@/lib/tv/focus-model';
import type { TvRowMeta } from '@/lib/tv/focus-model';

const rows: TvRowMeta[] = [
  { id: 'topbar', length: 3 },
  { id: 'recommend', length: 6 },
  { id: 'empty', length: 0 },
  { id: 'popular', length: 2 },
];

test('right moves within the row and stops at the end', () => {
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 0 }, 'right'), { rowIndex: 1, itemIndex: 1 });
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 5 }, 'right'), { rowIndex: 1, itemIndex: 5 });
});

test('left moves within the row and stops at the start', () => {
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 3 }, 'left'), { rowIndex: 1, itemIndex: 2 });
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 0 }, 'left'), { rowIndex: 1, itemIndex: 0 });
});

test('down skips a row that loaded but has no items', () => {
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 0 }, 'down'), { rowIndex: 3, itemIndex: 0 });
});

test('changing row lands on the start of that row', () => {
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 5 }, 'down'), { rowIndex: 3, itemIndex: 0 });
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 5 }, 'up'), { rowIndex: 0, itemIndex: 0 });
});

test('grid rows keep the column, clamped to the shorter row', () => {
  const gridRows: TvRowMeta[] = [
    { id: 'g0', length: 5, keepColumn: true },
    { id: 'g1', length: 5, keepColumn: true },
    { id: 'g2', length: 2, keepColumn: true },
  ];
  assert.deepEqual(moveFocus(gridRows, { rowIndex: 0, itemIndex: 3 }, 'down'), { rowIndex: 1, itemIndex: 3 });
  assert.deepEqual(moveFocus(gridRows, { rowIndex: 1, itemIndex: 3 }, 'down'), { rowIndex: 2, itemIndex: 1 });
});

test('up from the first row stays put', () => {
  assert.deepEqual(moveFocus(rows, { rowIndex: 0, itemIndex: 1 }, 'up'), { rowIndex: 0, itemIndex: 1 });
});

test('down from the last row stays put', () => {
  assert.deepEqual(moveFocus(rows, { rowIndex: 3, itemIndex: 1 }, 'down'), { rowIndex: 3, itemIndex: 1 });
});

test('findFirstFocusable returns the first non-empty row', () => {
  assert.deepEqual(findFirstFocusable([{ id: 'a', length: 0 }, { id: 'b', length: 2 }]), { rowIndex: 1, itemIndex: 0 });
  assert.equal(findFirstFocusable([{ id: 'a', length: 0 }]), null);
});

test('clampFocus pulls a stale position back in range when a row shrinks', () => {
  const shrunk: TvRowMeta[] = [{ id: 'topbar', length: 3 }, { id: 'recommend', length: 2 }];
  assert.deepEqual(clampFocus(shrunk, { rowIndex: 1, itemIndex: 5 }), { rowIndex: 1, itemIndex: 1 });
  assert.deepEqual(clampFocus(shrunk, { rowIndex: 9, itemIndex: 0 }), { rowIndex: 1, itemIndex: 0 });
});

test('isAtRowEnd reports the last item of a row', () => {
  assert.equal(isAtRowEnd(rows, { rowIndex: 3, itemIndex: 1 }), true);
  assert.equal(isAtRowEnd(rows, { rowIndex: 3, itemIndex: 0 }), false);
  assert.equal(isAtRowEnd(rows, { rowIndex: 2, itemIndex: 0 }), false);
});

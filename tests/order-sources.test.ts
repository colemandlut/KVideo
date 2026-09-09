import assert from 'node:assert/strict';
import test from 'node:test';

import { orderSourcesByLatency } from '@/lib/tv/order-sources';

const names = (list: { source: string }[]) => list.map((s) => s.source);
const from = (...sources: string[]) => sources.map((source) => ({ source }));

test('fastest first', () => {
  const latency: Record<string, number> = { a: 900, b: 120, c: 430 };
  const ordered = orderSourcesByLatency(from('a', 'b', 'c'), (s) => latency[s.source]);
  assert.deepEqual(names(ordered), ['b', 'c', 'a']);
});

test('unmeasured sources go last, not first and not treated as slow', () => {
  const latency: Record<string, number> = { b: 900 };
  // `a` is unmeasured; `b` is measured and slow. `b` still ranks first,
  // because "no measurement" is not evidence of being fast.
  const ordered = orderSourcesByLatency(from('a', 'b'), (s) => latency[s.source]);
  assert.deepEqual(names(ordered), ['b', 'a']);
});

test('unmeasured sources keep their original order among themselves', () => {
  const ordered = orderSourcesByLatency(from('x', 'y', 'z'), () => undefined);
  assert.deepEqual(names(ordered), ['x', 'y', 'z']);
});

test('equal latencies keep their original order', () => {
  const latency: Record<string, number> = { a: 200, b: 200, c: 100 };
  const ordered = orderSourcesByLatency(from('a', 'b', 'c'), (s) => latency[s.source]);
  assert.deepEqual(names(ordered), ['c', 'a', 'b']);
});

test('the input array is not mutated', () => {
  const input = from('a', 'b');
  const latency: Record<string, number> = { a: 500, b: 100 };
  orderSourcesByLatency(input, (s) => latency[s.source]);
  assert.deepEqual(names(input), ['a', 'b']);
});

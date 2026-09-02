import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCastCommand } from '@/lib/server/cast-command';

// This validator now guards two delivery paths (the Durable Object push and
// the Redis mailbox). A command that normalises differently between them
// would be playable one way and silently dropped the other, so the rules are
// pinned here rather than left to whichever route happens to exercise them.

test('a full command round-trips with the server timestamp winning', () => {
  const command = normalizeCastCommand(
    { id: 42, source: ' heimuer ', title: '  片子  ', episode: 3, t: 12.5, ts: 1 },
    999,
  );

  assert.deepEqual(command, {
    id: '42',
    source: 'heimuer',
    title: '片子',
    episode: 3,
    t: 12.5,
    ts: 999,
  });
});

test('episode and position default to the start when absent', () => {
  const command = normalizeCastCommand({ id: '1', source: 's', title: 't' }, 5);
  assert.equal(command?.episode, 0);
  assert.equal(command?.t, 0);
});

test('a negative position is clamped rather than rejected', () => {
  // Some players report a small negative currentTime right after a seek.
  assert.equal(normalizeCastCommand({ id: '1', source: 's', title: 't', t: -3 }, 5)?.t, 0);
});

test('unusable payloads are rejected', () => {
  const cases: unknown[] = [
    null,
    'not an object',
    { source: 's', title: 't' },                       // no id
    { id: '   ', source: 's', title: 't' },            // blank id
    { id: '1', source: '', title: 't' },               // blank source
    { id: '1', source: 's', title: '   ' },            // blank title
    { id: '1', source: 's', title: 't', episode: 1.5 },// non-integer episode
    { id: '1', source: 's', title: 't', episode: -1 }, // negative episode
    { id: '1', source: 's', title: 't', t: Infinity }, // non-finite position
  ];

  for (const value of cases) {
    assert.equal(normalizeCastCommand(value, 5), null, `should reject ${JSON.stringify(value)}`);
  }
});

test('a stored command without an override keeps its own timestamp, and needs one', () => {
  assert.equal(normalizeCastCommand({ id: '1', source: 's', title: 't', ts: 77 })?.ts, 77);
  // The mailbox path has no server timestamp to substitute, so a value that
  // never carried one cannot be ordered against what the TV already played.
  assert.equal(normalizeCastCommand({ id: '1', source: 's', title: 't' }), null);
});

test('titles are truncated so one client cannot store an unbounded string', () => {
  const command = normalizeCastCommand({ id: '1', source: 's', title: 'x'.repeat(500) }, 5);
  assert.equal(command?.title.length, 300);
});

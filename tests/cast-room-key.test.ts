import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveCastRoomKey, normalizeClientAddress } from '@/lib/server/cast-room-key';

// The whole "phones only reach TVs in their own house" property rests on this
// derivation, and it is not something a user can see going wrong: a bad key
// silently means either a TV nobody can cast to, or one a stranger can.

test('devices behind one address share a room', async () => {
  const tv = await deriveCastRoomKey('profile-1', '203.0.113.7');
  const phone = await deriveCastRoomKey('profile-1', '203.0.113.7');
  assert.equal(tv, phone);
});

test('a different network is a different room', async () => {
  const home = await deriveCastRoomKey('profile-1', '203.0.113.7');
  const elsewhere = await deriveCastRoomKey('profile-1', '198.51.100.7');
  assert.notEqual(home, elsewhere);
});

test('a different account is a different room even on one network', async () => {
  const a = await deriveCastRoomKey('profile-1', '203.0.113.7');
  const b = await deriveCastRoomKey('profile-2', '203.0.113.7');
  assert.notEqual(a, b);
});

test('IPv6 groups by /64, so one home is one room', async () => {
  // Two devices on the same home prefix, different interface identifiers.
  const tv = await deriveCastRoomKey('p', '2001:db8:85a3:1::c0ff:ee');
  const phone = await deriveCastRoomKey('p', '2001:db8:85a3:1::beef');
  assert.equal(tv, phone, 'same /64 must land in one room');

  const neighbour = await deriveCastRoomKey('p', '2001:db8:85a3:2::beef');
  assert.notEqual(tv, neighbour, 'a different /64 is a different network');
});

test('address normalisation is case- and zone-insensitive', () => {
  assert.equal(normalizeClientAddress('2001:DB8:85A3:1::BEEF'), '2001:db8:85a3:1');
  assert.equal(normalizeClientAddress('fe80::1%en0'), 'fe80::1');
  assert.equal(normalizeClientAddress('  203.0.113.7  '), '203.0.113.7');
});

test('a missing address still yields a usable key', async () => {
  // Local dev has no CF-Connecting-IP; everything falling into one room is the
  // pre-grouping behaviour, which is correct there and must not throw.
  const key = await deriveCastRoomKey('profile-1', '');
  assert.match(key, /^[0-9a-f]{32}$/);
});

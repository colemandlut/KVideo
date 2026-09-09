import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePlaylistResolution } from '@/lib/server/stream-info';

// Shapes taken from real sources on 2026-09-09. Nine of sixteen serve a master
// playlist; the rest serve a bare media playlist and genuinely cannot say what
// resolution they are.

test('reads the resolution from a real master playlist', () => {
  const playlist = [
    '#EXTM3U',
    '#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=800000,RESOLUTION=1920x1080',
    '3000k/hls/mixed.m3u8',
  ].join('\n');

  assert.deepEqual(parsePlaylistResolution(playlist), {
    width: 1920,
    height: 1080,
    label: '1080P',
  });
});

test('a media playlist declares no resolution and must not be guessed at', () => {
  const playlist = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:6',
    '#EXTINF:3.4,',
    '0000000.ts',
  ].join('\n');

  assert.equal(parsePlaylistResolution(playlist), null);
});

test('the best rendition wins, not the first listed', () => {
  const playlist = [
    '#EXTM3U',
    '#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=640x360',
    'low.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1920x1080',
    'high.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720',
    'mid.m3u8',
  ].join('\n');

  assert.equal(parsePlaylistResolution(playlist)?.label, '1080P');
});

test('labels map to what a viewer recognises', () => {
  const at = (h: number) =>
    parsePlaylistResolution(`#EXT-X-STREAM-INF:RESOLUTION=100x${h}`)?.label;

  assert.equal(at(2160), '4K');
  assert.equal(at(1440), '2K');
  assert.equal(at(1080), '1080P');
  assert.equal(at(720), '720P');
  assert.equal(at(480), '480P');
  assert.equal(at(360), '360P');
});

test('malformed or absent declarations yield nothing rather than a bad label', () => {
  assert.equal(parsePlaylistResolution(''), null);
  assert.equal(parsePlaylistResolution('#EXT-X-STREAM-INF:RESOLUTION=abc'), null);
  assert.equal(parsePlaylistResolution('#EXT-X-STREAM-INF:RESOLUTION=1920x0'), null);
});

test('spacing and case in the attribute do not matter', () => {
  assert.equal(parsePlaylistResolution('#EXT-X-STREAM-INF:resolution = 1280 x 720')?.label, '720P');
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { isProbeableUrl } from '@/lib/server/probe-guard';

// These endpoints fetch a URL from Cloudflare's edge on a caller's behalf.
// Unfiltered, they are a scanner anyone can point anywhere, so the rules are
// pinned here rather than left to review.

test('ordinary source and CDN hosts are allowed', () => {
  assert.equal(isProbeableUrl('https://bfzyapi.com/api.php/provide/vod'), true);
  assert.equal(isProbeableUrl('https://c1.rrcdnbf6.com/video/x/index.m3u8'), true);
  assert.equal(isProbeableUrl('http://example.com:8080/a.m3u8'), true);
});

test('non-http schemes are refused', () => {
  for (const url of ['file:///etc/passwd', 'ftp://example.com/x', 'data:text/plain,hi']) {
    assert.equal(isProbeableUrl(url), false, url);
  }
});

test('loopback and cloud metadata are refused', () => {
  for (const host of ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '169.254.169.254', 'metadata.google.internal']) {
    assert.equal(isProbeableUrl(`http://${host}/`), false, host);
  }
});

test('private IPv4 ranges are refused', () => {
  for (const host of ['10.0.0.5', '192.168.1.1', '172.16.0.1', '172.31.255.255', '127.9.9.9']) {
    assert.equal(isProbeableUrl(`http://${host}/`), false, host);
  }
  // 172.32 is public - the private block stops at 172.31.
  assert.equal(isProbeableUrl('http://172.32.0.1/'), true);
});

test('IPv6 link-local and unique-local are refused', () => {
  for (const host of ['[fe80::1]', '[fc00::1]', '[fd12:3456::1]']) {
    assert.equal(isProbeableUrl(`http://${host}/`), false, host);
  }
});

test('malformed input is refused rather than throwing', () => {
  for (const url of ['', 'not a url', '://missing-scheme']) {
    assert.equal(isProbeableUrl(url), false, JSON.stringify(url));
  }
});

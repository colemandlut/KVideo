/**
 * Guards the probe endpoints, which take a URL from the client and fetch it
 * from the edge. Without this they are an open relay: anyone could point them
 * at a third party and have Cloudflare do the fetching.
 *
 * Workers cannot reach a private network, so this is not about protecting an
 * internal estate - it is about not being usable as someone else's scanner.
 * Callers must also hold a session; see the routes.
 */

/** Literals that should never be fetched on a client's behalf. */
const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  // Cloud instance metadata, the classic SSRF target.
  '169.254.169.254',
  'metadata.google.internal',
]);

const PRIVATE_V4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export function isProbeableUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(url.protocol)) return false;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(host)) return false;
  if (PRIVATE_V4.test(host)) return false;
  // IPv6 unique-local and link-local.
  if (/^(fc|fd|fe80)/.test(host)) return false;

  return true;
}

/**
 * Video resolution, read from an HLS master playlist.
 *
 * Only a master playlist declares it, on its #EXT-X-STREAM-INF lines. A media
 * playlist - a bare list of .ts segments - carries no resolution at all, and
 * several sources serve exactly that. Those are reported as unknown rather
 * than guessed at: a made-up "1080P" next to a source is worse than no label,
 * because the label is the whole reason to look.
 */

export interface StreamResolution {
  width: number;
  height: number;
  /** 1080P, 720P … - what a viewer recognises, derived from the height. */
  label: string;
}

/** Common tiers, so 1088-tall or 1promo-ish streams still read sensibly. */
function resolutionLabel(height: number): string {
  if (height >= 2000) return '4K';
  if (height >= 1400) return '2K';
  if (height >= 1000) return '1080P';
  if (height >= 700) return '720P';
  if (height >= 460) return '480P';
  return `${height}P`;
}

/**
 * The highest resolution a playlist offers, or null.
 *
 * Highest rather than first: a master playlist lists every rendition it has,
 * and what a viewer gets on a TV is the best one the connection sustains.
 */
export function parsePlaylistResolution(playlist: string): StreamResolution | null {
  let best: StreamResolution | null = null;

  for (const match of playlist.matchAll(/RESOLUTION\s*=\s*(\d+)\s*x\s*(\d+)/gi)) {
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) continue;
    if (!best || height > best.height) {
      best = { width, height, label: resolutionLabel(height) };
    }
  }

  return best;
}

import type { Video } from '@/lib/types';

export type PlayabilityMap = Record<string, 'playable' | 'dead'>;

/**
 * The order search results appear in on the TV.
 *
 * Results arrive in whatever order the parallel search completed, which is
 * effectively random - a 26ms source next to a 2.2s one next to a 501ms one.
 * On a phone that is a scroll away; on a remote every row costs button
 * presses, so the usable sources have to be at the top.
 *
 * Three tiers:
 *   0. plays, or has not been ruled out - ordered by latency, fastest first
 *   1. latency not measured yet - not demoted on suspicion, but it cannot be
 *      placed among the timed ones either
 *   2. confirmed unplayable
 *
 * Ties keep their original position so the grid does not reshuffle arbitrarily
 * while measurements stream in.
 */
export function orderTvResults(
  results: Video[],
  latencies: Record<string, number>,
  playability: PlayabilityMap,
): Video[] {
  const effectiveLatency = (video: Video) => latencies[video.source] ?? video.latency;

  const tier = (video: Video) => {
    if (playability[video.source] === 'dead') return 2;
    return effectiveLatency(video) === undefined ? 1 : 0;
  };

  return results
    .map((video, index) => ({ video, index }))
    .sort((a, b) => {
      const byTier = tier(a.video) - tier(b.video);
      if (byTier !== 0) return byTier;

      const latencyA = effectiveLatency(a.video);
      const latencyB = effectiveLatency(b.video);
      if (latencyA !== undefined && latencyB !== undefined && latencyA !== latencyB) {
        return latencyA - latencyB;
      }

      return a.index - b.index;
    })
    .map((entry) => entry.video);
}

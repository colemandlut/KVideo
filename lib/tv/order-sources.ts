/**
 * Source order in the TV player panel: fastest connection first.
 *
 * "Fastest" means a measurement against the source's actual stream, not its
 * API host - those are different servers and the API time says nothing about
 * whether the video plays or how quickly it starts.
 *
 * A source with no measurement yet sits after the measured ones. It is neither
 * treated as infinitely slow nor assumed fast: no measurement is not a verdict,
 * and demoting it below a source known to be slow would be a claim the data
 * does not support. Ties keep their original position so the list is never
 * shuffled arbitrarily.
 */
export function orderSourcesByLatency<T extends { source: string }>(
  sources: T[],
  latencyOf: (source: T) => number | undefined,
): T[] {
  return sources
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const la = latencyOf(a.item);
      const lb = latencyOf(b.item);
      if (la === undefined && lb === undefined) return a.index - b.index;
      if (la === undefined) return 1;
      if (lb === undefined) return -1;
      return la - lb || a.index - b.index;
    })
    .map((entry) => entry.item);
}

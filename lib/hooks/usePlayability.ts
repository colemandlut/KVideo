'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Video } from '@/lib/types';

/** A source with no entry yet is still being checked - that state is derived
 *  from the absence of a result rather than written into it, because writing
 *  state synchronously inside an effect is a hard lint error in this codebase. */
export type Playability = 'playable' | 'dead';

/** One probe per source, not per video: sources fail as a whole (a dead CDN),
 *  and probing every result would mean dozens of requests per search. */
const CONCURRENCY = 4;

function probeTarget(video: Video): { id: string; source: string } | null {
  const id = video.vod_id;
  if (id === undefined || id === null || !video.source) return null;
  return { id: String(id), source: video.source };
}

/**
 * Whether each source can actually play what it just returned.
 *
 * The latency badge answers a different question - how fast the source's API
 * host replies - and the two diverge badly: a source whose API answers in
 * 0.6s can have a CDN returning 404 for nine videos in ten, and it shows up
 * looking like the best source in the list.
 */
export function usePlayability(results: Video[], enabled: boolean) {
  const [status, setStatus] = useState<Record<string, Playability>>({});
  const checkedRef = useRef(new Set<string>());

  const check = useCallback(async (source: string, id: string) => {
    try {
      const res = await fetch('/api/playable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, source }),
      });
      const data = res.ok ? ((await res.json()) as { playable?: boolean }) : null;
      setStatus((prev) => ({ ...prev, [source]: data?.playable ? 'playable' : 'dead' }));
    } catch {
      // A failed probe is not evidence the source is dead - the check itself
      // may have been blocked - so leave it unmarked rather than accusing it.
      setStatus((prev) => {
        const next = { ...prev };
        delete next[source];
        return next;
      });
      checkedRef.current.delete(source);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // One entry per source, first result wins.
    const pending: { source: string; id: string }[] = [];
    for (const video of results) {
      if (checkedRef.current.has(video.source)) continue;
      const target = probeTarget(video);
      if (!target) continue;
      checkedRef.current.add(video.source);
      pending.push(target);
    }

    if (pending.length === 0) return;

    let cancelled = false;
    void (async () => {
      for (let i = 0; i < pending.length; i += CONCURRENCY) {
        if (cancelled) return;
        await Promise.all(pending.slice(i, i + CONCURRENCY).map((p) => check(p.source, p.id)));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [results, enabled, check]);

  return status;
}

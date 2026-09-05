'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { settingsStore } from '@/lib/store/settings-store';
import type { Video, VideoSource } from '@/lib/types';

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

  const check = useCallback(async (source: string, id: string, config?: VideoSource) => {
    try {
      const res = await fetch('/api/playable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, source: config ?? source }),
      });
      // Only a definitive answer may mark a source dead. Treating any failed
      // check as "unplayable" turned a single backend bug into every source on
      // screen being labelled 不可播 - confidently wrong, and worse than
      // showing nothing at all.
      if (!res.ok) {
        checkedRef.current.delete(source);
        return;
      }

      const data = (await res.json()) as { playable?: boolean; checked?: boolean };
      if (data.checked === false) {
        checkedRef.current.delete(source);
        return;
      }

      setStatus((prev) => ({ ...prev, [source]: data.playable ? 'playable' : 'dead' }));
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

  // Most sources come from the user's subscription and exist only on the
  // client, so the config has to travel with the request - the server cannot
  // look them up by id, and trying to was what made every source report as
  // unplayable. This mirrors what /api/detail already accepts.
  const sourceById = useMemo(() => {
    const settings = settingsStore.getSettings();
    const all: VideoSource[] = [...(settings.sources ?? []), ...(settings.premiumSources ?? [])];
    return new Map(all.map((item) => [item.id, item]));
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
        await Promise.all(
          pending.slice(i, i + CONCURRENCY).map((p) =>
            check(p.source, p.id, sourceById.get(p.source)),
          ),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [results, enabled, check, sourceById]);

  return status;
}

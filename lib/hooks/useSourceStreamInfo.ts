'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { settingsStore } from '@/lib/store/settings-store';
import type { VideoSource } from '@/lib/types';

export interface SourceStreamInfo {
  latency?: number;
  /** 1080P, 720P … Absent when the source's playlist does not declare one. */
  resolution?: string;
  playable?: boolean;
}

/** One probe per source at a time, so switching sources stays responsive. */
const CONCURRENCY = 3;

/**
 * Latency and resolution for each source of the video being watched.
 *
 * Both come from one probe of the source's actual stream URL, which is the
 * only place either can be measured honestly: the latency badge elsewhere
 * times the source's *API* host, a different server from the one serving the
 * video, and resolution is declared only inside an HLS master playlist.
 *
 * Sources whose playlist carries no resolution report none. That is the
 * common case for a few of them and it is left blank rather than guessed -
 * a wrong "1080P" beside a source defeats the point of showing it.
 */
export function useSourceStreamInfo(
  sources: { source: string; id: string | number }[],
  enabled: boolean,
) {
  const [info, setInfo] = useState<Record<string, SourceStreamInfo>>({});
  const probedRef = useRef(new Set<string>());

  const probe = useCallback(async (source: string, id: string, config?: VideoSource) => {
    try {
      const res = await fetch('/api/playable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, source: config ?? source }),
      });
      if (!res.ok) {
        probedRef.current.delete(source);
        return;
      }

      const data = (await res.json()) as {
        checked?: boolean;
        playable?: boolean;
        latency?: number;
        resolution?: string;
      };

      // A probe that could not reach a verdict says nothing about the source;
      // leaving it unmarked is the honest outcome.
      if (data.checked === false) {
        probedRef.current.delete(source);
        return;
      }

      setInfo((prev) => ({
        ...prev,
        [source]: {
          latency: data.latency,
          resolution: data.resolution,
          playable: data.playable,
        },
      }));
    } catch {
      probedRef.current.delete(source);
    }
  }, []);

  useEffect(() => {
    if (!enabled || sources.length === 0) return;

    const settings = settingsStore.getSettings();
    const byId = new Map(
      [...(settings.sources ?? []), ...(settings.premiumSources ?? [])].map((s) => [s.id, s]),
    );

    const pending = sources.filter((entry) => {
      if (probedRef.current.has(entry.source)) return false;
      probedRef.current.add(entry.source);
      return true;
    });

    if (pending.length === 0) return;

    let cancelled = false;
    void (async () => {
      for (let i = 0; i < pending.length; i += CONCURRENCY) {
        if (cancelled) return;
        await Promise.all(
          pending
            .slice(i, i + CONCURRENCY)
            .map((entry) => probe(entry.source, String(entry.id), byId.get(entry.source))),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sources, enabled, probe]);

  return info;
}

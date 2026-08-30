'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useIsTvLike } from '@/lib/hooks/mobile/useDeviceDetection';

const POLL_INTERVAL_MS = 5000;

interface CastCommand {
  id: string;
  source: string;
  title: string;
  episode: number;
  t: number;
  ts: number;
}

interface CastGetResponse {
  success: boolean;
  command: CastCommand | null;
}

/**
 * Renders nothing. While running on a TV-like device, polls the phone-to-TV
 * cast mailbox and navigates to the requested video when a new command
 * arrives. Mounted once in the root layout (see app/layout.tsx) so it keeps
 * polling across every route - a cast is meant to interrupt whatever the TV
 * is already doing, and it would stop working the moment it mattered if it
 * lived inside a page that unmounts on navigation.
 */
export function TvCastReceiver() {
  const isTvLike = useIsTvLike();
  const router = useRouter();

  // Last handled command timestamp. 0 means "nothing handled yet".
  const lastTsRef = useRef(0);
  // Whether we've completed at least one successful poll this mount. Used to
  // avoid acting on whatever command is already sitting in the mailbox the
  // instant polling starts (e.g. the TV waking up) - only newly-arriving
  // commands should trigger navigation.
  const hasPolledOnceRef = useRef(false);

  useEffect(() => {
    if (!isTvLike) {
      return;
    }

    lastTsRef.current = 0;
    hasPolledOnceRef.current = false;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      try {
        const res = await fetch('/api/cast');

        if (res.status === 401 || res.status === 503) {
          console.info(
            `[TvCastReceiver] Cast endpoint returned ${res.status}; stopping polling for this session.`
          );
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          return;
        }

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as CastGetResponse;
        const command = data.command;

        const isFirstPoll = !hasPolledOnceRef.current;
        hasPolledOnceRef.current = true;

        if (!command) {
          return;
        }

        if (isFirstPoll) {
          lastTsRef.current = command.ts;
          return;
        }

        if (command.ts <= lastTsRef.current) {
          return;
        }

        lastTsRef.current = command.ts;

        const params = new URLSearchParams({
          id: command.id,
          source: command.source,
          title: command.title,
          episode: String(command.episode),
        });
        if (command.t > 0) {
          params.set('t', String(command.t));
        }

        router.push(`/player?${params.toString()}`);
      } catch {
        // Transient network failure - keep polling, next tick may succeed.
      }
    };

    intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [isTvLike, router]);

  return null;
}

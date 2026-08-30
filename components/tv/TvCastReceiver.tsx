'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useIsTvLike } from '@/lib/hooks/mobile/useDeviceDetection';

const POLL_INTERVAL_MS = 5000;
// 6 skipped ticks -> roughly one probe every 30s while logged out.
const TICKS_WHILE_UNAUTHENTICATED = 6;

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
    // Poll every tick normally; while unauthenticated, only every 6th tick.
    let skipTicks = 0;

    const poll = async () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      if (skipTicks > 0) {
        skipTicks -= 1;
        return;
      }

      try {
        const res = await fetch('/api/cast');

        // 503 means Upstash is not configured. That cannot change without a
        // redeploy, which reloads the page anyway, so stop for good.
        if (res.status === 503) {
          console.info('[TvCastReceiver] Cast storage is not configured; stopping.');
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          return;
        }

        // 401 just means nobody has logged in yet. This receiver is mounted
        // outside the password gate, so on a cold start it polls before the
        // user has typed the password. Backing off instead of stopping is what
        // lets casting start working the moment they log in - stopping here
        // left the feature dead until the whole app was restarted.
        if (res.status === 401) {
          skipTicks = TICKS_WHILE_UNAUTHENTICATED;
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

'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useIsTvLike } from '@/lib/hooks/mobile/useDeviceDetection';
import { readTvName } from '@/lib/tv/tv-name';

const POLL_INTERVAL_MS = 5000;
// Reconnect backoff for the push socket, capped so a TV that lost the network
// for an hour still comes back on its own without hammering the edge.
const SOCKET_BACKOFF_START_MS = 1000;
const SOCKET_BACKOFF_MAX_MS = 30000;
// How long to wait before asking for a ticket again when nobody has logged in
// yet. This receiver is mounted outside the password gate, so on a cold start
// it runs before there is a session.
const TICKET_RETRY_WHILE_UNAUTHENTICATED_MS = 30000;
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

type CastRouter = { push: (url: string) => void; replace: (url: string) => void };

/**
 * Turn a received command into playback. Shared by the WebSocket path and the
 * polling fallback deliberately: two copies of this would be two chances for
 * "cast the episode already on screen" to regress on only one of them.
 */
function applyCastCommand(command: CastCommand, router: CastRouter) {
  const params = new URLSearchParams({
    id: command.id,
    source: command.source,
    title: command.title,
    episode: String(command.episode),
  });
  if (command.t > 0) {
    params.set('t', String(command.t));
  }

  const url = `/player?${params.toString()}`;

  // Casting the episode that is already on screen only changes `t`, and a
  // route change alone will not move playback: useVideoPlayer's effect is
  // keyed on [videoId, source], neither of which changed, and `t` is only
  // read once when the player mounts. So seek the element directly and
  // update the URL in place, which is also what makes a later reload
  // resume from the right spot.
  const current = new URLSearchParams(window.location.search);
  const isSameEpisode =
    window.location.pathname === '/player' &&
    current.get('id') === command.id &&
    current.get('source') === command.source &&
    (current.get('episode') ?? '0') === String(command.episode);

  if (isSameEpisode) {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = command.t;
      void video.play().catch(() => {
        // Autoplay can be refused; the seek still happened.
      });
    }
    router.replace(url);
    return;
  }

  router.push(url);
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

        applyCastCommand(command, router);
      } catch {
        // Transient network failure - keep polling, next tick may succeed.
      }
    };

    const startPolling = () => {
      if (intervalId === null) {
        intervalId = setInterval(poll, POLL_INTERVAL_MS);
      }
    };

    // --- push path -------------------------------------------------------

    let socket: WebSocket | null = null;
    let backoff = SOCKET_BACKOFF_START_MS;
    let reconnectId: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    // The socket does not live on this origin: next-on-pages cannot return a
    // 101 upgrade from a Next route handler, so the relay Worker terminates it
    // on its own hostname. A cookie cannot reach a different origin, so the
    // app mints a signed one-minute ticket instead. Every connect attempt
    // fetches a fresh one - reusing a ticket across a backoff would present an
    // expired one and look like an auth failure.
    const openSocket = async () => {
      if (closed || typeof WebSocket === 'undefined') return;

      let endpoint: { url: string; ticket: string };
      try {
        const res = await fetch('/api/cast/ticket');
        if (closed) return;
        if (res.status === 503) {
          startPolling();
          return;
        }
        if (res.status === 401) {
          // Session gone (logged out, or expired mid-session). Ask again later
          // rather than polling the mailbox - the ticket endpoint costs no
          // Redis, so waiting is free and recovery is automatic.
          reconnectId = setTimeout(() => void openSocket(), TICKET_RETRY_WHILE_UNAUTHENTICATED_MS);
          return;
        }
        if (!res.ok) throw new Error(`ticket ${res.status}`);
        endpoint = (await res.json()) as { url: string; ticket: string };
      } catch {
        scheduleReconnect();
        return;
      }

      if (closed) return;

      // Read at connect time, not at mount: renaming the TV in settings then
      // takes effect on the next reconnect rather than needing a restart.
      const ws = new WebSocket(
        `${endpoint.url}?ticket=${encodeURIComponent(endpoint.ticket)}`
        + `&name=${encodeURIComponent(readTvName())}`
      );
      socket = ws;

      ws.onopen = () => {
        // Only a connection that actually opened may reset the backoff.
        // Resetting it in onclose would turn a server that accepts and then
        // immediately drops us into a tight reconnect loop.
        backoff = SOCKET_BACKOFF_START_MS;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as {
            type?: string;
            command?: CastCommand;
          };
          if (data.type !== 'cast' || !data.command) return;

          // Unlike the mailbox, a pushed command is always live, so there is
          // no first-message-is-stale case to skip here. The timestamp check
          // stays only to drop a duplicate if both paths ever deliver the
          // same command.
          if (data.command.ts <= lastTsRef.current) return;
          lastTsRef.current = data.command.ts;

          applyCastCommand(data.command, router);
        } catch {
          // Malformed frame - ignore it rather than tearing down the socket.
        }
      };

      ws.onclose = () => {
        socket = null;
        if (closed) return;
        scheduleReconnect();
      };

      ws.onerror = () => {
        // onclose always follows; the reconnect is handled there.
      };
    };

    // Retries the socket forever rather than ever handing over to polling.
    // Polling is the expensive path: it costs one Redis command every five
    // seconds for as long as the TV is awake, which on a set that stays on all
    // month is more commands than the free tier allows. A socket that keeps
    // failing costs one attempt per backoff interval and no Redis at all, so
    // retrying is both cheaper and self-healing - the moment the network comes
    // back, casting works again without a reload.
    const scheduleReconnect = () => {
      reconnectId = setTimeout(() => void openSocket(), backoff);
      backoff = Math.min(backoff * 2, SOCKET_BACKOFF_MAX_MS);
    };

    // Asking for a ticket first tells the two "no socket" cases apart, which
    // the WebSocket API itself cannot: 503 means this deployment has no relay
    // configured (poll forever), 401 means nobody has logged in yet. Guessing
    // from a failed handshake instead would make an unconfigured deployment
    // retry the socket for the life of the page.
    const chooseTransport = async () => {
      // A browser with no WebSocket at all is the one case that still needs
      // the mailbox; everything else uses the socket or waits for it.
      if (typeof WebSocket === 'undefined') {
        startPolling();
        return;
      }

      try {
        const res = await fetch('/api/cast/ticket');
        if (closed) return;

        if (res.status === 503) {
          startPolling();
          return;
        }

        if (res.status === 401) {
          reconnectId = setTimeout(() => void openSocket(), TICKET_RETRY_WHILE_UNAUTHENTICATED_MS);
          return;
        }

        void openSocket();
      } catch {
        // A failed fetch here is a network blip, not a verdict on the
        // deployment. Retrying keeps a momentary outage from pinning the TV to
        // the Redis path for the rest of the session.
        scheduleReconnect();
      }
    };

    // A TV WebView drops sockets when the screen sleeps or the user switches
    // apps. Coming back visible is the moment to re-establish, rather than
    // waiting out whatever backoff was in flight.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (closed || socket !== null || intervalId !== null) return;
      backoff = SOCKET_BACKOFF_START_MS;
      if (reconnectId !== null) {
        clearTimeout(reconnectId);
        reconnectId = null;
      }
      void openSocket();
    };

    document.addEventListener('visibilitychange', onVisible);
    void chooseTransport();

    return () => {
      closed = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (reconnectId !== null) clearTimeout(reconnectId);
      if (socket !== null) socket.close();
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [isTvLike, router]);

  return null;
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHistory } from '@/lib/store/history-store';
import { useTvFocus } from '@/lib/tv/TvFocusProvider';
import type { VideoHistoryItem } from '@/lib/types';

interface TvHistoryRowProps {
  id: string;
  rowIndex: number;
}

const MAX_ITEMS = 20;
const LONG_PRESS_MS = 800;
// Releasing before this counts as a quick tap and plays. Releasing after it -
// once the delete progress bar is on screen - is treated as the user changing
// their mind, and does nothing at all. Making the tap window end exactly when
// the bar appears is what makes the rule visible: if you can see the bar, you
// have already left tap territory.
const TAP_MS = 250;

interface TvHistoryCardProps {
  item: VideoHistoryItem;
  onSelect: (item: VideoHistoryItem) => void;
  onDelete: (item: VideoHistoryItem) => void;
  setRef: (el: HTMLButtonElement | null) => void;
}

/**
 * One card owns its own image-error flag so a single dead scraper-site
 * poster only blanks out that card, not every card in the row.
 *
 * The card also takes over the Enter key itself (rather than letting the
 * native <button> click-on-keydown behaviour run) so that holding OK can
 * mean "delete" instead of "play". The Android TV shell maps the D-pad
 * centre button to KEYCODE_ENTER and dispatches both ACTION_DOWN and
 * ACTION_UP, so keydown/keyup timing is reliable here. All of the
 * setState calls below happen inside event handlers or a setTimeout
 * callback, never synchronously in a useEffect body.
 */
function TvHistoryCard({ item, onSelect, onDelete, setRef }: TvHistoryCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [pressToken, setPressToken] = useState(0);

  // Timer for the pending long-press delete, and a flag so the keyup that
  // follows a fired long-press doesn't also trigger a short-press select.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef(0);
  const longPressFiredRef = useRef(false);

  const clearPressTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (tapTimerRef.current !== null) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
  };

  // Never leave a timer running past the card's lifetime.
  useEffect(() => clearPressTimer, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter') return;

    // Stop the native click-on-keydown behaviour every time Enter fires for
    // this button, including auto-repeats - otherwise a held key would keep
    // re-triggering play on every repeat while the delete timer is running.
    event.preventDefault();

    // `event.repeat` cannot be trusted here. The Android shell forwards the
    // D-pad centre button by constructing a brand new KeyEvent for every
    // auto-repeat:
    //
    //   webView.dispatchKeyEvent(KeyEvent(ACTION_DOWN, KEYCODE_ENTER))
    //
    // That constructor sets repeatCount to 0, so every repeat reaches the page
    // looking like a fresh press with `repeat === false`. Relying on it meant a
    // held key restarted the timer on every repeat, so the progress bar reset
    // partway and the delete never fired - releasing then behaved as a short
    // press and started playback instead.
    //
    // A press already in flight is the reliable signal, so use that instead.
    if (timerRef.current !== null || longPressFiredRef.current) return;

    longPressFiredRef.current = false;
    pressStartRef.current = Date.now();

    clearPressTimer();

    // The bar only appears once the tap window has passed, so a quick tap never
    // flashes it and a visible bar always means "releasing now does nothing".
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      setIsPressing(true);
      setPressToken((token) => token + 1);
    }, TAP_MS);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      longPressFiredRef.current = true;
      setIsPressing(false);
      onDelete(item);
    }, LONG_PRESS_MS);
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter') return;

    const wasLongPress = longPressFiredRef.current;
    const heldFor = Date.now() - pressStartRef.current;
    clearPressTimer();
    setIsPressing(false);

    // Long press already deleted, or the user held past the tap window and then
    // let go - an abandoned delete, which should do nothing rather than fall
    // through to playing something they did not ask for.
    if (wasLongPress || heldFor >= TAP_MS) return;

    onSelect(item);
  };

  const handleBlur = () => {
    clearPressTimer();
    setIsPressing(false);
    setIsFocused(false);
  };

  const showEpisode = item.episodes && item.episodes.length > 1;
  const showProgress = item.duration > 0;
  const progressPct = showProgress
    ? Math.min(100, Math.max(0, (item.playbackPosition / item.duration) * 100))
    : 0;

  return (
    <button
      ref={setRef}
      type="button"
      tabIndex={-1}
      className="tv-focusable flex-shrink-0 w-[148px] text-left"
      onClick={() => onSelect(item)}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
    >
      <div className="relative w-[148px] h-[208px] rounded-[10px] overflow-hidden bg-[#252b36]">
        {item.poster && !imageError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : null}
        {showEpisode ? (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[13px] text-amber-300">
            第 {item.episodeIndex + 1} 集
          </span>
        ) : null}
        {isFocused ? (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[13px] text-[#e8eaed]">
            长按 OK 删除
          </span>
        ) : null}
        {showProgress ? (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/40">
            <div
              className="h-full bg-[#3b82f6]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        ) : null}
        {isPressing ? (
          <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-black/40">
            <div key={pressToken} className="tv-history-delete-progress h-full bg-red-500" />
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-[15px] leading-tight line-clamp-2">{item.title}</p>
    </button>
  );
}

export function TvHistoryRow({ id, rowIndex }: TvHistoryRowProps) {
  const router = useRouter();
  const { registerRow, unregisterRow, setItemElement } = useTvFocus();
  const { viewingHistory, removeFromHistory } = useHistory(false);

  // viewingHistory is already kept sorted newest-first by the store
  // (addToHistory unshifts, migrateHistory sorts descending by timestamp),
  // so no re-sort is needed here - just take the first MAX_ITEMS.
  const items = useMemo(() => viewingHistory.slice(0, MAX_ITEMS), [viewingHistory]);

  // No history means no row at all - length 0 makes the focus model skip it.
  const length = items.length;

  useEffect(() => {
    registerRow(id, rowIndex, length);
    return () => unregisterRow(id);
  }, [id, rowIndex, length, registerRow, unregisterRow]);

  if (items.length === 0) return null;

  const handleSelect = (item: VideoHistoryItem) => {
    const params = new URLSearchParams();
    params.set('id', String(item.videoId));
    params.set('source', item.source);
    params.set('title', item.title);
    params.set('episode', String(item.episodeIndex));
    router.push(`/player?${params.toString()}`);
  };

  const handleDelete = (item: VideoHistoryItem) => {
    removeFromHistory(item.showIdentifier);
  };

  return (
    <section>
      <h2 className="tv-row-title">继续观看</h2>
      <div className="tv-row-strip">
        {items.map((item, index) => (
          <TvHistoryCard
            key={item.showIdentifier}
            item={item}
            onSelect={handleSelect}
            onDelete={handleDelete}
            setRef={(el) => setItemElement(id, index, el)}
          />
        ))}
      </div>
    </section>
  );
}

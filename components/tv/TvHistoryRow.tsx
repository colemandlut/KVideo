'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHistory } from '@/lib/store/history-store';
import { useTvFocus } from '@/lib/tv/TvFocusProvider';
import { useTvLongPressOk } from '@/lib/tv/useTvLongPressOk';
import type { VideoHistoryItem } from '@/lib/types';

interface TvHistoryRowProps {
  id: string;
  rowIndex: number;
}

const MAX_ITEMS = 20;

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
 *
 * The hold-to-delete gesture itself lives in the shared
 * `useTvLongPressOk` hook (lib/tv/useTvLongPressOk.ts) so TvFavorites can
 * reuse the exact same tap-window / long-press behaviour instead of forking
 * it.
 */
function TvHistoryCard({ item, onSelect, onDelete, setRef }: TvHistoryCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const { isPressing, pressToken, handleKeyDown, handleKeyUp, handleBlur: handlePressBlur } =
    useTvLongPressOk({ item, onSelect, onLongPress: onDelete });

  const handleBlur = () => {
    handlePressBlur();
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

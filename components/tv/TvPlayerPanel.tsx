'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsTvLike } from '@/lib/hooks/mobile/useDeviceDetection';
import { useFavorites } from '@/lib/store/favorites-store';
import { clampFocus, moveFocus, type TvDirection, type TvFocusPos, type TvRowMeta } from '@/lib/tv/focus-model';
import type { SourceInfo } from '@/components/player/EpisodeList';

interface PanelEpisode {
  name?: string;
  url: string;
}

interface TvPlayerPanelProps {
  // Identity of the video currently playing - used only to detect that it
  // changed underneath an open panel (e.g. a cast arriving mid-browse), not
  // rendered directly.
  videoId: string | null;
  source: string | null;
  episodes: PanelEpisode[] | null;
  currentEpisode: number;
  onEpisodeSelect: (episode: PanelEpisode, index: number) => void;
  sources: SourceInfo[];
  currentSourceId: string;
  onSourceChange: (source: SourceInfo) => void;
  // What the favourites store needs to record this video, mirroring what
  // app/player/page.tsx hands the phone/desktop FavoriteButton. `sourceMap`
  // is not among them: it is derived below from `sources`/`videoId`/`source`,
  // which this panel already receives. A null `title` means the metadata
  // hasn't arrived yet, and the 收藏 row is left out until it does.
  title: string | null;
  poster?: string;
  type?: string;
  year?: string;
  isPremium?: boolean;
}

const KEY_TO_DIRECTION: Record<string, TvDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

// Row order inside the sheet, top to bottom. 收藏 sits above 选集 because it
// acts on the whole video rather than on what is playing right now, and
// because the sheet scrolls: a long episode strip would push a trailing
// action row off the bottom of the 70vh panel, where a remote user would
// never find it.
const FAVORITE_ROW = 0;
const EPISODES_ROW = 1;
const SOURCES_ROW = 2;

/**
 * TV-only remote-navigable overlay for favouriting the video, picking an
 * episode or switching source while it plays. It is the only place in the TV
 * UI that can add a favourite - the heart button the phone and desktop use
 * lives on the player page's sidebar, which a TV never renders.
 *
 * Deliberately does NOT use useTvKeys/TvFocusProvider: those and
 * useDesktopShortcuts both listen on `window` in the bubble phase, and there
 * is no way to let one through while blocking the other. Instead this
 * component owns a single capture-phase `keydown` listener, so it can
 * unconditionally win the race against the player's bubble-phase shortcuts
 * (capture always runs before bubble on the same target) and explicitly
 * decide, key by key, whether the player should also see the event.
 */
export function TvPlayerPanel({
  videoId,
  source,
  episodes,
  currentEpisode,
  onEpisodeSelect,
  sources,
  currentSourceId,
  onSourceChange,
  title,
  poster,
  type,
  year,
  isPremium = false,
}: TvPlayerPanelProps) {
  const isTvLike = useIsTvLike();
  const { favorites, toggleFavorite } = useFavorites(isPremium);

  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<TvFocusPos>({ rowIndex: 0, itemIndex: 0 });

  const favoriteRef = useRef<HTMLButtonElement | null>(null);
  const episodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sourceRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close the panel (and reset its position) the moment the video it's
  // describing changes underneath it - e.g. TvCastReceiver navigating the
  // player to a different id/source while the panel is open. At that point
  // the episode/source lists on screen belong to a video that's no longer
  // playing, and a stale `pos` could point past the end of the new lists
  // (moveFocus only special-cases a row that's now fully empty, not one
  // that merely shrank below the old itemIndex). Closing sidesteps both
  // problems at once, and is simpler than re-clamping a menu that no
  // longer describes anything real.
  //
  // This adjusts state during render (React's documented pattern - see also
  // TvHome.tsx's `maxRowReached`) rather than in a useEffect. A ref-guarded
  // conditional setState inside a useEffect body was tried first, but
  // react-hooks/set-state-in-effect flags it regardless: its exemption for
  // ref-derived values only covers a setState call whose *argument* is
  // derived from a ref, not one whose surrounding `if` is - so a
  // `useEffect(() => { if (prevRef.current !== key) setIsOpen(false); ... })`
  // still errors here. The render-time form has no such gap.
  const videoKey = `${videoId ?? ''}:${source ?? ''}`;
  const [trackedVideoKey, setTrackedVideoKey] = useState(videoKey);
  if (videoKey !== trackedVideoKey) {
    setTrackedVideoKey(videoKey);
    setIsOpen(false);
    setPos({ rowIndex: 0, itemIndex: 0 });
  }

  const episodeList = useMemo(() => episodes ?? [], [episodes]);

  // The record handed to the store on toggle. Null until the video has both
  // an identity and a name, which is also what gates the 收藏 row's presence:
  // a favourite with no title renders as a blank card on every favourites
  // screen, so it's better not to offer the action at all yet.
  //
  // sourceMap reproduces what the FavoriteButton on the phone player is
  // given - the whole grouped-source set, falling back to just this video
  // when nothing was grouped - so that a favourite added here can still
  // switch source later. It is derived rather than passed in so the object
  // identity is stable across parent renders; an inline map from the call
  // site would re-register the capture-phase listener below on every render
  // of the player page.
  const favoriteItem = useMemo(() => {
    if (!videoId || !source || !title) return null;
    const entries = sources.length > 0 ? sources : [{ source, id: videoId }];
    return {
      videoId,
      source,
      title,
      poster,
      type,
      year,
      sourceMap: Object.fromEntries(entries.map((item) => [item.source, item.id])),
    };
  }, [videoId, source, title, poster, type, year, sources]);

  // Derived from the `favorites` array rather than from the store's own
  // isFavorite() getter: that getter reads through zustand's get(), so its
  // arguments and identity are unchanged by a toggle and memoisation would
  // happily serve a stale answer. The array is what actually changes.
  // String() matches the store's `${source}:${videoId}` key, which treats a
  // numeric and a string id as the same video.
  const isFavorited = useMemo(() => (
    favoriteItem !== null && favorites.some(
      (item) => item.source === favoriteItem.source && String(item.videoId) === String(favoriteItem.videoId)
    )
  ), [favorites, favoriteItem]);

  // Row 0 is the 收藏 toggle, row 1 the episode strip, row 2 the source strip
  // - kept even when a row is empty (length 0) so moveFocus's own
  // skip-empty-row logic is what decides whether it's reachable, rather than
  // us special-casing it here. keepColumn stays at its default (false/unset):
  // the rows are independently horizontally-scrolling strips, so crossing
  // between them should land on the first item, matching the home screen.
  const rows = useMemo<TvRowMeta[]>(() => [
    { id: 'favorite', length: favoriteItem ? 1 : 0 },
    { id: 'episodes', length: episodeList.length },
    { id: 'sources', length: sources.length, keepColumn: false },
  ], [favoriteItem, episodeList.length, sources.length]);

  const getElement = useCallback((target: TvFocusPos): HTMLButtonElement | null => {
    const row = rows[target.rowIndex];
    if (!row) return null;
    if (row.id === 'favorite') return favoriteRef.current;
    const refs = row.id === 'episodes' ? episodeRefs.current : sourceRefs.current;
    return refs[target.itemIndex] ?? null;
  }, [rows]);

  const selectAt = useCallback((target: TvFocusPos) => {
    const row = rows[target.rowIndex];
    if (!row) return;

    if (row.id === 'favorite') {
      if (favoriteItem) toggleFavorite(favoriteItem);
      // Deliberately leaves the panel open, unlike every other row here: the
      // button's own fill is the whole confirmation that the toggle landed,
      // and closing would take it away in the same frame it appeared.
      return;
    }

    if (row.id === 'episodes') {
      const episode = episodeList[target.itemIndex];
      if (episode) onEpisodeSelect(episode, target.itemIndex);
    } else if (row.id === 'sources') {
      const source = sources[target.itemIndex];
      if (source) onSourceChange(source);
    }
    setIsOpen(false);
  }, [rows, episodeList, sources, onEpisodeSelect, onSourceChange, favoriteItem, toggleFavorite]);

  // Single capture-phase listener. Registered only while this panel is
  // relevant (TV-like devices); phones and desktops never attach it.
  useEffect(() => {
    if (!isTvLike) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) {
        if (event.key !== 'ArrowDown') return;
        // The player currently maps Up/Down to volume, which a TV remote
        // doesn't need (it has its own volume buttons) - Down is free to
        // open the panel instead. Stop it here so volume doesn't also change.
        event.preventDefault();
        event.stopPropagation();
        setPos(clampFocus(rows, { rowIndex: EPISODES_ROW, itemIndex: currentEpisode }));
        setIsOpen(true);
        return;
      }

      switch (event.key) {
        case 'Escape':
        case 'Backspace':
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          return;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          event.preventDefault();
          event.stopPropagation();
          const direction = KEY_TO_DIRECTION[event.key];
          const next = moveFocus(rows, pos, direction);
          // Up off the top of the sheet dismisses it - the mirror image of
          // the Down that opened it. Asking moveFocus whether it could go up
          // at all, instead of naming the top row, keeps that gesture working
          // no matter which rows happen to be empty: with no title yet the
          // 收藏 row registers length 0, and the topmost *reachable* row is
          // then 选集 again, exactly as before this row existed.
          if (direction === 'up' && next.rowIndex === pos.rowIndex) {
            setIsOpen(false);
            return;
          }
          setPos(next);
          return;
        }
        case 'Enter':
          event.preventDefault();
          event.stopPropagation();
          selectAt(pos);
          return;
        default:
          // Leave every other key alone - e.g. 'm' for mute should still
          // reach the player's own shortcut handling while the panel is open.
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isTvLike, isOpen, pos, rows, currentEpisode, selectAt]);

  // Move real DOM focus (and scroll it into view) whenever the panel opens
  // or the position changes. Kept separate from the keydown handler above so
  // opening the panel (which mounts the strip's buttons for the first time)
  // and moving within it both funnel through one place.
  useEffect(() => {
    if (!isOpen) return;
    const element = getElement(pos);
    if (!element) return;
    element.focus({ preventScroll: true });
    // Instant, not smooth - smooth scrolling silently no-ops in some WebView
    // configurations (see lib/tv/useTvKeys.ts for where that was diagnosed).
    element.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' });
  }, [isOpen, pos, getElement]);

  if (!isTvLike || !isOpen) return null;

  return (
    // NOTE: deliberately not `.tv-root` - that class's `::before` paints a
    // fixed, full-viewport opaque backdrop (see app/styles/tv.css), meant
    // for the standalone TV home screen. Reusing it here would black out
    // the whole screen instead of showing a bottom sheet over the video.
    <div className="fixed inset-x-0 bottom-0 z-[2147483647]">
      <div className="bg-black/85 backdrop-blur-md px-8 pt-6 pb-8 max-h-[70vh] overflow-y-auto">
        {favoriteItem && (
          // No heading above this one, unlike the two strips below: a lone
          // action pill reads as its own label, the way the home screen's
          // top bar does.
          <div className="tv-row-strip !px-0 !pt-0">
            <button
              ref={favoriteRef}
              type="button"
              tabIndex={-1}
              // Selected state is the fill, not the focus ring, so it stays
              // readable after focus moves on - the same pairing the home
              // screen's top bar uses for its selected tab.
              className={`tv-focusable flex-shrink-0 px-7 py-3 rounded-full text-[16px] ${
                isFavorited ? 'bg-[#3b82f6]' : 'bg-[#252b36]'
              }`}
              aria-pressed={isFavorited}
              aria-label={isFavorited ? '取消收藏' : '收藏'}
              onClick={() => selectAt({ rowIndex: FAVORITE_ROW, itemIndex: 0 })}
            >
              {isFavorited ? '已收藏' : '收藏'}
            </button>
          </div>
        )}

        <section>
          <h2 className="tv-row-title text-white/90">选集</h2>
          <div className="tv-row-strip !px-0">
            {episodeList.map((episode, index) => {
              const isCurrent = index === currentEpisode;
              return (
                <button
                  key={`${episode.url}-${index}`}
                  ref={(el) => { episodeRefs.current[index] = el; }}
                  type="button"
                  tabIndex={-1}
                  className={`tv-focusable flex-shrink-0 min-w-[64px] px-4 py-3 rounded-[10px] text-[15px] ${
                    isCurrent ? 'bg-blue-600 text-white font-semibold ring-2 ring-blue-300' : 'bg-white/10 text-white/85'
                  }`}
                  onClick={() => selectAt({ rowIndex: EPISODES_ROW, itemIndex: index })}
                >
                  {episode.name || `第${index + 1}集`}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="tv-row-title text-white/90">线路</h2>
          <div className="tv-row-strip !px-0">
            {sources.map((source, index) => {
              const isCurrent = source.source === currentSourceId;
              return (
                <button
                  key={source.source}
                  ref={(el) => { sourceRefs.current[index] = el; }}
                  type="button"
                  tabIndex={-1}
                  className={`tv-focusable flex-shrink-0 px-5 py-3 rounded-[10px] text-[15px] ${
                    isCurrent ? 'bg-blue-600 text-white font-semibold ring-2 ring-blue-300' : 'bg-white/10 text-white/85'
                  }`}
                  onClick={() => selectAt({ rowIndex: SOURCES_ROW, itemIndex: index })}
                >
                  {source.sourceName || source.source}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

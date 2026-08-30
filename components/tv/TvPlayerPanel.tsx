'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsTvLike } from '@/lib/hooks/mobile/useDeviceDetection';
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
}

const KEY_TO_DIRECTION: Record<string, TvDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const EPISODES_ROW = 0;

/**
 * TV-only remote-navigable overlay for picking an episode or switching
 * source while a video plays.
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
}: TvPlayerPanelProps) {
  const isTvLike = useIsTvLike();

  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<TvFocusPos>({ rowIndex: 0, itemIndex: 0 });

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

  // Row 0 is always the episode strip, row 1 the source strip - kept even
  // when a row is empty (length 0) so moveFocus's own skip-empty-row logic
  // is what decides whether it's reachable, rather than us special-casing it
  // here. keepColumn stays at its default (false/unset): both rows are
  // independently horizontally-scrolling strips, so crossing between them
  // should land on the first item, matching the home screen.
  const rows = useMemo<TvRowMeta[]>(() => [
    { id: 'episodes', length: episodeList.length },
    { id: 'sources', length: sources.length, keepColumn: false },
  ], [episodeList.length, sources.length]);

  const getElement = useCallback((target: TvFocusPos): HTMLButtonElement | null => {
    const row = rows[target.rowIndex];
    if (!row) return null;
    const refs = row.id === 'episodes' ? episodeRefs.current : sourceRefs.current;
    return refs[target.itemIndex] ?? null;
  }, [rows]);

  const selectAt = useCallback((target: TvFocusPos) => {
    const row = rows[target.rowIndex];
    if (!row) return;

    if (row.id === 'episodes') {
      const episode = episodeList[target.itemIndex];
      if (episode) onEpisodeSelect(episode, target.itemIndex);
    } else if (row.id === 'sources') {
      const source = sources[target.itemIndex];
      if (source) onSourceChange(source);
    }
    setIsOpen(false);
  }, [rows, episodeList, sources, onEpisodeSelect, onSourceChange]);

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
          if (direction === 'up' && pos.rowIndex === EPISODES_ROW) {
            setIsOpen(false);
            return;
          }
          setPos(moveFocus(rows, pos, direction));
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
                  onClick={() => selectAt({ rowIndex: 1, itemIndex: index })}
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

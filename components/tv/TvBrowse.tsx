'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TvFocusProvider, useTvFocus } from '@/lib/tv/TvFocusProvider';
import { useTvKeys } from '@/lib/tv/useTvKeys';
import { isAtRowEnd } from '@/lib/tv/focus-model';
import {
  BROWSE_COUNTRIES,
  BROWSE_GENRES,
  BROWSE_PAGE_SIZE,
  BROWSE_SORTS,
  BROWSE_TYPES,
  BROWSE_YEARS,
  DEFAULT_BROWSE_SELECTION,
  buildBrowseQuery,
  type BrowseContentType,
  type BrowseFilterOption,
  type BrowseSelection,
} from '@/lib/tv/browse-filters';
import { TvPosterCard, type TvMovie } from './TvPosterCard';

/** Same five columns as TvSearchResults / TvFavorites - the only grid width
 *  the poster size and the 960px TV viewport both agree on. */
const COLUMNS = 5;

/** Visual row order. The five filter rows always register a non-empty row, so
 *  there is always somewhere for focus to be even when the grid is empty -
 *  a page with no focusable element is a remote-control dead end. */
const ROW = {
  topbar: 0,
  genre: 1,
  country: 2,
  year: 3,
  sort: 4,
} as const;

const ROW_GRID_START = 5;

/** Exactly one component may own the registration for a given row id - a
 *  second owner's effect cleanup would delete the first one's entry,
 *  including the element table its ref callbacks just populated. Mirrors
 *  TvSearchResults / TvFavorites / TvSettings. */
function useRowRegistration(id: string, rowIndex: number, length: number, keepColumn?: boolean) {
  const { registerRow, unregisterRow } = useTvFocus();

  useEffect(() => {
    registerRow(id, rowIndex, length, keepColumn);
    return () => unregisterRow(id);
  }, [id, rowIndex, length, keepColumn, registerRow, unregisterRow]);
}

interface TopbarRowProps {
  contentType: BrowseContentType;
  onContentTypeChange: (type: BrowseContentType) => void;
  onBack: () => void;
}

/** 返回 shares the row with the 电影/电视剧 pair rather than taking a row of
 *  its own: five filter rows plus a grid is already a long way down at 540
 *  CSS px, and folding the exit into row 0 keeps it one press from where
 *  focus starts. */
function TopbarRow({ contentType, onContentTypeChange, onBack }: TopbarRowProps) {
  const { setItemElement } = useTvFocus();

  const actions = [
    { label: '返回', onClick: onBack, selected: false },
    ...BROWSE_TYPES.map((type) => ({
      label: type.label,
      onClick: () => onContentTypeChange(type.value as BrowseContentType),
      selected: contentType === type.value,
    })),
  ];
  // Derived from the list itself so the registered length can never drift out
  // of sync with the buttons actually rendered below.
  useRowRegistration('browse-topbar', ROW.topbar, actions.length);

  return (
    <div className="tv-row-strip pt-6">
      {actions.map((action, index) => (
        <button
          key={action.label}
          ref={(el) => setItemElement('browse-topbar', index, el)}
          type="button"
          tabIndex={-1}
          className={`tv-focusable flex-shrink-0 px-7 py-3 rounded-full text-[16px] ${
            action.selected ? 'bg-[#3b82f6]' : 'bg-[#252b36]'
          }`}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

interface FilterRowProps {
  id: string;
  rowIndex: number;
  label: string;
  options: readonly BrowseFilterOption[];
  value: string;
  onChange: (value: string) => void;
}

/** One horizontal pill strip. Selected state is a filled background rather
 *  than anything focus-derived, same as TvSettings' OptionRow and TvHome's
 *  topbar, so the four current filter values stay readable while focus is
 *  down in the grid. */
function FilterRow({ id, rowIndex, label, options, value, onChange }: FilterRowProps) {
  const { setItemElement } = useTvFocus();
  useRowRegistration(id, rowIndex, options.length);

  return (
    <div className="flex items-center">
      <span className="w-[92px] shrink-0 pl-8 text-[15px] text-[#9aa0a6]">{label}</span>
      <div className="tv-filter-strip">
        {options.map((option, index) => (
          <button
            key={option.label}
            ref={(el) => setItemElement(id, index, el)}
            type="button"
            tabIndex={-1}
            className={`tv-focusable flex-shrink-0 px-5 py-2 rounded-full text-[15px] ${
              option.value === value ? 'bg-[#3b82f6] text-white' : 'bg-[#252b36] text-[#e8eaed]'
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TvBrowseGridRowProps {
  rowIndex: number;
  movies: TvMovie[];
  onSelect: (movie: TvMovie) => void;
}

/** One grid row of up to COLUMNS posters. `keepColumn: true` because this is a
 *  grid, not an independently-scrolling carousel - up/down must keep the
 *  column, matching TvSearchResults' TvResultRow. */
function TvBrowseGridRow({ rowIndex, movies, onSelect }: TvBrowseGridRowProps) {
  const { setItemElement } = useTvFocus();
  const id = `browse-${rowIndex}`;
  useRowRegistration(id, rowIndex, movies.length, true);

  return (
    <div className="tv-row-strip">
      {movies.map((movie, index) => (
        <TvPosterCard
          key={movie.id}
          movie={movie}
          onSelect={onSelect}
          ref={(el) => setItemElement(id, index, el)}
        />
      ))}
    </div>
  );
}

interface BrowseResults {
  /** The selection these results belong to. Compared by identity against the
   *  live selection to detect "the user changed a filter" during render, and
   *  again inside the fetch to drop a response whose filters are gone. */
  selection: BrowseSelection;
  /** Highest page requested. */
  page: number;
  /** Highest page whose response landed; -1 before the first one. */
  loadedPage: number;
  subjects: TvMovie[];
  hasMore: boolean;
  failed: boolean;
}

function initialResults(selection: BrowseSelection): BrowseResults {
  return { selection, page: 0, loadedPage: -1, subjects: [], hasMore: true, failed: false };
}

/**
 * One page of `/api/douban/filter` per (selection, page) pair.
 *
 * `wantMore` is the paging gesture, passed in rather than watched here: the
 * caller sets it when focus reaches the last card of the last row. The page
 * bump happens during render (React's "adjust state during render" pattern,
 * same as TvHome's maxRowReached) because doing it from an effect would be a
 * synchronous setState in useEffect. It converges because bumping `page` past
 * `loadedPage` immediately makes `pending` true, which closes the guard until
 * the next response lands - and then `registeredCards` holds it closed for the
 * one commit it takes the new rows to register.
 */
function useBrowseResults(selection: BrowseSelection, wantMore: boolean, registeredCards: number) {
  const [results, setResults] = useState<BrowseResults>(() => initialResults(selection));

  if (results.selection !== selection) {
    // A new selection is a new list, not more of the old one: drop the
    // subjects too, so a filter change never leaves the previous list on
    // screen under the new pills.
    setResults(initialResults(selection));
  } else if (
    wantMore
    && results.hasMore
    && results.loadedPage >= results.page
    // Only once the focus model has caught up with the cards on screen: until
    // then `wantMore` is still describing the grid as it was before the last
    // page landed, and acting on it would request page after page from a
    // single keypress.
    && registeredCards === results.subjects.length
  ) {
    setResults({ ...results, page: results.page + 1 });
  }

  const { selection: activeSelection, page } = results;
  const pending = results.loadedPage < results.page;

  useEffect(() => {
    // Every setState below sits inside this nested async function rather than
    // in the effect body, matching TvHome's tag loader.
    const loadPage = async () => {
      try {
        const query = buildBrowseQuery(activeSelection, page * BROWSE_PAGE_SIZE);
        const response = await fetch(`/api/douban/filter?${query}`);
        if (!response.ok) throw new Error(`Douban filter route returned ${response.status}`);

        const data = await response.json();
        const subjects: TvMovie[] = Array.isArray(data.subjects) ? data.subjects : [];

        setResults((prev) => {
          // The functional update is what makes a stale response harmless: by
          // the time it lands, `prev` may already belong to a different
          // selection or a later page, and then it is simply not ours.
          if (prev.selection !== activeSelection || prev.page !== page) return prev;
          return {
            ...prev,
            loadedPage: page,
            subjects: page === 0 ? subjects : [...prev.subjects, ...subjects],
            // Douban's explore endpoint always fills a page when more exist,
            // so a short page is the end of the list.
            hasMore: subjects.length === BROWSE_PAGE_SIZE,
            failed: false,
          };
        });
      } catch (error) {
        console.error('Fetch tv browse results error:', error);
        setResults((prev) => {
          if (prev.selection !== activeSelection || prev.page !== page) return prev;
          // Marking the page loaded clears `pending`, so the failure shows as
          // a message instead of an endless "正在加载…"; hasMore false stops
          // the end-of-row gesture from retrying on every keypress.
          return { ...prev, loadedPage: page, hasMore: false, failed: true };
        });
      }
    };

    loadPage();
  }, [activeSelection, page]);

  return { subjects: results.subjects, pending, failed: results.failed };
}

function TvBrowseContent() {
  const router = useRouter();
  const { rows, pos } = useTvFocus();
  useTvKeys(true);

  const [selection, setSelection] = useState<BrowseSelection>(DEFAULT_BROWSE_SELECTION);

  // The last registered row is the last grid row whenever the grid has any
  // rows at all, so this is "focus is on the very last card" - the same
  // walked-to-the-end signal `isAtRowEnd` was added for, rather than a new
  // gesture the user would have to be taught.
  const atLastCard = rows.length > ROW_GRID_START
    && pos.rowIndex === rows.length - 1
    && isAtRowEnd(rows, pos);

  // How many cards the focus model currently knows about. Rows register from
  // an effect, so for one commit after a page lands the model still describes
  // the shorter grid - and `atLastCard` is still true of it. Measured: without
  // this, one press at the end of the grid loaded three pages instead of one.
  const registeredCards = rows
    .slice(ROW_GRID_START)
    .reduce((total, row) => total + row.length, 0);

  const { subjects, pending, failed } = useBrowseResults(selection, atLastCard, registeredCards);

  const chunks = useMemo(() => {
    const out: TvMovie[][] = [];
    for (let i = 0; i < subjects.length; i += COLUMNS) {
      out.push(subjects.slice(i, i + COLUMNS));
    }
    return out;
  }, [subjects]);

  // Re-pressing the pill that is already selected must keep the same selection
  // object: its identity is what tells useBrowseResults the filters changed,
  // and a needless refetch would blank the grid out from under the user.
  const updateSelection = useCallback(
    <K extends keyof BrowseSelection>(key: K, value: BrowseSelection[K]) => {
      setSelection((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
    },
    []
  );

  const handleBack = useCallback(() => {
    router.push('/');
  }, [router]);

  // A Douban subject carries no source and no vod_id, and /player treats
  // either being missing as a fatal error - so a poster cannot open the player
  // directly. Hand the title to the home screen's search instead, exactly as
  // TvHome does for its own Douban rows; the search results there are what
  // finally push /player?id=&source=&title=.
  const handleSelect = useCallback((movie: TvMovie) => {
    router.push(`/?q=${encodeURIComponent(movie.title)}`);
  }, [router]);

  const showEmpty = !pending && !failed && subjects.length === 0;

  return (
    <div className="tv-root min-h-screen bg-[#0f1218] text-[#e8eaed]">
      <TopbarRow
        contentType={selection.type}
        onContentTypeChange={(type) => updateSelection('type', type)}
        onBack={handleBack}
      />

      <FilterRow
        id="browse-genre"
        rowIndex={ROW.genre}
        label="类型"
        options={BROWSE_GENRES}
        value={selection.genre}
        onChange={(genre) => updateSelection('genre', genre)}
      />
      <FilterRow
        id="browse-country"
        rowIndex={ROW.country}
        label="地区"
        options={BROWSE_COUNTRIES}
        value={selection.country}
        onChange={(country) => updateSelection('country', country)}
      />
      <FilterRow
        id="browse-year"
        rowIndex={ROW.year}
        label="年代"
        options={BROWSE_YEARS}
        value={selection.yearRange}
        onChange={(yearRange) => updateSelection('yearRange', yearRange)}
      />
      <FilterRow
        id="browse-sort"
        rowIndex={ROW.sort}
        label="排序"
        options={BROWSE_SORTS}
        value={selection.sort}
        onChange={(sort) => updateSelection('sort', sort)}
      />

      {chunks.map((movies, index) => (
        <TvBrowseGridRow
          key={index}
          rowIndex={ROW_GRID_START + index}
          movies={movies}
          onSelect={handleSelect}
        />
      ))}

      {pending && subjects.length === 0 ? (
        <p className="tv-row-title mt-6 text-[#9aa0a6]">正在加载…</p>
      ) : null}

      {/* Kept visible even when some results did arrive: a failed page means
          the list stops here, and silently doing nothing at the end of the
          grid reads as a broken remote. */}
      {failed ? (
        <p className="tv-row-title mt-6 text-[#9aa0a6]">加载失败，请稍后再试</p>
      ) : null}

      {showEmpty ? (
        <p className="tv-row-title mt-6 text-[#9aa0a6]">没有符合条件的结果</p>
      ) : null}
    </div>
  );
}

export function TvBrowse() {
  return (
    <TvFocusProvider>
      <TvBrowseContent />
    </TvFocusProvider>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TvFocusProvider, useTvFocus } from '@/lib/tv/TvFocusProvider';
import { useTvKeys } from '@/lib/tv/useTvKeys';
import { TvRow, type TvTag } from './TvRow';
import { TvCollectionRow } from './TvCollectionRow';
import { TvRecommendRow } from './TvRecommendRow';
import { TvHistoryRow } from './TvHistoryRow';
import { TvSearchResults } from './TvSearchResults';
import type { TvMovie } from './TvPosterCard';
import type { Video } from '@/lib/types';

const FALLBACK_TAGS: TvTag[] = [{ id: '热门', label: '热门', value: '热门' }];

type ContentType = 'movie' | 'tv';

interface ChartRow {
  id: string;
  title: string;
  collectionId: string;
}

/**
 * The Douban charts that sit between 为你推荐 and the tag rows.
 *
 * Both content types get the same three slots, so flipping 电影/电视剧 never
 * moves the rows underneath - a row order that reshuffles under a stationary
 * highlight is disorienting when the only way to look around is the D-pad.
 * The lists behind the slots are per type because 榜单 ids are content
 * specific: leaving movie_top250 mounted while the user is on 电视剧 would
 * quietly serve films under a TV heading.
 */
const CHART_ROWS: Record<ContentType, ChartRow[]> = {
  movie: [
    { id: 'chart-0', title: '豆瓣 Top250', collectionId: 'movie_top250' },
    { id: 'chart-1', title: '正在热映', collectionId: 'movie_showing' },
    { id: 'chart-2', title: '一周口碑榜', collectionId: 'movie_weekly_best' },
  ],
  tv: [
    { id: 'chart-0', title: '近期热门剧集', collectionId: 'tv_hot' },
    { id: 'chart-1', title: '国产剧集榜', collectionId: 'tv_domestic' },
    { id: 'chart-2', title: '近期热门综艺', collectionId: 'show_hot' },
  ],
};

/**
 * Visual row order. Rows register themselves by visual index, so inserting a
 * row here shifts every row below it and every index has to move with it.
 * Both content types contribute the same number of chart rows (see
 * CHART_ROWS), which is what keeps ROW_TAG_START a constant.
 */
const ROW_HISTORY = 1;
const ROW_RECOMMEND = 2;
const ROW_CHART_START = 3;
const ROW_TAG_START = ROW_CHART_START + CHART_ROWS.movie.length;

interface TopbarRowProps {
  contentType: ContentType;
  onContentTypeChange: (type: ContentType) => void;
  onBrowse: () => void;
  onFavorites: () => void;
  onSettings: () => void;
}

function TopbarRow({ contentType, onContentTypeChange, onBrowse, onFavorites, onSettings }: TopbarRowProps) {
  const { registerRow, unregisterRow, setItemElement } = useTvFocus();

  const actions = [
    { label: '电影', onClick: () => onContentTypeChange('movie'), selected: contentType === 'movie' },
    { label: '电视剧', onClick: () => onContentTypeChange('tv'), selected: contentType === 'tv' },
    { label: '分类', onClick: onBrowse, selected: false },
    { label: '收藏', onClick: onFavorites, selected: false },
    { label: '设置', onClick: onSettings, selected: false },
  ];
  // Derived from the list itself so the registered length can never drift out
  // of sync with the buttons actually rendered below.
  const length = actions.length;

  useEffect(() => {
    registerRow('topbar', 0, length);
    return () => unregisterRow('topbar');
  }, [length, registerRow, unregisterRow]);

  return (
    <div className="tv-row-strip pt-6">
      {actions.map((action, index) => (
        <button
          key={action.label}
          ref={(el) => setItemElement('topbar', index, el)}
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

export interface TvHomeProps {
  query: string;
  hasSearched: boolean;
  loading: boolean;
  results: Video[];
  latencies: Record<string, number>;
  onSearch: (query: string) => void;
  onReset: () => void;
}

function TvHomeContent({ query, hasSearched, loading, results, latencies, onSearch, onReset }: TvHomeProps) {
  const router = useRouter();
  const { pos } = useTvFocus();
  useTvKeys(true);

  const [contentType, setContentType] = useState<ContentType>('movie');
  const [tags, setTags] = useState<TvTag[] | null>(null);

  // The Android shell's Back key falls through to a "configure server URL"
  // screen whenever WebView's history.canGoBack() is false - which is the
  // case the instant the app starts, since the WebView has a single history
  // entry and JS cannot intercept the physical Back key. Keep a spare entry
  // in the session history at all times while on the bare TV home route so
  // Back always has somewhere harmless to go instead of quitting out to
  // setup. Re-armed only on the bare `/` route (no `?q=`) - results pages
  // push their own `/?q=...` URL and Back from there must be free to land
  // back on `/` normally.
  //
  // Both the mount-time push and the popstate re-push MUST share this exact
  // predicate. The guard exists solely to keep webView.canGoBack() true at
  // the top level; if either call site pushed unconditionally, a mount that
  // happens to land on a non-home URL (e.g. this component remounting on
  // `/?q=...` after the WebView pops back from /player) would insert a
  // stray same-URL entry, and the user's next Back press would silently
  // consume that entry instead of visibly going anywhere - Back would
  // appear to do nothing.
  useEffect(() => {
    const isBareHome = () =>
      window.location.pathname === '/' && !new URLSearchParams(window.location.search).has('q');

    // NOTE: this writes a plain object into history.state, which is a
    // foreign shape as far as Next's App Router is concerned - it keeps its
    // own bookkeeping (route tree, scroll position, etc.) in that same slot.
    // This is deliberate for now, but if back/forward navigation ever starts
    // behaving oddly (lost scroll restoration, a full reload instead of a
    // soft transition), this is the first place to re-check.
    if (isBareHome()) {
      window.history.pushState({ tvBackGuard: true }, '');
    }

    const handlePopState = () => {
      if (isBareHome()) {
        window.history.pushState({ tvBackGuard: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Refetch the category tag list whenever the selected content type
  // changes - movie and tv use entirely different Douban tag sets. `ignore`
  // guards against a stale response winning a race: if the user flips
  // movie -> tv -> movie quickly, the in-flight request for the wrong type
  // must not overwrite the newer list. All setState calls happen inside the
  // nested async function (before or after its awaits), never directly in
  // the effect body, matching the pattern in useTagManager.ts.
  useEffect(() => {
    let ignore = false;

    const loadTags = async () => {
      setTags(null);
      try {
        const response = await fetch(`/api/douban/tags?type=${contentType}`);
        const data = await response.json();
        if (ignore) return;
        if (Array.isArray(data.tags) && data.tags.length > 0) {
          setTags(data.tags.map((label: string) => ({ id: label, label, value: label })));
        } else {
          setTags(FALLBACK_TAGS);
        }
      } catch (error) {
        console.error('Fetch tv tags error:', error);
        if (!ignore) setTags(FALLBACK_TAGS);
      }
    };

    loadTags();

    return () => {
      ignore = true;
    };
  }, [contentType]);

  // Derived, monotonically-increasing high-water mark of the furthest row
  // reached. Updated during render (not in an effect) so the set of loaded
  // rows only ever grows within a mount - moving focus back up must not
  // unmount already-loaded rows and lose their fetched data.
  const [maxRowReached, setMaxRowReached] = useState(pos.rowIndex);
  if (pos.rowIndex > maxRowReached) {
    setMaxRowReached(pos.rowIndex);
  }

  // Every lazy row from the first chart row down to one row past the furthest
  // row focus has reached. The topmost lazy row always loads so the screen is
  // never all skeletons; the +1 keeps exactly one row of runway ahead of the
  // highlight. Charts and tag rows share this so they load in the visual order
  // the user walks them.
  const loadedThroughRow = Math.max(ROW_CHART_START, maxRowReached + 1);

  const handleSelect = useCallback((movie: TvMovie) => {
    onSearch(movie.title);
  }, [onSearch]);

  // Switching 电影/电视剧 refetches every category row, but if focus stays
  // on the topbar and the page stays scrolled where it was, nothing visible
  // tells the user the content actually changed. Snap the page back to the
  // top and land focus on the first category row so the switch is obvious.
  // The tag rows may not exist yet (their list is still being fetched) -
  // that's fine, clampFocus keeps `pos` in range and useTvKeys' focus-recovery
  // effect re-asserts DOM focus once they register.
  const handleContentTypeChange = useCallback((type: ContentType) => {
    if (type === contentType) return;
    setContentType(type);
    // Scroll back to the top so the changed rows are what the user is looking
    // at. Focus deliberately stays on the button that was pressed: moving it
    // to the first category row does not work, because the new tag list is
    // still being fetched and clampFocus pulls the position back to the topbar
    // - which lands the highlight on the *other* content-type button, so
    // pressing 电视剧 would visibly jump the highlight onto 电影.
    // Instant, not smooth: smooth scrolling is unreliable in WebView.
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [contentType]);

  if (hasSearched) {
    return (
      <div className="tv-root min-h-screen bg-[#0f1218] text-[#e8eaed]">
        <TvSearchResults query={query} loading={loading} results={results} latencies={latencies} onBack={onReset} />
      </div>
    );
  }

  return (
    <div className="tv-root min-h-screen bg-[#0f1218] text-[#e8eaed]">
      <TopbarRow
        contentType={contentType}
        onContentTypeChange={handleContentTypeChange}
        onBrowse={() => router.push('/browse')}
        onFavorites={() => router.push('/favorites')}
        onSettings={() => router.push('/settings')}
      />

      <TvHistoryRow id="history" rowIndex={ROW_HISTORY} />

      <TvRecommendRow id="recommend" rowIndex={ROW_RECOMMEND} onSelect={handleSelect} />

      {CHART_ROWS[contentType].map((chart, index) => {
        const rowIndex = ROW_CHART_START + index;
        return (
          <TvCollectionRow
            key={chart.id}
            id={chart.id}
            rowIndex={rowIndex}
            title={chart.title}
            collectionId={chart.collectionId}
            shouldLoad={rowIndex <= loadedThroughRow}
            onSelect={handleSelect}
          />
        );
      })}

      {tags && tags.map((tag, index) => {
        const rowIndex = ROW_TAG_START + index;
        return (
          <TvRow
            key={tag.id}
            id={tag.id}
            rowIndex={rowIndex}
            title={tag.label}
            tagId={tag.id}
            tags={tags}
            contentType={contentType}
            shouldLoad={rowIndex <= loadedThroughRow}
            onSelect={handleSelect}
          />
        );
      })}
    </div>
  );
}

export function TvHome(props: TvHomeProps) {
  return (
    <TvFocusProvider>
      <TvHomeContent {...props} />
    </TvFocusProvider>
  );
}

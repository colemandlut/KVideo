'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TvFocusProvider, useTvFocus } from '@/lib/tv/TvFocusProvider';
import { useTvKeys } from '@/lib/tv/useTvKeys';
import { TvRow, type TvTag } from './TvRow';
import { TvRecommendRow } from './TvRecommendRow';
import { TvHistoryRow } from './TvHistoryRow';
import { TvSearchResults } from './TvSearchResults';
import type { TvMovie } from './TvPosterCard';
import type { Video } from '@/lib/types';

const FALLBACK_TAGS: TvTag[] = [{ id: '热门', label: '热门', value: '热门' }];

type ContentType = 'movie' | 'tv';

interface TopbarRowProps {
  contentType: ContentType;
  onContentTypeChange: (type: ContentType) => void;
  onFavorites: () => void;
  onSettings: () => void;
}

function TopbarRow({ contentType, onContentTypeChange, onFavorites, onSettings }: TopbarRowProps) {
  const { registerRow, unregisterRow, setItemElement } = useTvFocus();

  const actions = [
    { label: '电影', onClick: () => onContentTypeChange('movie'), selected: contentType === 'movie' },
    { label: '电视剧', onClick: () => onContentTypeChange('tv'), selected: contentType === 'tv' },
    { label: '收藏', onClick: onFavorites, selected: false },
    { label: '设置', onClick: onSettings, selected: false },
  ];
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
  onSearch: (query: string) => void;
  onReset: () => void;
}

function TvHomeContent({ query, hasSearched, loading, results, onSearch, onReset }: TvHomeProps) {
  const router = useRouter();
  const { pos, setPos } = useTvFocus();
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

  const handleSelect = useCallback((movie: TvMovie) => {
    onSearch(movie.title);
  }, [onSearch]);

  // Switching 电影/电视剧 refetches every category row, but if focus stays
  // on the topbar and the page stays scrolled where it was, nothing visible
  // tells the user the content actually changed. Snap the page back to the
  // top and land focus on the first category row so the switch is obvious.
  // Row 3 may not exist yet (tags are still loading) - that's fine, clampFocus
  // keeps `pos` in range and useTvKeys' focus-recovery effect re-asserts DOM
  // focus once the row registers.
  const handleContentTypeChange = useCallback((type: ContentType) => {
    if (type === contentType) return;
    setContentType(type);
    setPos({ rowIndex: 3, itemIndex: 0 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [contentType, setPos]);

  if (hasSearched) {
    return (
      <div className="tv-root min-h-screen bg-[#0f1218] text-[#e8eaed]">
        <TvSearchResults query={query} loading={loading} results={results} onBack={onReset} />
      </div>
    );
  }

  return (
    <div className="tv-root min-h-screen bg-[#0f1218] text-[#e8eaed]">
      <TopbarRow
        contentType={contentType}
        onContentTypeChange={handleContentTypeChange}
        onFavorites={() => router.push('/favorites')}
        onSettings={() => router.push('/settings')}
      />

      <TvHistoryRow id="history" rowIndex={1} />

      <TvRecommendRow id="recommend" rowIndex={2} onSelect={handleSelect} />

      {tags && tags.map((tag, index) => {
        const rowIndex = index + 3;
        return (
          <TvRow
            key={tag.id}
            id={tag.id}
            rowIndex={rowIndex}
            title={tag.label}
            tagId={tag.id}
            tags={tags}
            contentType={contentType}
            shouldLoad={rowIndex <= Math.max(3, maxRowReached + 1)}
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

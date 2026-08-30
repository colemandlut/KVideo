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
  const { pos } = useTvFocus();
  useTvKeys(true);

  const [contentType, setContentType] = useState<ContentType>('movie');
  const [tags, setTags] = useState<TvTag[] | null>(null);

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
        onContentTypeChange={setContentType}
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

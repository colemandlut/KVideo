'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TvFocusProvider, useTvFocus } from '@/lib/tv/TvFocusProvider';
import { useTvKeys } from '@/lib/tv/useTvKeys';
import { TvRow } from './TvRow';
import { TvRecommendRow } from './TvRecommendRow';
import { TvHistoryRow } from './TvHistoryRow';
import { TvSearchResults } from './TvSearchResults';
import type { TvMovie } from './TvPosterCard';
import type { Video } from '@/lib/types';

const TV_CATEGORIES = [
  { id: 'popular', title: '热门', value: '热门' },
  { id: 'latest', title: '最新', value: '最新' },
  { id: 'top', title: '豆瓣高分', value: '豆瓣高分' },
  { id: 'hidden', title: '冷门佳片', value: '冷门佳片' },
  { id: 'chinese', title: '华语', value: '华语' },
  { id: 'western', title: '欧美', value: '欧美' },
  { id: 'korean', title: '韩国', value: '韩国' },
  { id: 'japanese', title: '日本', value: '日本' },
];

const TAGS = TV_CATEGORIES.map((c) => ({ id: c.id, label: c.title, value: c.value }));

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

      {TV_CATEGORIES.map((category, index) => {
        const rowIndex = index + 3;
        return (
          <TvRow
            key={category.id}
            id={category.id}
            rowIndex={rowIndex}
            title={category.title}
            tagId={category.id}
            tags={TAGS}
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

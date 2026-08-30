'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TvFocusProvider, useTvFocus } from '@/lib/tv/TvFocusProvider';
import { useTvKeys } from '@/lib/tv/useTvKeys';
import { TvRow } from './TvRow';
import { TvRecommendRow } from './TvRecommendRow';
import type { TvMovie } from './TvPosterCard';

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

interface TopbarRowProps {
  onFavorites: () => void;
  onSettings: () => void;
}

function TopbarRow({ onFavorites, onSettings }: TopbarRowProps) {
  const { registerRow, unregisterRow, setItemElement } = useTvFocus();

  const actions = [
    { label: '收藏', onClick: onFavorites },
    { label: '设置', onClick: onSettings },
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
          className="tv-focusable flex-shrink-0 px-7 py-3 rounded-full bg-[#252b36] text-[16px]"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function TvHomeContent() {
  const router = useRouter();
  const { pos } = useTvFocus();
  useTvKeys(true);

  // Derived, monotonically-increasing high-water mark of the furthest row
  // reached. Updated during render (not in an effect) so the set of loaded
  // rows only ever grows within a mount - moving focus back up must not
  // unmount already-loaded rows and lose their fetched data.
  const [maxRowReached, setMaxRowReached] = useState(pos.rowIndex);
  if (pos.rowIndex > maxRowReached) {
    setMaxRowReached(pos.rowIndex);
  }

  const handleSelect = useCallback((movie: TvMovie) => {
    router.push(`/?q=${encodeURIComponent(movie.title)}`);
  }, [router]);

  return (
    <div className="tv-root min-h-screen bg-[#0f1218] text-[#e8eaed]">
      <TopbarRow
        onFavorites={() => router.push('/favorites')}
        onSettings={() => router.push('/settings')}
      />

      <TvRecommendRow id="recommend" rowIndex={1} onSelect={handleSelect} />

      {TV_CATEGORIES.map((category, index) => {
        const rowIndex = index + 2;
        return (
          <TvRow
            key={category.id}
            id={category.id}
            rowIndex={rowIndex}
            title={category.title}
            tagId={category.id}
            tags={TAGS}
            shouldLoad={rowIndex <= Math.max(2, maxRowReached + 1)}
            onSelect={handleSelect}
          />
        );
      })}
    </div>
  );
}

export function TvHome() {
  return (
    <TvFocusProvider>
      <TvHomeContent />
    </TvFocusProvider>
  );
}

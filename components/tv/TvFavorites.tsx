'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TvFocusProvider, useTvFocus } from '@/lib/tv/TvFocusProvider';
import { useTvKeys } from '@/lib/tv/useTvKeys';
import { useTvLongPressOk } from '@/lib/tv/useTvLongPressOk';
import { useFavorites } from '@/lib/store/favorites-store';
import type { FavoriteItem } from '@/lib/types';

const COLUMNS = 5;

/** Exactly one component may own the registration for a given row id - a second
 *  owner's effect cleanup would delete the first one's entry, including the
 *  element table its ref callbacks just populated. Mirrors TvSearchResults. */
function useRowRegistration(id: string, rowIndex: number, length: number, keepColumn?: boolean) {
  const { registerRow, unregisterRow } = useTvFocus();

  useEffect(() => {
    registerRow(id, rowIndex, length, keepColumn);
    return () => unregisterRow(id);
  }, [id, rowIndex, length, keepColumn, registerRow, unregisterRow]);
}

function BackRow({ onBack }: { onBack: () => void }) {
  const { setItemElement } = useTvFocus();
  useRowRegistration('tv-back', 0, 1);

  return (
    <div className="tv-row-strip pt-6">
      <button
        ref={(el) => setItemElement('tv-back', 0, el)}
        type="button"
        tabIndex={-1}
        className="tv-focusable flex-shrink-0 px-7 py-3 rounded-full bg-[#252b36] text-[16px]"
        onClick={onBack}
      >
        返回
      </button>
    </div>
  );
}

interface TvFavoriteCardProps {
  item: FavoriteItem;
  onSelect: (item: FavoriteItem) => void;
  onDelete: (item: FavoriteItem) => void;
  setRef: (el: HTMLButtonElement | null) => void;
}

/**
 * One card owns its own image-error flag so a single dead scraper-site
 * poster only blanks out that card, not every card in the row - favourite
 * posters come straight from whichever source site the video was found on,
 * not Douban, so they are used unchanged (no /api/douban/image wrapping) and
 * are exactly as likely to 404 as history posters.
 *
 * The hold-to-remove gesture is the shared `useTvLongPressOk` hook, the same
 * one TvHistoryRow's TvHistoryCard uses, so the tap-window / long-press
 * timing (and the `tv-history-delete-progress` bar) can't drift between the
 * two rows.
 */
function TvFavoriteCard({ item, onSelect, onDelete, setRef }: TvFavoriteCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const { isPressing, pressToken, handleKeyDown, handleKeyUp, handleBlur: handlePressBlur } =
    useTvLongPressOk({ item, onSelect, onLongPress: onDelete });

  const handleBlur = () => {
    handlePressBlur();
    setIsFocused(false);
  };

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
        {isFocused ? (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[13px] text-[#e8eaed]">
            长按 OK 取消收藏
          </span>
        ) : null}
        {isPressing ? (
          <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-black/40">
            <div key={pressToken} className="tv-history-delete-progress h-full bg-red-500" />
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-[15px] leading-tight line-clamp-2">{item.title}</p>
      {item.remarks ? (
        <p className="text-[13px] text-[#9aa0a6] line-clamp-1">{item.remarks}</p>
      ) : null}
    </button>
  );
}

interface TvFavoriteRowProps {
  rowIndex: number;
  items: FavoriteItem[];
  onSelect: (item: FavoriteItem) => void;
  onDelete: (item: FavoriteItem) => void;
}

/** One grid row of up to COLUMNS cards. `keepColumn: true` because this is a
 *  grid, not an independently-scrolling carousel - up/down must keep the
 *  column, matching TvSearchResults' TvResultRow. */
function TvFavoriteRow({ rowIndex, items, onSelect, onDelete }: TvFavoriteRowProps) {
  const { setItemElement } = useTvFocus();
  const id = `favorite-${rowIndex}`;
  useRowRegistration(id, rowIndex, items.length, true);

  return (
    <div className="tv-row-strip">
      {items.map((item, index) => (
        <TvFavoriteCard
          key={`${item.source}:${item.videoId}`}
          item={item}
          onSelect={onSelect}
          onDelete={onDelete}
          setRef={(el) => setItemElement(id, index, el)}
        />
      ))}
    </div>
  );
}

function TvFavoritesContent() {
  const router = useRouter();
  useTvKeys(true);

  const { favorites, removeFavorite } = useFavorites(false);

  const chunks = useMemo(() => {
    const out: FavoriteItem[][] = [];
    for (let i = 0; i < favorites.length; i += COLUMNS) {
      out.push(favorites.slice(i, i + COLUMNS));
    }
    return out;
  }, [favorites]);

  const handleBack = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleSelect = useCallback((item: FavoriteItem) => {
    const params = new URLSearchParams({
      id: String(item.videoId),
      source: item.source,
      title: item.title,
    });
    router.push(`/player?${params.toString()}`);
  }, [router]);

  const handleDelete = useCallback((item: FavoriteItem) => {
    removeFavorite(item.videoId, item.source);
  }, [removeFavorite]);

  return (
    <div className="tv-root min-h-screen bg-[#0f1218] text-[#e8eaed]">
      <BackRow onBack={handleBack} />
      <h2 className="tv-row-title">我的收藏</h2>

      {chunks.map((items, index) => (
        <TvFavoriteRow
          key={index}
          rowIndex={index + 1}
          items={items}
          onSelect={handleSelect}
          onDelete={handleDelete}
        />
      ))}

      {favorites.length === 0 ? (
        <p className="tv-row-title text-[#9aa0a6]">暂无收藏</p>
      ) : null}
    </div>
  );
}

export function TvFavorites() {
  return (
    <TvFocusProvider>
      <TvFavoritesContent />
    </TvFocusProvider>
  );
}

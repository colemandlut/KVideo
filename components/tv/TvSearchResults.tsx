'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTvFocus } from '@/lib/tv/TvFocusProvider';
import type { Video } from '@/lib/types';

const COLUMNS = 5;

/** Exactly one component may own the registration for a given row id - a second
 *  owner's effect cleanup would delete the first one's entry, including the
 *  element table its ref callbacks just populated. */
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

interface TvResultRowProps {
  rowIndex: number;
  videos: Video[];
  onSelect: (video: Video) => void;
}

function TvResultRow({ rowIndex, videos, onSelect }: TvResultRowProps) {
  const { setItemElement } = useTvFocus();
  const id = `result-${rowIndex}`;
  useRowRegistration(id, rowIndex, videos.length, true);

  return (
    <div className="tv-row-strip">
      {videos.map((video, index) => (
        <button
          key={`${video.source}-${video.vod_id}`}
          ref={(el) => setItemElement(id, index, el)}
          type="button"
          tabIndex={-1}
          className="tv-focusable flex-shrink-0 w-[148px] h-[104px] rounded-[10px] bg-[#252b36] px-3 py-2 text-left"
          onClick={() => onSelect(video)}
        >
          <span className="block text-[15px] leading-tight line-clamp-3">{video.vod_name}</span>
          <span className="block mt-1 text-[13px] text-[#9aa0a6] line-clamp-1">
            {video.sourceName || video.source}
          </span>
        </button>
      ))}
    </div>
  );
}

interface TvSearchResultsProps {
  query: string;
  loading: boolean;
  results: Video[];
  onBack: () => void;
}

export function TvSearchResults({ query, loading, results, onBack }: TvSearchResultsProps) {
  const router = useRouter();

  const chunks = useMemo(() => {
    const out: Video[][] = [];
    for (let i = 0; i < results.length; i += COLUMNS) {
      out.push(results.slice(i, i + COLUMNS));
    }
    return out;
  }, [results]);

  const handleSelect = useCallback((video: Video) => {
    const params = new URLSearchParams({
      id: String(video.vod_id),
      source: video.source,
      title: video.vod_name,
    });
    router.push(`/player?${params.toString()}`);
  }, [router]);

  return (
    <>
      <BackRow onBack={onBack} />
      <h2 className="tv-row-title">
        {loading ? `正在搜索「${query}」…` : `「${query}」的结果（${results.length}）`}
      </h2>
      {chunks.map((videos, index) => (
        <TvResultRow
          key={index}
          rowIndex={index + 1}
          videos={videos}
          onSelect={handleSelect}
        />
      ))}
      {!loading && results.length === 0 ? (
        <p className="tv-row-title text-[#9aa0a6]">没有找到结果</p>
      ) : null}
    </>
  );
}

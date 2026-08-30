'use client';

import { useEffect } from 'react';
import { usePersonalizedRecommendations } from '@/components/home/hooks/usePersonalizedRecommendations';
import { useTvFocus } from '@/lib/tv/TvFocusProvider';
import { TvPosterCard, type TvMovie } from './TvPosterCard';

interface TvRecommendRowProps {
  id: string;
  rowIndex: number;
  onSelect: (movie: TvMovie) => void;
}

export function TvRecommendRow({ id, rowIndex, onSelect }: TvRecommendRowProps) {
  const { registerRow, unregisterRow, setItemElement } = useTvFocus();
  const { movies, hasHistory } = usePersonalizedRecommendations(false);

  // No history means no row at all - length 0 makes the focus model skip it.
  const length = hasHistory ? Math.max(1, movies.length) : 0;

  useEffect(() => {
    registerRow(id, rowIndex, length);
    return () => unregisterRow(id);
  }, [id, rowIndex, length, registerRow, unregisterRow]);

  if (!hasHistory) return null;

  return (
    <section>
      <h2 className="tv-row-title">为你推荐</h2>
      <div className="tv-row-strip">
        {movies.length > 0 ? (
          movies.map((movie, index) => (
            <TvPosterCard
              key={movie.id}
              movie={movie}
              onSelect={onSelect}
              ref={(el) => setItemElement(id, index, el)}
            />
          ))
        ) : (
          <button
            ref={(el) => setItemElement(id, 0, el)}
            type="button"
            tabIndex={-1}
            className="tv-focusable flex-shrink-0 w-[148px] h-[208px] rounded-[10px] bg-[#252b36]"
            aria-label="为你推荐 加载中"
          />
        )}
      </div>
    </section>
  );
}

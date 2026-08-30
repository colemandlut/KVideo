'use client';

import { forwardRef } from 'react';

export interface TvMovie {
  id: string;
  title: string;
  cover: string;
  rate: string;
  url: string;
}

interface TvPosterCardProps {
  movie: TvMovie;
  onSelect: (movie: TvMovie) => void;
}

export const TvPosterCard = forwardRef<HTMLButtonElement, TvPosterCardProps>(
  function TvPosterCard({ movie, onSelect }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        tabIndex={-1}
        className="tv-focusable flex-shrink-0 w-[148px] text-left"
        onClick={() => onSelect(movie)}
      >
        <div className="relative w-[148px] h-[208px] rounded-[10px] overflow-hidden bg-[#252b36]">
          {movie.cover ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/douban/image?url=${encodeURIComponent(movie.cover)}`}
              alt={movie.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : null}
          {movie.rate ? (
            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[13px] text-amber-300">
              {movie.rate}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[15px] leading-tight line-clamp-2">{movie.title}</p>
      </button>
    );
  }
);

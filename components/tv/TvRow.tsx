'use client';

import { useEffect } from 'react';
import { usePopularMovies } from '@/components/home/hooks/usePopularMovies';
import { useTvFocus } from '@/lib/tv/TvFocusProvider';
import { TvPosterCard, type TvMovie } from './TvPosterCard';

export interface TvTag {
  id: string;
  label: string;
  value: string;
}

interface TvRowProps {
  id: string;
  rowIndex: number;
  title: string;
  tagId: string;
  tags: TvTag[];
  /** False keeps the row a focusable skeleton and never mounts the fetching child. */
  shouldLoad: boolean;
  onSelect: (movie: TvMovie) => void;
}

/** Registers the row with the focus model. Length 1 means "one focusable skeleton". */
function useRowRegistration(id: string, rowIndex: number, length: number) {
  const { registerRow, unregisterRow } = useTvFocus();

  useEffect(() => {
    registerRow(id, rowIndex, length);
    return () => unregisterRow(id);
  }, [id, rowIndex, length, registerRow, unregisterRow]);
}

export function TvRowSkeleton({ id, rowIndex, title }: { id: string; rowIndex: number; title: string }) {
  const { setItemElement } = useTvFocus();
  useRowRegistration(id, rowIndex, 1);

  return (
    <section>
      <h2 className="tv-row-title">{title}</h2>
      <div className="tv-row-strip">
        <button
          ref={(el) => setItemElement(id, 0, el)}
          type="button"
          tabIndex={-1}
          className="tv-focusable flex-shrink-0 w-[148px] h-[208px] rounded-[10px] bg-[#252b36]"
          aria-label={`${title} 加载中`}
        />
      </div>
    </section>
  );
}

function TvRowLoaded({ id, rowIndex, title, tagId, tags, onSelect }: Omit<TvRowProps, 'shouldLoad'>) {
  const { setItemElement } = useTvFocus();
  const { movies } = usePopularMovies(tagId, tags, 'movie');

  // Still one focusable skeleton slot until the first page arrives.
  useRowRegistration(id, rowIndex, movies.length > 0 ? movies.length : 1);

  if (movies.length === 0) {
    return <TvRowSkeleton id={id} rowIndex={rowIndex} title={title} />;
  }

  return (
    <section>
      <h2 className="tv-row-title">{title}</h2>
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
    </section>
  );
}

export function TvRow(props: TvRowProps) {
  const { shouldLoad, ...rest } = props;

  if (!shouldLoad) {
    return <TvRowSkeleton id={rest.id} rowIndex={rest.rowIndex} title={rest.title} />;
  }

  return <TvRowLoaded {...rest} />;
}

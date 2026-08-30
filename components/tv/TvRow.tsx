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
  contentType: 'movie' | 'tv';
  /** False keeps the row a focusable skeleton and never mounts the fetching child. */
  shouldLoad: boolean;
  onSelect: (movie: TvMovie) => void;
}

/**
 * Exactly one component may own the focus-model registration for a given row
 * id. If a second component registered (and later unmounted) the same id, its
 * cleanup would delete the registration the other owner still needs -
 * including the element table the refs just populated - so registration and
 * presentation are kept as separate components below.
 */
function useRowRegistration(id: string, rowIndex: number, length: number) {
  const { registerRow, unregisterRow } = useTvFocus();

  useEffect(() => {
    registerRow(id, rowIndex, length);
    return () => unregisterRow(id);
  }, [id, rowIndex, length, registerRow, unregisterRow]);
}

/** Presentational only: renders one focusable skeleton slot. Registers nothing. */
function TvRowSkeletonView({ title, setRef }: { title: string; setRef: (el: HTMLButtonElement | null) => void }) {
  return (
    <section>
      <h2 className="tv-row-title">{title}</h2>
      <div className="tv-row-strip">
        <button
          ref={setRef}
          type="button"
          tabIndex={-1}
          className="tv-focusable flex-shrink-0 w-[148px] h-[208px] rounded-[10px] bg-[#252b36]"
          aria-label={`${title} 加载中`}
        />
      </div>
    </section>
  );
}

export function TvRowSkeleton({ id, rowIndex, title }: { id: string; rowIndex: number; title: string }) {
  const { setItemElement } = useTvFocus();
  useRowRegistration(id, rowIndex, 1);

  return <TvRowSkeletonView title={title} setRef={(el) => setItemElement(id, 0, el)} />;
}

function TvRowLoaded({ id, rowIndex, title, tagId, tags, contentType, onSelect }: Omit<TvRowProps, 'shouldLoad'>) {
  const { setItemElement } = useTvFocus();
  const { movies } = usePopularMovies(tagId, tags, contentType);

  // Still one focusable skeleton slot until the first page arrives.
  useRowRegistration(id, rowIndex, movies.length > 0 ? movies.length : 1);

  if (movies.length === 0) {
    return <TvRowSkeletonView title={title} setRef={(el) => setItemElement(id, 0, el)} />;
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

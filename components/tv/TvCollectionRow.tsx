'use client';

import { useEffect, useState } from 'react';
import { useTvFocus } from '@/lib/tv/TvFocusProvider';
import { TvPosterCard, type TvMovie } from './TvPosterCard';
import { TvRowSkeletonView } from './TvRow';

/** Matches the page size every other poster row uses, so a chart row is the
 *  same length as its neighbours and the remote takes the same number of
 *  presses to walk it. */
const PAGE_LIMIT = 20;

interface TvCollectionRowProps {
  id: string;
  rowIndex: number;
  title: string;
  /** A whitelisted id from `/api/douban/collection`; anything else 400s there. */
  collectionId: string;
  /** False keeps the row a focusable skeleton and never mounts the fetching child. */
  shouldLoad: boolean;
  onSelect: (movie: TvMovie) => void;
}

/** Exactly one component may own the focus-model registration for a given row
 *  id - a second owner's effect cleanup would delete the first one's entry,
 *  including the element table its ref callbacks just populated. Mirrors
 *  TvRow, which is why registration and presentation are split below. */
function useRowRegistration(id: string, rowIndex: number, length: number) {
  const { registerRow, unregisterRow } = useTvFocus();

  useEffect(() => {
    registerRow(id, rowIndex, length);
    return () => unregisterRow(id);
  }, [id, rowIndex, length, registerRow, unregisterRow]);
}

function TvCollectionRowSkeleton({ id, rowIndex, title }: { id: string; rowIndex: number; title: string }) {
  const { setItemElement } = useTvFocus();
  useRowRegistration(id, rowIndex, 1);

  return <TvRowSkeletonView title={title} setRef={(el) => setItemElement(id, 0, el)} />;
}

function TvCollectionRowLoaded({ id, rowIndex, title, collectionId, onSelect }: Omit<TvCollectionRowProps, 'shouldLoad'>) {
  const { setItemElement } = useTvFocus();
  const [movies, setMovies] = useState<TvMovie[]>([]);

  // `ignore` guards against a stale response winning a race: flipping
  // 电影 -> 电视剧 -> 电影 swaps this row's collection id twice, and the
  // in-flight request for the wrong list must not overwrite the newer one.
  // Every setState sits inside the nested async function, never directly in
  // the effect body - same shape as TvHome's tag loader.
  //
  // A failed fetch deliberately leaves `movies` empty, which renders the same
  // focusable skeleton as "still loading". Douban is flaky from overseas
  // hosts, and this is exactly how the existing category rows behave when
  // their fetch fails - the row stays walkable instead of vanishing and
  // renumbering everything below it.
  useEffect(() => {
    let ignore = false;

    const loadCollection = async () => {
      setMovies([]);
      try {
        const response = await fetch(
          `/api/douban/collection?id=${encodeURIComponent(collectionId)}&count=${PAGE_LIMIT}`
        );
        if (!response.ok) throw new Error(`Douban collection route returned ${response.status}`);

        const data = await response.json();
        if (ignore) return;
        setMovies(Array.isArray(data.subjects) ? data.subjects : []);
      } catch (error) {
        console.error('Fetch tv collection error:', error);
      }
    };

    loadCollection();

    return () => {
      ignore = true;
    };
  }, [collectionId]);

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

/** One Douban chart (榜单) as a poster row, sharing TvRow's lazy-load contract:
 *  `shouldLoad: false` must genuinely prevent the fetch, which only works if
 *  the fetching component is never mounted. */
export function TvCollectionRow(props: TvCollectionRowProps) {
  const { shouldLoad, ...rest } = props;

  if (!shouldLoad) {
    return <TvCollectionRowSkeleton id={rest.id} rowIndex={rest.rowIndex} title={rest.title} />;
  }

  return <TvCollectionRowLoaded {...rest} />;
}

'use client';

import { Suspense } from 'react';
import {
  FavoritesPageContent,
  FavoritesPageFallback,
} from '@/components/favorites/FavoritesPageContent';
import { useIsTvLike } from '@/lib/hooks/mobile/useDeviceDetection';
import { TvFavorites } from '@/components/tv/TvFavorites';

export default function Favorites() {
  const isTvLike = useIsTvLike();

  if (isTvLike) {
    return <TvFavorites />;
  }

  return (
    <Suspense fallback={<FavoritesPageFallback />}>
      <FavoritesPageContent />
    </Suspense>
  );
}

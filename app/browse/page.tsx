'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useIsTvLike, readTvEnvironment } from '@/lib/hooks/mobile/useDeviceDetection';
import { TvBrowse } from '@/components/tv/TvBrowse';

/**
 * Category browsing, TV only. Unlike `/`, `/favorites` and `/settings` - which
 * are shared routes that branch on `isTvLike` at the top - this one has no
 * phone or desktop counterpart at all, and nothing in the phone UI links to
 * it. A non-TV device that reaches it anyway goes back to the home screen.
 */
export default function BrowsePage() {
  const isTvLike = useIsTvLike();
  const router = useRouter();

  useEffect(() => {
    // Deliberately re-reading the environment instead of trusting `isTvLike`
    // here: it comes from useSyncExternalStore, whose hydration pass uses the
    // server snapshot (always false), and this effect fires off that first
    // commit. Redirecting on the hook's value would therefore bounce a real
    // TV straight back to `/` before the client snapshot ever arrives.
    if (readTvEnvironment().isTvLike) return;
    router.replace('/');
  }, [isTvLike, router]);

  if (!isTvLike) return null;

  return <TvBrowse />;
}

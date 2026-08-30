import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useSiteIcon } from '@/components/SiteIconProvider';
import { Icons } from '@/components/ui/Icon';
import { siteConfig } from '@/lib/config/site-config';
import { useIsTvLike } from '@/lib/hooks/mobile/useDeviceDetection';

type CastState = 'idle' | 'sending' | 'sent' | 'error';

const CAST_FEEDBACK_MS = 2000;

export function PlayerNavbar({ isPremium }: { isPremium?: boolean }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const siteIconSrc = useSiteIcon();
    const isTvLike = useIsTvLike();

    const [castAvailable, setCastAvailable] = useState(true);
    const [castState, setCastState] = useState<CastState>('idle');
    const castResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Probe once on mount: if server-side cast isn't configured (503) or the
    // viewer has no session (401), hide the button permanently for this
    // mount instead of showing something that will always fail.
    useEffect(() => {
        if (isTvLike) {
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const res = await fetch('/api/cast');
                if (cancelled) {
                    return;
                }
                if (res.status === 401 || res.status === 503) {
                    setCastAvailable(false);
                }
            } catch {
                if (!cancelled) {
                    setCastAvailable(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isTvLike]);

    useEffect(() => {
        return () => {
            if (castResetTimeoutRef.current) {
                clearTimeout(castResetTimeoutRef.current);
            }
        };
    }, []);

    const handleCast = async () => {
        const id = searchParams.get('id');
        const source = searchParams.get('source');
        const title = searchParams.get('title') ?? '';
        const episode = Number(searchParams.get('episode') ?? '0');

        if (!id || !source) {
            return;
        }

        const t = Math.floor(document.querySelector('video')?.currentTime ?? 0);

        setCastState('sending');

        try {
            const res = await fetch('/api/cast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, source, title, episode, t }),
            });

            setCastState(res.ok ? 'sent' : 'error');
        } catch {
            setCastState('error');
        }

        if (castResetTimeoutRef.current) {
            clearTimeout(castResetTimeoutRef.current);
        }
        castResetTimeoutRef.current = setTimeout(() => setCastState('idle'), CAST_FEEDBACK_MS);
    };

    const showCastButton = !isTvLike && castAvailable;
    const castLabel =
        castState === 'sent' ? '已投屏' : castState === 'error' ? '投屏失败' : '投屏';

    return (
        <nav className="sticky top-0 z-50 pt-4 pb-2 px-4" style={{ transform: 'translateZ(0)' }}>
            <div className="max-w-7xl mx-auto bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <button
                            onClick={() => router.push(isPremium ? '/premium' : '/')}
                            className="flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0 cursor-pointer"
                            title={isPremium ? "返回高级主页" : "返回首页"}
                        >
                            <Image
                                src={siteIconSrc}
                                alt={siteConfig.name}
                                width={40}
                                height={40}
                                unoptimized
                                className="object-contain"
                            />
                        </button>
                        <Button
                            variant="secondary"
                            onClick={() => router.back()}
                            className="flex items-center gap-2"
                        >
                            <Icons.ChevronLeft size={20} />
                            <span className="hidden sm:inline">返回</span>
                        </Button>
                        {showCastButton && (
                            <Button
                                variant="secondary"
                                onClick={handleCast}
                                disabled={castState === 'sending'}
                                className="flex items-center gap-2"
                                title="投屏到电视"
                            >
                                <Icons.Cast size={20} />
                                <span className="hidden sm:inline">{castLabel}</span>
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href={isPremium ? '/premium/settings' : '/settings'}
                            className="w-10 h-10 flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all duration-200 cursor-pointer"
                            aria-label="设置"
                        >
                            <svg className="w-5 h-5" viewBox="0 -960 960 960" fill="currentColor">
                                <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" />
                            </svg>
                        </Link>
                        <ThemeSwitcher />
                    </div>
                </div>
            </div>
        </nav>
    );
}

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

type CastState = 'idle' | 'sending' | 'sent' | 'queued' | 'error';

const CAST_FEEDBACK_MS = 2000;

export function PlayerNavbar({ isPremium }: { isPremium?: boolean }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const siteIconSrc = useSiteIcon();
    const isTvLike = useIsTvLike();

    const [castAvailable, setCastAvailable] = useState(true);
    const [castState, setCastState] = useState<CastState>('idle');
    // Non-null while the phone is asking which TV to cast to. Only ever set
    // when more than one is connected - a single-TV home never sees a list.
    const [castTargets, setCastTargets] = useState<{ id: string; name: string }[] | null>(null);
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

    const sendCast = async (targetId?: string) => {
        const id = searchParams.get('id');
        const source = searchParams.get('source');
        const title = searchParams.get('title') ?? '';
        const episode = Number(searchParams.get('episode') ?? '0');

        if (!id || !source) {
            return;
        }

        const t = Math.floor(document.querySelector('video')?.currentTime ?? 0);

        setCastTargets(null);
        setCastState('sending');

        try {
            const res = await fetch('/api/cast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, source, title, episode, t, targetId }),
            });

            // delivered 0 means the command only reached the mailbox: no TV
            // is holding a socket right now. Saying 已投屏 there is how a dead
            // push path stayed invisible for a whole day - the phone claimed
            // success while nothing happened on the TV.
            const body = res.ok ? ((await res.json()) as { delivered?: number }) : null;
            setCastState(!res.ok ? 'error' : (body?.delivered ?? 0) > 0 ? 'sent' : 'queued');
        } catch {
            setCastState('error');
        }

        if (castResetTimeoutRef.current) {
            clearTimeout(castResetTimeoutRef.current);
        }
        castResetTimeoutRef.current = setTimeout(() => setCastState('idle'), CAST_FEEDBACK_MS);
    };

    const handleCast = async () => {
        // Ask which TVs are awake on this network first. One TV (or none, or a
        // deployment with no relay) casts straight away - making everyone tap
        // through a one-item list would be worse than the old behaviour. The
        // lookup is also allowed to fail: casting without a target still
        // reaches every TV in the room, which is what used to happen anyway.
        try {
            const res = await fetch('/api/cast/targets');
            if (res.ok) {
                const data = (await res.json()) as { targets?: { id: string; name: string }[] };
                const targets = data.targets ?? [];
                if (targets.length > 1) {
                    setCastTargets(targets);
                    return;
                }
            }
        } catch {
            // Fall through and cast to the whole room.
        }

        void sendCast();
    };

    const showCastButton = !isTvLike && castAvailable;
    const castLabel =
        castState === 'sent'
            ? '已投屏'
            : castState === 'queued'
              ? '电视未连接'
              : castState === 'error'
                ? '投屏失败'
                : '投屏';

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
                                {/* Icon-only at rest on phones, matching 返回. But the
                                    transient 已投屏 / 投屏失败 states are the only feedback
                                    this button gives, and a phone is where casting is
                                    actually used - hiding them there made every tap look
                                    like nothing happened. */}
                                <span className={castState === 'idle' ? 'hidden sm:inline' : 'inline'}>
                                    {castLabel}
                                </span>
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

            {/* Only rendered when more than one TV is awake on this network.
                A plain overlay rather than a portal/dialog component: this
                navbar sits above a video that may be in fullscreen, and a
                portal to document.body would render behind the fullscreen
                element. */}
            {castTargets && (
                <div
                    className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-4"
                    onClick={() => setCastTargets(null)}
                    role="presentation"
                >
                    <div
                        className="w-full max-w-xs rounded-2xl bg-[var(--card-bg,#1f2430)] p-4 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-label="选择投屏的电视"
                    >
                        <p className="mb-3 text-center text-sm text-[var(--text-color,#e8eaed)]">
                            投屏到哪台电视？
                        </p>
                        <div className="flex flex-col gap-2">
                            {castTargets.map((target) => (
                                <button
                                    key={target.id}
                                    type="button"
                                    className="w-full rounded-xl bg-[color-mix(in_srgb,var(--accent-color)_15%,transparent)] px-4 py-3 text-left text-[15px] text-[var(--text-color,#e8eaed)]"
                                    onClick={() => void sendCast(target.id)}
                                >
                                    {target.name}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="mt-3 w-full rounded-xl px-4 py-2 text-center text-sm text-[var(--text-secondary,#9aa0a6)]"
                            onClick={() => setCastTargets(null)}
                        >
                            取消
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}

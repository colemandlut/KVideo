import { useState, useEffect, useSyncExternalStore } from 'react';

/**
 * Hook to detect if the device is mobile
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            ) || window.innerWidth < 768;
            setIsMobile(mobile);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
}

/**
 * Hook to detect if the device is iOS
 */
export function useIsIOS() {
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        const checkIOS = () => {
            const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
            setIsIOS(ios);
        };

        checkIOS();
    }, []);

    return isIOS;
}

/**
 * Hook to detect if the page runs inside the KVideo Android shell app.
 * The app injects the `KVideoAndroid` bridge and implements
 * WebChromeClient.onShowCustomView, so it can host real native fullscreen.
 */
export function useIsAndroidApp() {
    return useSyncExternalStore(
        () => () => { },
        () => typeof (window as Window & { KVideoAndroid?: unknown }).KVideoAndroid !== 'undefined',
        () => false
    );
}

/**
 * Environment snapshot used to decide whether we are on a TV-like Android
 * device (Android TV box, set-top box) rather than a phone or a desktop.
 *
 * Android WebView often reports touch support even on hardware that has no
 * touchscreen, so touch is deliberately NOT part of the test. A wide viewport
 * plus an Android user agent is what separates a TV from a phone; desktops
 * never carry "Android" in the user agent.
 */
export function readTvEnvironment() {
    if (typeof window === 'undefined') {
        return { isAndroidUA: false, width: 0, height: 0, hasBridge: false, isTvLike: false };
    }

    const isAndroidUA = /Android/i.test(navigator.userAgent);
    const width = window.innerWidth;
    const hasBridge = typeof (window as Window & { KVideoAndroid?: unknown }).KVideoAndroid !== 'undefined';
    const isTvUA = /smarttv|android tv|googletv|firetv|bravia|aft[a-z]{1,2}|hbbtv|netcast|viera|tizen|webos/i
        .test(navigator.userAgent);

    return {
        isAndroidUA,
        width,
        height: window.innerHeight,
        hasBridge,
        isTvLike: hasBridge || isTvUA || (isAndroidUA && width >= 1280),
    };
}

/**
 * True when the player should behave like a TV app: no reachable pointer, and
 * the whole screen belongs to the video.
 */
export function useIsTvLike() {
    return useSyncExternalStore(
        (onChange) => {
            window.addEventListener('resize', onChange);
            return () => window.removeEventListener('resize', onChange);
        },
        () => readTvEnvironment().isTvLike,
        () => false
    );
}

/**
 * TEMPORARY: single-line environment summary rendered on the player so the
 * actual runtime values can be read off a TV screen. Returns a string because
 * useSyncExternalStore requires a stable snapshot.
 */
export function useTvEnvironmentLabel() {
    return useSyncExternalStore(
        (onChange) => {
            window.addEventListener('resize', onChange);
            return () => window.removeEventListener('resize', onChange);
        },
        () => {
            const e = readTvEnvironment();
            return `tv=${e.isTvLike ? 'Y' : 'N'} bridge=${e.hasBridge ? 'Y' : 'N'} androidUA=${e.isAndroidUA ? 'Y' : 'N'} ${e.width}x${e.height} dpr=${window.devicePixelRatio} touch=${navigator.maxTouchPoints}`;
        },
        () => ''
    );
}

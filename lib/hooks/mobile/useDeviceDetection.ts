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

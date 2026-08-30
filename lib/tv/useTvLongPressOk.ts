'use client';

import { useEffect, useRef, useState } from 'react';

export const TV_LONG_PRESS_MS = 800;

// Releasing before this counts as a quick tap and selects. Releasing after it
// - once the delete/remove progress bar is on screen - is treated as the user
// changing their mind, and does nothing at all. Making the tap window end
// exactly when the bar appears is what makes the rule visible: if you can see
// the bar, you have already left tap territory.
export const TV_LONG_PRESS_TAP_MS = 250;

interface UseTvLongPressOkOptions<T> {
  item: T;
  onSelect: (item: T) => void;
  onLongPress: (item: T) => void;
}

interface UseTvLongPressOkResult {
  isPressing: boolean;
  pressToken: number;
  handleKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  handleKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  handleBlur: () => void;
}

/**
 * Shared "hold OK to act, tap OK to select" gesture used by every TV row that
 * lets a long press remove an entry (watch history, favourites, ...).
 *
 * Two details here are load-bearing and easy to regress if this logic is
 * ever forked instead of reused:
 *
 * 1. `event.repeat` cannot be trusted. The Android shell forwards the D-pad
 *    centre button by constructing a brand new KeyEvent for every
 *    auto-repeat:
 *
 *      webView.dispatchKeyEvent(KeyEvent(ACTION_DOWN, KEYCODE_ENTER))
 *
 *    That constructor sets repeatCount to 0, so every repeat reaches the page
 *    looking like a fresh press with `repeat === false`. A press already in
 *    flight (`timerRef.current !== null`) is the reliable signal instead.
 *
 * 2. There is a 250ms tap window and an 800ms long-press threshold, and
 *    releasing between them must do nothing at all - not select, not delete.
 *    The progress bar only appears once the tap window has passed
 *    (`tapTimerRef`), so a visible bar always means "releasing now does
 *    nothing", and a quick tap never flashes it.
 */
export function useTvLongPressOk<T>({
  item,
  onSelect,
  onLongPress,
}: UseTvLongPressOkOptions<T>): UseTvLongPressOkResult {
  const [isPressing, setIsPressing] = useState(false);
  const [pressToken, setPressToken] = useState(0);

  // Timer for the pending long press, the timer for when the progress bar
  // should appear, when the current press started, and a flag so the keyup
  // that follows a fired long-press doesn't also trigger a short-press select.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef(0);
  const longPressFiredRef = useRef(false);

  const clearPressTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (tapTimerRef.current !== null) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
  };

  // Never leave a timer running past the owning card's lifetime.
  useEffect(() => clearPressTimer, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter') return;

    // Stop the native click-on-keydown behaviour every time Enter fires,
    // including auto-repeats - otherwise a held key would keep re-triggering
    // select on every repeat while the long-press timer is running.
    event.preventDefault();

    // See point 1 above: a press already in flight is the signal, not
    // `event.repeat`.
    if (timerRef.current !== null || longPressFiredRef.current) return;

    longPressFiredRef.current = false;
    pressStartRef.current = Date.now();

    clearPressTimer();

    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      setIsPressing(true);
      setPressToken((token) => token + 1);
    }, TV_LONG_PRESS_TAP_MS);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      longPressFiredRef.current = true;
      setIsPressing(false);
      onLongPress(item);
    }, TV_LONG_PRESS_MS);
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter') return;

    const wasLongPress = longPressFiredRef.current;
    const heldFor = Date.now() - pressStartRef.current;
    clearPressTimer();
    setIsPressing(false);

    // Long press already fired, or the user held past the tap window and then
    // let go - an abandoned long press, which should do nothing rather than
    // fall through to selecting something they did not ask for.
    if (wasLongPress || heldFor >= TV_LONG_PRESS_TAP_MS) return;

    onSelect(item);
  };

  const handleBlur = () => {
    clearPressTimer();
    setIsPressing(false);
  };

  return { isPressing, pressToken, handleKeyDown, handleKeyUp, handleBlur };
}

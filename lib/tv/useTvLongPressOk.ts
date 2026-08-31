'use client';

import { useEffect, useRef, useState } from 'react';

export const TV_LONG_PRESS_MS = 1200;

// Releasing before this counts as a quick tap and selects. Releasing after it
// - once the delete/remove progress bar is on screen - is treated as the user
// changing their mind, and does nothing at all. Making the tap window end
// exactly when the bar appears is what makes the rule visible: if you can see
// the bar, you have already left tap territory.
export const TV_LONG_PRESS_TAP_MS = 250;

/**
 * Set when a long press fires, cleared when the key is finally released.
 *
 * A long press removes the focused card, so it unmounts and focus moves to the
 * next one - while the user is still holding OK. The Android shell rebuilds a
 * fresh KeyEvent for every auto-repeat, so those repeats reach the newly
 * focused card looking like a brand new press; releasing a moment later then
 * read as a quick tap and played that card. This lives at module scope
 * precisely because it has to outlive the component that was just removed.
 */
let suppressUntilKeyUp = false;
let suppressedAt = 0;
let releaseListenerAttached = false;

/**
 * Safety valve. If a keyup is ever missed - focus moving between windows
 * mid-hold, a dropped event in the WebView - the suppression flag would stay
 * set and OK would be dead on every card from then on. Treat a suppression
 * older than this as stale rather than trusting the release to always arrive.
 */
const SUPPRESSION_MAX_MS = 5000;

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

  // The keyup that ends a suppressed hold may land on a different card, or on
  // <body> if the removed card left focus nowhere, so it cannot be cleared from
  // this card's own onKeyUp alone. One window-level listener for the whole app
  // owns that, attached on first use and left in place.
  useEffect(() => {
    if (releaseListenerAttached) return;
    releaseListenerAttached = true;
    window.addEventListener(
      'keyup',
      (event) => {
        if (event.key === 'Enter') suppressUntilKeyUp = false;
      },
      true,
    );
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter') return;

    // Stop the native click-on-keydown behaviour every time Enter fires,
    // including auto-repeats - otherwise a held key would keep re-triggering
    // select on every repeat while the long-press timer is running.
    event.preventDefault();

    // See point 1 above: a press already in flight is the signal, not
    // `event.repeat`.
    if (suppressUntilKeyUp) {
      if (Date.now() - suppressedAt < SUPPRESSION_MAX_MS) return;
      suppressUntilKeyUp = false;
    }
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
      suppressUntilKeyUp = true;
      suppressedAt = Date.now();
      setIsPressing(false);
      onLongPress(item);
    }, TV_LONG_PRESS_MS);
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter') return;

    suppressUntilKeyUp = false;

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

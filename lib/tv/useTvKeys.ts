'use client';

import { useEffect } from 'react';
import { moveFocus, type TvDirection } from './focus-model';
import { useTvFocus } from './TvFocusProvider';

const KEY_TO_DIRECTION: Record<string, TvDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export function useTvKeys(enabled: boolean) {
  const { rows, pos, setPos, getElement } = useTvFocus();

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction) return;

      // Arrow keys must not scroll the document - the focus engine owns them.
      event.preventDefault();

      const next = moveFocus(rows, pos, direction);
      setPos(next);

      const element = getElement(next);
      if (element) {
        element.focus({ preventScroll: true });
        // Instant, not smooth. Smooth scrolling silently no-ops in some WebView
        // configurations - measured: behavior 'smooth' left scrollY at 0 while
        // 'auto' scrolled correctly - and an instant snap is the normal feel for
        // a TV anyway, with no animation cost on weak hardware.
        element.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, rows, pos, setPos, getElement]);

  // Re-assert DOM focus after the element under `pos` is replaced (e.g. a row
  // remounts from skeleton to loaded content). Only steps in when focus was
  // genuinely lost - never steals it from something deliberately focused.
  useEffect(() => {
    if (!enabled) return;

    const element = getElement(pos);
    if (!element || element === document.activeElement) return;

    // Also take focus back when it is sitting on some *other* focusable of
    // ours. Only stepping in when focus was lost entirely was not enough:
    // after returning from the player the list re-sorts, focus stays on
    // whichever card the browser left it on, and the highlight ends up on a
    // different title than the one the model points at. Anything outside this
    // TV surface is still left alone.
    const active = document.activeElement;
    const isOurs = active instanceof HTMLElement && active.classList.contains('tv-focusable');
    if (active === null || active === document.body || isOurs) {
      element.focus({ preventScroll: true });
      // Bring the page to the highlight rather than leaving them disagreeing.
      // Coming back from the player, focus is restored to a card that may be
      // far down the grid while the page is still at the top - the user then
      // sees the top of the list with no visible highlight anywhere.
      element.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' });
    }
  }, [enabled, rows, pos, getElement]);
}

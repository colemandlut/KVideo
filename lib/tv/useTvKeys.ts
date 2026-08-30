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
        element.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, rows, pos, setPos, getElement]);
}

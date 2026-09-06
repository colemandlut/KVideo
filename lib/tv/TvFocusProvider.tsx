'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { canRestoreFocus, clampFocus, findFocusByKey, type TvFocusPos, type TvRowMeta } from './focus-model';

interface RowRegistration {
  rowIndex: number;
  length: number;
  keepColumn: boolean;
  elements: (HTMLElement | null)[];
  keys?: string[];
}

interface TvFocusContextValue {
  rows: TvRowMeta[];
  pos: TvFocusPos;
  setPos: (next: TvFocusPos) => void;
  registerRow: (id: string, rowIndex: number, length: number, keepColumn?: boolean, keys?: string[]) => void;
  unregisterRow: (id: string) => void;
  setItemElement: (id: string, itemIndex: number, el: HTMLElement | null) => void;
  getElement: (pos: TvFocusPos) => HTMLElement | null;
}

const TvFocusContext = createContext<TvFocusContextValue | null>(null);

/**
 * Where focus was when this screen was last left.
 *
 * Kept per URL so the results grid, the home screen and the favourites list
 * each remember their own spot. Session storage rather than a module variable
 * because the WebView reloads the page on some navigations, and a variable
 * would not survive that - the same reason the scroll position is stored
 * rather than held in memory.
 */
/**
 * Keyed by the surface as React sees it, never by window.location.
 *
 * Those two disagree exactly when it matters. Returning to the home screen is
 * a router.replace, and on the render where React has already switched back,
 * window.location.search still carries the old ?q= for an instant. Reading the
 * key from the browser URL therefore looked up the *results* entry, found
 * nothing, and armed the restore with null - which is why the saved home
 * position sat intact in storage and was still never applied.
 */
function focusStorageKey(surface: string): string {
  if (typeof window === 'undefined') return '';
  return `kvideo-tv-focus:${surface}`;
}

/**
 * The identity of the focused element, taken from a `data-tv-key` the focusable
 * puts on itself.
 *
 * A coordinate alone is not enough. The results grid re-sorts as latency and
 * playability measurements arrive, so {row 3, item 2} addresses a different
 * video after a return than it did before - the focus was restored faithfully
 * and still landed on the wrong card, which is indistinguishable from a broken
 * restore. The key survives reordering; the coordinate is kept only as a
 * fallback for lists that carry no keys.
 */
interface SavedFocus {
  pos: TvFocusPos;
  key?: string;
}

function readSavedFocus(surface: string): SavedFocus | null {
  const key = focusStorageKey(surface);
  if (!key) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TvFocusPos> & { key?: unknown };
    if (typeof parsed.rowIndex !== 'number' || typeof parsed.itemIndex !== 'number') return null;
    return {
      pos: { rowIndex: parsed.rowIndex, itemIndex: parsed.itemIndex },
      key: typeof parsed.key === 'string' ? parsed.key : undefined,
    };
  } catch {
    return null;
  }
}

export function TvFocusProvider({
  children,
  /**
   * Remember where focus was and put it back on return.
   *
   * Off by default, and deliberately not enabled for the search results:
   * that list re-sorts continuously as latency and playability measurements
   * arrive, so pinning focus to a card makes the highlight wander across the
   * screen on its own. A list that reorders under you should keep the
   * highlight still; only the home screen, whose rows do not reshuffle, wants
   * focus carried across a round trip.
   */
  restoreFocus = false,
}: {
  children: React.ReactNode;
  restoreFocus?: boolean;
}) {
  const registry = useRef(new Map<string, RowRegistration>());
  const [rows, setRows] = useState<TvRowMeta[]>([]);
  const [pos, setPosState] = useState<TvFocusPos>({ rowIndex: 0, itemIndex: 0 });
  /**
   * Identity of the item focus is meant to be on, when the row provides one.
   *
   * Focus follows the item, not the slot. The results grid keeps re-sorting
   * for several seconds as latency and playability measurements arrive, so a
   * position fixed at one moment points at a different video shortly after -
   * which is what made the restore land on the wrong card even though it ran
   * correctly. Re-resolving on every rows change keeps the highlight on the
   * same title through any reorder, whether that happens on return or while
   * the user is simply looking at the list.
   */

  const rebuildRows = useCallback(() => {
    const ordered = [...registry.current.entries()].sort((a, b) => a[1].rowIndex - b[1].rowIndex);
    setRows(ordered.map(([id, row]) => ({ id, length: row.length, keepColumn: row.keepColumn, keys: row.keys })));
  }, []);

  const registerRow = useCallback((id: string, rowIndex: number, length: number, keepColumn = false, keys?: string[]) => {
    const existing = registry.current.get(id);
    const sameKeys =
      existing?.keys === keys
      || (existing?.keys?.length === keys?.length
        && (keys ?? []).every((key, index) => existing?.keys?.[index] === key));
    if (
      existing
      && existing.rowIndex === rowIndex
      && existing.length === length
      && existing.keepColumn === keepColumn
      && sameKeys
    ) return;
    const elements = existing ? existing.elements.slice(0, length) : [];
    registry.current.set(id, { rowIndex, length, keepColumn, elements, keys });
    rebuildRows();
  }, [rebuildRows]);

  const unregisterRow = useCallback((id: string) => {
    registry.current.delete(id);
    rebuildRows();
  }, [rebuildRows]);

  const setItemElement = useCallback((id: string, itemIndex: number, el: HTMLElement | null) => {
    const row = registry.current.get(id);
    if (!row) return;
    row.elements[itemIndex] = el;
  }, []);

  const orderedIds = useMemo(() => rows.map((row) => row.id), [rows]);

  const getElement = useCallback((target: TvFocusPos) => {
    const id = orderedIds[target.rowIndex];
    if (!id) return null;
    const row = registry.current.get(id);
    if (!row || target.itemIndex < 0 || target.itemIndex >= row.length) return null;
    return row.elements[target.itemIndex] ?? null;
  }, [orderedIds]);

  const setPos = useCallback((next: TvFocusPos) => {
    setPosState(next);
  }, []);

  // Restoring waits until the saved coordinate actually addresses something.
  //
  // Waiting for "any row" is not enough, and that was the bug: coming back
  // from the player, the 返回 row registers first, so for a render or two the
  // grid is one row long. Restoring {row 3, item 2} then hands the clamp a
  // position it squashes to {0,0} - and the clamp commits, so the restore is
  // destroyed the instant it happens. The result looked exactly like no
  // restore at all.
  //
  // Adjusting state during render is React's documented pattern and the one
  // already used for the clamp; the pending value lives in state rather than a
  // ref because mutating a ref during render is a hard lint error here.
  // Re-arm whenever the surface changes, not only on mount. Going back to the
  // home screen from search results is a router.replace on the same page, so
  // nothing remounts - the restore had already been consumed and the saved
  // home position was never applied, leaving focus to be clamped up to the
  // top bar. That was the "returns to the 电影 button" report.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const surface = `${pathname}?${searchParams.toString()}`;
  const [restoredSurface, setRestoredSurface] = useState(surface);
  const [pendingRestore, setPendingRestore] = useState<SavedFocus | null>(
    () => (restoreFocus ? readSavedFocus(surface) : null),
  );

  if (restoredSurface !== surface) {
    setRestoredSurface(surface);

    if (restoreFocus) {
      setPendingRestore(readSavedFocus(surface));
    } else {
      // A surface that does not restore starts at the top-left rather than
      // inheriting wherever focus was on the previous one - the provider
      // outlives the switch between the home screen and the results list.
      setPendingRestore(null);
      setPosState({ rowIndex: 0, itemIndex: 0 });
    }
  }

  // Retried on every render until it lands, rather than applied once. Coming
  // back to the home screen tears down the results rows and builds the home
  // rows, and for a render in between there are no rows at all; a one-shot
  // restore falls into that gap, the clamp squashes it to {0,0} and commits,
  // and nothing tries again. That is why focus kept ending up on the top bar
  // even though the right position had been saved and read back.
  //
  // This converges rather than oscillates: once the position matches what the
  // lookup returns, nothing more is written.
  if (pendingRestore) {
    const byKey = pendingRestore.key ? findFocusByKey(rows, pendingRestore.key) : null;

    if (byKey) {
      if (byKey.rowIndex !== pos.rowIndex || byKey.itemIndex !== pos.itemIndex) {
        setPosState(byKey);
      } else {
        setPendingRestore(null);
      }
    } else if (canRestoreFocus(rows, pendingRestore.pos) && !pendingRestore.key) {
      // No identity to go on - restore the bare coordinate once it is valid.
      setPosState(pendingRestore.pos);
      setPendingRestore(null);
    } else {
      // The item is not there yet. A home row loads only once focus reaches
      // it, and an unloaded row registers a single skeleton item, so the row
      // would never load on its own. Step onto it at whatever column exists;
      // that triggers the load, and the lookup above finishes the job.
      const row = rows[pendingRestore.pos.rowIndex];
      if (row && pos.rowIndex !== pendingRestore.pos.rowIndex) {
        setPosState({
          rowIndex: pendingRestore.pos.rowIndex,
          itemIndex: Math.min(pendingRestore.pos.itemIndex, Math.max(0, row.length - 1)),
        });
      }
    }
  }

  // Clamp is computed during render (React's documented "adjust state during
  // render" pattern) and, when it differs from the stored position, written
  // straight back with setPosState. This makes the clamp a committed fact
  // rather than a derived value: once `pos` state itself holds the clamped
  // coordinate, a later render that grows `rows` again has nothing stale to
  // spring back to. Comparing field-by-field (not object identity) matters
  // because clampFocus allocates a new object on every call.
  const clamped = clampFocus(rows, pos);
  if (clamped.rowIndex !== pos.rowIndex || clamped.itemIndex !== pos.itemIndex) {
    setPosState(clamped);
  }

  // Persisted from an effect rather than during render: this is a side effect,
  // and it must reflect the position *after* the clamp and any anchor
  // correction, not the value that was passed in.
  const savedRowIndex = clamped.rowIndex;
  const savedItemIndex = clamped.itemIndex;
  // Read after the clamp, so the identity matches the position being stored.
  // Taking it when the key was pressed captured nothing: a row is a skeleton
  // with no identities for the first moments after focus lands on it.
  const savedKey = rows[clamped.rowIndex]?.keys?.[clamped.itemIndex];
  useEffect(() => {
    if (!restoreFocus) return;
    try {
      const storageKey = focusStorageKey(surface);
      if (!storageKey) return;
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ rowIndex: savedRowIndex, itemIndex: savedItemIndex, key: savedKey }),
      );
    } catch {
      // Storage disabled - focus simply will not be restored on return.
    }
  }, [restoreFocus, surface, savedRowIndex, savedItemIndex, savedKey]);

  const value = useMemo<TvFocusContextValue>(() => ({
    rows,
    pos: clamped,
    setPos,
    registerRow,
    unregisterRow,
    setItemElement,
    getElement,
  }), [rows, clamped, setPos, registerRow, unregisterRow, setItemElement, getElement]);

  return <TvFocusContext.Provider value={value}>{children}</TvFocusContext.Provider>;
}

export function useTvFocus(): TvFocusContextValue {
  const ctx = useContext(TvFocusContext);
  if (!ctx) throw new Error('useTvFocus must be used inside TvFocusProvider');
  return ctx;
}

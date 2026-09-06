'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
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
function focusStorageKey(): string {
  if (typeof window === 'undefined') return '';
  return `kvideo-tv-focus:${window.location.pathname}${window.location.search}`;
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

function readSavedFocus(): SavedFocus | null {
  const key = focusStorageKey();
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

export function TvFocusProvider({ children }: { children: React.ReactNode }) {
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
  const [anchorKey, setAnchorKey] = useState<string | null>(null);

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

  // Depends on `rows` so the identity written alongside the coordinate is the
  // one currently at that position.
  const setPos = useCallback((next: TvFocusPos) => {
    setPosState(next);
    setAnchorKey(rows[next.rowIndex]?.keys?.[next.itemIndex] ?? null);
    try {
      const storageKey = focusStorageKey();
      if (!storageKey) return;
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ ...next, key: rows[next.rowIndex]?.keys?.[next.itemIndex] }),
      );
    } catch {
      // Storage disabled - focus simply will not be restored on return.
    }
  }, [rows]);

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
  const [pendingRestore, setPendingRestore] = useState<SavedFocus | null>(() => readSavedFocus());
  if (pendingRestore) {
    // Prefer the item's own identity: the grid re-sorts as measurements
    // arrive, so the coordinate that was saved may already point at a
    // different video. Fall back to the coordinate for lists without keys.
    const byKey = pendingRestore.key ? findFocusByKey(rows, pendingRestore.key) : null;
    const target = byKey ?? (canRestoreFocus(rows, pendingRestore.pos) ? pendingRestore.pos : null);

    if (target) {
      setPosState(target);
      setAnchorKey(byKey ? pendingRestore.key ?? null : null);
      setPendingRestore(null);
    }
  } else if (anchorKey) {
    // The list can reorder again at any time - restoring once is not enough,
    // and that is why focus still ended up on the wrong card after a return.
    // Keep the position pinned to the item it belongs to.
    const current = findFocusByKey(rows, anchorKey);
    if (current && (current.rowIndex !== pos.rowIndex || current.itemIndex !== pos.itemIndex)) {
      setPosState(current);
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

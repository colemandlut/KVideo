'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { clampFocus, type TvFocusPos, type TvRowMeta } from './focus-model';

interface RowRegistration {
  rowIndex: number;
  length: number;
  keepColumn: boolean;
  elements: (HTMLElement | null)[];
}

interface TvFocusContextValue {
  rows: TvRowMeta[];
  pos: TvFocusPos;
  setPos: (next: TvFocusPos) => void;
  registerRow: (id: string, rowIndex: number, length: number, keepColumn?: boolean) => void;
  unregisterRow: (id: string) => void;
  setItemElement: (id: string, itemIndex: number, el: HTMLElement | null) => void;
  getElement: (pos: TvFocusPos) => HTMLElement | null;
}

const TvFocusContext = createContext<TvFocusContextValue | null>(null);

export function TvFocusProvider({ children }: { children: React.ReactNode }) {
  const registry = useRef(new Map<string, RowRegistration>());
  const [rows, setRows] = useState<TvRowMeta[]>([]);
  const [pos, setPosState] = useState<TvFocusPos>({ rowIndex: 0, itemIndex: 0 });

  const rebuildRows = useCallback(() => {
    const ordered = [...registry.current.entries()].sort((a, b) => a[1].rowIndex - b[1].rowIndex);
    setRows(ordered.map(([id, row]) => ({ id, length: row.length, keepColumn: row.keepColumn })));
  }, []);

  const registerRow = useCallback((id: string, rowIndex: number, length: number, keepColumn = false) => {
    const existing = registry.current.get(id);
    if (
      existing
      && existing.rowIndex === rowIndex
      && existing.length === length
      && existing.keepColumn === keepColumn
    ) return;
    const elements = existing ? existing.elements.slice(0, length) : [];
    registry.current.set(id, { rowIndex, length, keepColumn, elements });
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

  const rawClampedPos = clampFocus(rows, pos);
  // Keyed on the primitive values (not the object) so the returned TvFocusPos
  // keeps a stable identity across renders where the clamped position hasn't
  // actually changed, even though clampFocus always allocates a new object.
  const clampedPos = useMemo<TvFocusPos>(
    () => rawClampedPos,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawClampedPos.rowIndex, rawClampedPos.itemIndex],
  );

  const value = useMemo<TvFocusContextValue>(() => ({
    rows,
    pos: clampedPos,
    setPos,
    registerRow,
    unregisterRow,
    setItemElement,
    getElement,
  }), [rows, clampedPos, setPos, registerRow, unregisterRow, setItemElement, getElement]);

  return <TvFocusContext.Provider value={value}>{children}</TvFocusContext.Provider>;
}

export function useTvFocus(): TvFocusContextValue {
  const ctx = useContext(TvFocusContext);
  if (!ctx) throw new Error('useTvFocus must be used inside TvFocusProvider');
  return ctx;
}

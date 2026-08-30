export type TvDirection = 'up' | 'down' | 'left' | 'right';

export interface TvRowMeta {
  /** Row identity, used by row components to find themselves in the registry. */
  id: string;
  /** Number of focusable items. An unloaded row registers 1 for its skeleton. */
  length: number;
}

export interface TvFocusPos {
  /** Index into the rows array, in visual order. Not the row id. */
  rowIndex: number;
  itemIndex: number;
}

export function findFirstFocusable(rows: TvRowMeta[]): TvFocusPos | null {
  const rowIndex = rows.findIndex((row) => row.length > 0);
  return rowIndex === -1 ? null : { rowIndex, itemIndex: 0 };
}

export function clampFocus(rows: TvRowMeta[], pos: TvFocusPos): TvFocusPos {
  if (rows.length === 0) return { rowIndex: 0, itemIndex: 0 };

  const rowIndex = Math.min(Math.max(0, pos.rowIndex), rows.length - 1);
  const length = rows[rowIndex].length;

  if (length === 0) {
    return findFirstFocusable(rows) ?? { rowIndex, itemIndex: 0 };
  }

  return { rowIndex, itemIndex: Math.min(Math.max(0, pos.itemIndex), length - 1) };
}

export function isAtRowEnd(rows: TvRowMeta[], pos: TvFocusPos): boolean {
  const row = rows[pos.rowIndex];
  return Boolean(row) && row.length > 0 && pos.itemIndex >= row.length - 1;
}

export function moveFocus(rows: TvRowMeta[], current: TvFocusPos, dir: TvDirection): TvFocusPos {
  if (rows.length === 0) return current;

  const row = rows[current.rowIndex];
  if (!row || row.length === 0) {
    return findFirstFocusable(rows) ?? current;
  }

  if (dir === 'left') {
    return { rowIndex: current.rowIndex, itemIndex: Math.max(0, current.itemIndex - 1) };
  }

  if (dir === 'right') {
    return { rowIndex: current.rowIndex, itemIndex: Math.min(row.length - 1, current.itemIndex + 1) };
  }

  const step = dir === 'up' ? -1 : 1;
  for (let i = current.rowIndex + step; i >= 0 && i < rows.length; i += step) {
    if (rows[i].length > 0) {
      return { rowIndex: i, itemIndex: Math.min(current.itemIndex, rows[i].length - 1) };
    }
  }

  return current;
}

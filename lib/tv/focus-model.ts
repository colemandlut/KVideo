export type TvDirection = 'up' | 'down' | 'left' | 'right';

export interface TvRowMeta {
  /** Row identity, used by row components to find themselves in the registry. */
  id: string;
  /** Number of focusable items. An unloaded row registers 1 for its skeleton. */
  length: number;
  /** True for grid rows, where up/down should stay in the same column.
   *  Carousel rows leave this unset: each has its own horizontal scroll offset,
   *  so preserving the column would hide the start of every row below. */
  keepColumn?: boolean;
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

/**
 * Computes the next focus position for a D-pad press.
 *
 * Left/right move within the current row and stop at either end (no wrapping).
 *
 * Up/down move to the nearest non-empty row in that direction. Which column
 * they land on depends on the *target* row's `keepColumn` flag:
 *  - Unset (the default, carousel rows): land on that row's first item
 *    (index 0), rather than preserving the current column. Each carousel row
 *    is an independently horizontally-scrolling strip with its own scroll
 *    offset, so preserving the column would carry a scrolled-right offset
 *    into every row visited afterward, making it impossible to see the start
 *    of the rows below. Resetting to item 0 keeps every carousel row you land
 *    on starting from its beginning.
 *  - True (grid rows): keep the current column, clamped to that row's
 *    length, since a grid row has no independent scroll offset to hide - the
 *    columns line up the way a normal grid's do.
 */
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
      const itemIndex = rows[i].keepColumn ? Math.min(current.itemIndex, rows[i].length - 1) : 0;
      return { rowIndex: i, itemIndex };
    }
  }

  return current;
}

/**
 * Whether a saved focus position can be restored yet.
 *
 * Restoring must wait for the coordinate to actually address something.
 * "Any row has registered" is not enough: coming back from the player the
 * 返回 row registers first, so for a render or two the grid is one row long.
 * Restoring {row 3, item 2} into that hands the clamp a position it squashes
 * to {0,0} - and the clamp commits, destroying the restore the instant it
 * happens. The screen then looks exactly as if nothing had been saved.
 */
export function canRestoreFocus(rows: TvRowMeta[], saved: TvFocusPos): boolean {
  const row = rows[saved.rowIndex];
  return row !== undefined && row.length > saved.itemIndex;
}

# 电视端导航与首页 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Android TV 的遥控器方向键可以在页面元素间移动焦点并用 Enter 激活，并把首页改成每个分类一行横向卡片的电视布局。

**Architecture:** 焦点由一个纯函数模型（行 × 列）决定坐标，再调用真实 DOM 的 `element.focus()`；Enter 激活走浏览器原生的 button click。电视组件是独立的一套（`components/tv/`），在页面顶层由 `useIsTvLike()` 分流，手机与桌面完全不进这条路径。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Tailwind v4、`node:test` + `tsx`（仓库现有 `npm test`）

**设计文档：** `docs/superpowers/specs/2026-08-30-tv-navigation-design.md`

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `lib/tv/focus-model.ts` | 纯函数：坐标计算。不接触 DOM、不引入 React |
| `lib/tv/TvFocusProvider.tsx` | React context：行注册表、当前坐标、元素 ref 表 |
| `lib/tv/useTvKeys.ts` | 全局 keydown → 模型 → `focus()` + `scrollIntoView` |
| `components/tv/TvPosterCard.tsx` | 单张海报卡片（真实 `<button>`） |
| `components/tv/TvRow.tsx` | 一行横向卡片，自行取数并注册到焦点模型 |
| `components/tv/TvRecommendRow.tsx` | 「为你推荐」行（用另一个 hook，无历史时注册长度 0） |
| `components/tv/TvHome.tsx` | 电视首页骨架，装配顶栏行 + 推荐行 + 分类行 |
| `app/styles/tv.css` | 焦点环、放大动效、`scroll-margin-top` |
| `tests/tv-focus-model.test.ts` | `focus-model.ts` 的单元测试 |

对现有文件的改动只有一处：`app/page.tsx` 顶部加一个分支。

---

### Task 1: 焦点模型（纯函数）

**Files:**
- Create: `lib/tv/focus-model.ts`
- Test: `tests/tv-focus-model.test.ts`

- [ ] **Step 1: 写失败的测试**

创建 `tests/tv-focus-model.test.ts`：

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { moveFocus, clampFocus, findFirstFocusable, isAtRowEnd } from '@/lib/tv/focus-model';
import type { TvRowMeta } from '@/lib/tv/focus-model';

const rows: TvRowMeta[] = [
  { id: 'topbar', length: 3 },
  { id: 'recommend', length: 6 },
  { id: 'empty', length: 0 },
  { id: 'popular', length: 2 },
];

test('right moves within the row and stops at the end', () => {
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 0 }, 'right'), { rowIndex: 1, itemIndex: 1 });
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 5 }, 'right'), { rowIndex: 1, itemIndex: 5 });
});

test('left moves within the row and stops at the start', () => {
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 3 }, 'left'), { rowIndex: 1, itemIndex: 2 });
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 0 }, 'left'), { rowIndex: 1, itemIndex: 0 });
});

test('down skips a row that loaded but has no items', () => {
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 0 }, 'down'), { rowIndex: 3, itemIndex: 0 });
});

test('changing row keeps the column, clamped to the shorter row', () => {
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 5 }, 'down'), { rowIndex: 3, itemIndex: 1 });
  assert.deepEqual(moveFocus(rows, { rowIndex: 1, itemIndex: 5 }, 'up'), { rowIndex: 0, itemIndex: 2 });
});

test('up from the first row stays put', () => {
  assert.deepEqual(moveFocus(rows, { rowIndex: 0, itemIndex: 1 }, 'up'), { rowIndex: 0, itemIndex: 1 });
});

test('down from the last row stays put', () => {
  assert.deepEqual(moveFocus(rows, { rowIndex: 3, itemIndex: 1 }, 'down'), { rowIndex: 3, itemIndex: 1 });
});

test('findFirstFocusable returns the first non-empty row', () => {
  assert.deepEqual(findFirstFocusable([{ id: 'a', length: 0 }, { id: 'b', length: 2 }]), { rowIndex: 1, itemIndex: 0 });
  assert.equal(findFirstFocusable([{ id: 'a', length: 0 }]), null);
});

test('clampFocus pulls a stale position back in range when a row shrinks', () => {
  const shrunk: TvRowMeta[] = [{ id: 'topbar', length: 3 }, { id: 'recommend', length: 2 }];
  assert.deepEqual(clampFocus(shrunk, { rowIndex: 1, itemIndex: 5 }), { rowIndex: 1, itemIndex: 1 });
  assert.deepEqual(clampFocus(shrunk, { rowIndex: 9, itemIndex: 0 }), { rowIndex: 1, itemIndex: 0 });
});

test('isAtRowEnd reports the last item of a row', () => {
  assert.equal(isAtRowEnd(rows, { rowIndex: 3, itemIndex: 1 }), true);
  assert.equal(isAtRowEnd(rows, { rowIndex: 3, itemIndex: 0 }), false);
  assert.equal(isAtRowEnd(rows, { rowIndex: 2, itemIndex: 0 }), false);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test 2>&1 | grep -A3 "tv-focus-model"`
Expected: FAIL —— 模块不存在（`Cannot find module '@/lib/tv/focus-model'`）

- [ ] **Step 3: 写最小实现**

创建 `lib/tv/focus-model.ts`：

```ts
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test 2>&1 | tail -8`
Expected: `pass 93`，`fail 0`（基线 84 + 新增 9 个测试）

- [ ] **Step 5: 提交**

```bash
git add lib/tv/focus-model.ts tests/tv-focus-model.test.ts
git commit -m "feat(tv): add the pure focus model for remote navigation"
```

---

### Task 2: 焦点 Provider

**Files:**
- Create: `lib/tv/TvFocusProvider.tsx`

- [ ] **Step 1: 写实现**

创建 `lib/tv/TvFocusProvider.tsx`：

```tsx
'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { clampFocus, type TvFocusPos, type TvRowMeta } from './focus-model';

interface RowRegistration {
  rowIndex: number;
  length: number;
  elements: (HTMLElement | null)[];
}

interface TvFocusContextValue {
  rows: TvRowMeta[];
  pos: TvFocusPos;
  setPos: (next: TvFocusPos) => void;
  registerRow: (id: string, rowIndex: number, length: number) => void;
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
    setRows(ordered.map(([id, row]) => ({ id, length: row.length })));
  }, []);

  const registerRow = useCallback((id: string, rowIndex: number, length: number) => {
    const existing = registry.current.get(id);
    if (existing && existing.rowIndex === rowIndex && existing.length === length) return;
    registry.current.set(id, { rowIndex, length, elements: existing?.elements ?? [] });
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
    return registry.current.get(id)?.elements[target.itemIndex] ?? null;
  }, [orderedIds]);

  const setPos = useCallback((next: TvFocusPos) => {
    setPosState(next);
  }, []);

  const value = useMemo<TvFocusContextValue>(() => ({
    rows,
    pos: clampFocus(rows, pos),
    setPos,
    registerRow,
    unregisterRow,
    setItemElement,
    getElement,
  }), [rows, pos, setPos, registerRow, unregisterRow, setItemElement, getElement]);

  return <TvFocusContext.Provider value={value}>{children}</TvFocusContext.Provider>;
}

export function useTvFocus(): TvFocusContextValue {
  const ctx = useContext(TvFocusContext);
  if (!ctx) throw new Error('useTvFocus must be used inside TvFocusProvider');
  return ctx;
}
```

- [ ] **Step 2: 确认类型通过**

Run: `npx tsc --noEmit`
Expected: 无输出（通过）

- [ ] **Step 3: 提交**

```bash
git add lib/tv/TvFocusProvider.tsx
git commit -m "feat(tv): add the focus registry provider"
```

---

### Task 3: 按键处理

**Files:**
- Create: `lib/tv/useTvKeys.ts`

- [ ] **Step 1: 写实现**

创建 `lib/tv/useTvKeys.ts`：

```ts
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
```

- [ ] **Step 2: 确认类型与 lint 通过**

Run: `npx tsc --noEmit && npx eslint lib/tv/`
Expected: tsc 无输出；eslint 无 error

- [ ] **Step 3: 提交**

```bash
git add lib/tv/useTvKeys.ts
git commit -m "feat(tv): drive DOM focus from arrow keys"
```

---

### Task 4: 焦点样式

**Files:**
- Create: `app/styles/tv.css`
- Modify: `app/globals.css`（追加一行 import）

- [ ] **Step 1: 写样式**

创建 `app/styles/tv.css`：

```css
.tv-root {
  --tv-topbar-height: 72px;
}

.tv-focusable {
  scroll-margin-top: calc(var(--tv-topbar-height) + 16px);
  scroll-margin-left: 32px;
  scroll-margin-right: 32px;
  transition: transform 160ms ease-out, box-shadow 160ms ease-out, opacity 160ms ease-out;
  opacity: 0.72;
  outline: none;
}

.tv-focusable:focus {
  opacity: 1;
  transform: scale(1.08);
  box-shadow: 0 0 0 4px #3b82f6, 0 0 0 8px rgba(59, 130, 246, 0.35);
  z-index: 5;
}

.tv-row-title {
  font-size: 18px;
  font-weight: 500;
  margin: 0 0 10px 32px;
}

.tv-row-strip {
  display: flex;
  gap: 16px;
  padding: 8px 32px 20px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tv-row-strip::-webkit-scrollbar {
  display: none;
}
```

在 `app/globals.css` 现有 `@import` 之后追加：

```css
@import './styles/tv.css';
```

- [ ] **Step 2: 确认构建通过**

Run: `npm run build 2>&1 | tail -5`
Expected: 构建成功，无 CSS 错误

- [ ] **Step 3: 提交**

```bash
git add app/styles/tv.css app/globals.css
git commit -m "feat(tv): add focus ring and row strip styles"
```

---

### Task 5: 海报卡片

**Files:**
- Create: `components/tv/TvPosterCard.tsx`

- [ ] **Step 1: 写实现**

创建 `components/tv/TvPosterCard.tsx`。卡片宽度按 960 CSS px 画布定为 148px，一行可见约 5–6 张。

```tsx
'use client';

import { forwardRef } from 'react';

export interface TvMovie {
  id: string;
  title: string;
  cover: string;
  rate: string;
  url: string;
}

interface TvPosterCardProps {
  movie: TvMovie;
  onSelect: (movie: TvMovie) => void;
}

export const TvPosterCard = forwardRef<HTMLButtonElement, TvPosterCardProps>(
  function TvPosterCard({ movie, onSelect }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        tabIndex={-1}
        className="tv-focusable flex-shrink-0 w-[148px] text-left"
        onClick={() => onSelect(movie)}
      >
        <div className="relative w-[148px] h-[208px] rounded-[10px] overflow-hidden bg-[#252b36]">
          {movie.cover ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/douban/image?url=${encodeURIComponent(movie.cover)}`}
              alt={movie.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : null}
          {movie.rate ? (
            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[13px] text-amber-300">
              {movie.rate}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[15px] leading-tight line-clamp-2">{movie.title}</p>
      </button>
    );
  }
);
```

- [ ] **Step 2: 确认类型通过**

Run: `npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 3: 提交**

```bash
git add components/tv/TvPosterCard.tsx
git commit -m "feat(tv): add the TV poster card"
```

---

### Task 6: 分类行

**Files:**
- Create: `components/tv/TvRow.tsx`

行自己取数。未加载时注册 length 1（骨架可聚焦），避免焦点永远到不了它而导致的死锁。

- [ ] **Step 1: 写实现**

创建 `components/tv/TvRow.tsx`。

关键点：`usePopularMovies` 在 effect 里**无条件**发请求，传空 tag 反而会 fallback 去拉「热门」。所以不能靠参数关掉请求，必须**在未加载时根本不挂载调用该 hook 的组件**。因此拆成外壳 + 内层两个组件。

```tsx
'use client';

import { useEffect } from 'react';
import { usePopularMovies } from '@/components/home/hooks/usePopularMovies';
import { useTvFocus } from '@/lib/tv/TvFocusProvider';
import { TvPosterCard, type TvMovie } from './TvPosterCard';

export interface TvTag {
  id: string;
  label: string;
  value: string;
}

interface TvRowProps {
  id: string;
  rowIndex: number;
  title: string;
  tagId: string;
  tags: TvTag[];
  /** False keeps the row a focusable skeleton and never mounts the fetching child. */
  shouldLoad: boolean;
  onSelect: (movie: TvMovie) => void;
}

/** Registers the row with the focus model. Length 1 means "one focusable skeleton". */
function useRowRegistration(id: string, rowIndex: number, length: number) {
  const { registerRow, unregisterRow } = useTvFocus();

  useEffect(() => {
    registerRow(id, rowIndex, length);
    return () => unregisterRow(id);
  }, [id, rowIndex, length, registerRow, unregisterRow]);
}

export function TvRowSkeleton({ id, rowIndex, title }: { id: string; rowIndex: number; title: string }) {
  const { setItemElement } = useTvFocus();
  useRowRegistration(id, rowIndex, 1);

  return (
    <section>
      <h2 className="tv-row-title">{title}</h2>
      <div className="tv-row-strip">
        <button
          ref={(el) => setItemElement(id, 0, el)}
          type="button"
          tabIndex={-1}
          className="tv-focusable flex-shrink-0 w-[148px] h-[208px] rounded-[10px] bg-[#252b36]"
          aria-label={`${title} 加载中`}
        />
      </div>
    </section>
  );
}

function TvRowLoaded({ id, rowIndex, title, tagId, tags, onSelect }: Omit<TvRowProps, 'shouldLoad'>) {
  const { setItemElement } = useTvFocus();
  const { movies } = usePopularMovies(tagId, tags, 'movie');

  // Still one focusable skeleton slot until the first page arrives.
  useRowRegistration(id, rowIndex, movies.length > 0 ? movies.length : 1);

  if (movies.length === 0) {
    return <TvRowSkeleton id={id} rowIndex={rowIndex} title={title} />;
  }

  return (
    <section>
      <h2 className="tv-row-title">{title}</h2>
      <div className="tv-row-strip">
        {movies.map((movie, index) => (
          <TvPosterCard
            key={movie.id}
            movie={movie}
            onSelect={onSelect}
            ref={(el) => setItemElement(id, index, el)}
          />
        ))}
      </div>
    </section>
  );
}

export function TvRow(props: TvRowProps) {
  const { shouldLoad, ...rest } = props;

  if (!shouldLoad) {
    return <TvRowSkeleton id={rest.id} rowIndex={rest.rowIndex} title={rest.title} />;
  }

  return <TvRowLoaded {...rest} />;
}
```

**注意**：`TvRowSkeleton` 会在 `TvRowLoaded` 内部被复用（movies 为空时），此时两者都注册同一个 id、同一个 rowIndex、同样的 length 1，`registerRow` 内部有相等判断不会重复触发重建，是安全的。

- [ ] **Step 2: 确认类型通过**

Run: `npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 3: 提交**

```bash
git add components/tv/TvRow.tsx
git commit -m "feat(tv): add a category row that registers with the focus model"
```

---

### Task 6b: 「为你推荐」行

**Files:**
- Create: `components/tv/TvRecommendRow.tsx`

「为你推荐」用的是 `usePersonalizedRecommendations`，不是 `usePopularMovies`，因此单独一个组件。用户没有观看历史时该行**注册长度 0**——焦点模型会把它当空行跳过，不需要额外的显隐逻辑。

- [ ] **Step 1: 写实现**

```tsx
'use client';

import { useEffect } from 'react';
import { usePersonalizedRecommendations } from '@/components/home/hooks/usePersonalizedRecommendations';
import { useTvFocus } from '@/lib/tv/TvFocusProvider';
import { TvPosterCard, type TvMovie } from './TvPosterCard';

interface TvRecommendRowProps {
  id: string;
  rowIndex: number;
  onSelect: (movie: TvMovie) => void;
}

export function TvRecommendRow({ id, rowIndex, onSelect }: TvRecommendRowProps) {
  const { registerRow, unregisterRow, setItemElement } = useTvFocus();
  const { movies, hasHistory } = usePersonalizedRecommendations(false);

  // No history means no row at all - length 0 makes the focus model skip it.
  const length = hasHistory ? Math.max(1, movies.length) : 0;

  useEffect(() => {
    registerRow(id, rowIndex, length);
    return () => unregisterRow(id);
  }, [id, rowIndex, length, registerRow, unregisterRow]);

  if (!hasHistory) return null;

  return (
    <section>
      <h2 className="tv-row-title">为你推荐</h2>
      <div className="tv-row-strip">
        {movies.length > 0 ? (
          movies.map((movie, index) => (
            <TvPosterCard
              key={movie.id}
              movie={movie}
              onSelect={onSelect}
              ref={(el) => setItemElement(id, index, el)}
            />
          ))
        ) : (
          <button
            ref={(el) => setItemElement(id, 0, el)}
            type="button"
            tabIndex={-1}
            className="tv-focusable flex-shrink-0 w-[148px] h-[208px] rounded-[10px] bg-[#252b36]"
            aria-label="为你推荐 加载中"
          />
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 确认类型通过**

Run: `npx tsc --noEmit`
Expected: 无输出

- [ ] **Step 3: 提交**

```bash
git add components/tv/TvRecommendRow.tsx
git commit -m "feat(tv): add the personalised recommendation row"
```

---

### Task 7: 电视首页

**Files:**
- Create: `components/tv/TvHome.tsx`

- [ ] **Step 1: 写实现**

创建 `components/tv/TvHome.tsx`。首屏加载前 2 行，之后加载「当前焦点行 + 1」，避免每次下移都先看骨架。

```tsx
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TvFocusProvider, useTvFocus } from '@/lib/tv/TvFocusProvider';
import { useTvKeys } from '@/lib/tv/useTvKeys';
import { TvRow } from './TvRow';
import { TvRecommendRow } from './TvRecommendRow';
import type { TvMovie } from './TvPosterCard';

const TV_CATEGORIES = [
  { id: 'popular', title: '热门', value: '热门' },
  { id: 'latest', title: '最新', value: '最新' },
  { id: 'top', title: '豆瓣高分', value: '豆瓣高分' },
  { id: 'hidden', title: '冷门佳片', value: '冷门佳片' },
  { id: 'chinese', title: '华语', value: '华语' },
  { id: 'western', title: '欧美', value: '欧美' },
  { id: 'korean', title: '韩国', value: '韩国' },
  { id: 'japanese', title: '日本', value: '日本' },
];

const TAGS = TV_CATEGORIES.map((c) => ({ id: c.id, label: c.title, value: c.value }));

function TvHomeContent() {
  const router = useRouter();
  const { pos, setItemElement } = useTvFocus();
  useTvKeys(true);

  const topbarRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const setTopbarRef = useCallback((index: number) => (el: HTMLButtonElement | null) => {
    topbarRefs.current[index] = el;
    setItemElement('topbar', index, el);
  }, [setItemElement]);

  const handleSelect = useCallback((movie: TvMovie) => {
    router.push(`/?q=${encodeURIComponent(movie.title)}`);
  }, [router]);

  return (
    <div className="tv-root min-h-screen bg-[#0f1218] text-[#e8eaed]">
      <TopbarRow
        setTopbarRef={setTopbarRef}
        onSearch={() => router.push('/?focus=search')}
        onFavorites={() => router.push('/favorites')}
        onSettings={() => router.push('/settings')}
      />

      <TvRecommendRow id="recommend" rowIndex={1} onSelect={handleSelect} />

      {TV_CATEGORIES.map((category, index) => {
        const rowIndex = index + 2;
        return (
          <TvRow
            key={category.id}
            id={category.id}
            rowIndex={rowIndex}
            title={category.title}
            tagId={category.id}
            tags={TAGS}
            shouldLoad={rowIndex <= Math.max(2, pos.rowIndex + 1)}
            onSelect={handleSelect}
          />
        );
      })}
    </div>
  );
}

interface TopbarRowProps {
  setTopbarRef: (index: number) => (el: HTMLButtonElement | null) => void;
  onSearch: () => void;
  onFavorites: () => void;
  onSettings: () => void;
}

function TopbarRow({ setTopbarRef, onSearch, onFavorites, onSettings }: TopbarRowProps) {
  const { registerRow, unregisterRow } = useTvFocus();

  const actions = [
    { label: '搜索', onClick: onSearch },
    { label: '收藏', onClick: onFavorites },
    { label: '设置', onClick: onSettings },
  ];
  const length = actions.length;

  useEffect(() => {
    registerRow('topbar', 0, length);
    return () => unregisterRow('topbar');
  }, [length, registerRow, unregisterRow]);

  return (
    <div className="tv-row-strip pt-6">
      {actions.map((action, index) => (
        <button
          key={action.label}
          ref={setTopbarRef(index)}
          type="button"
          tabIndex={-1}
          className="tv-focusable flex-shrink-0 px-7 py-3 rounded-full bg-[#252b36] text-[16px]"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export function TvHome() {
  return (
    <TvFocusProvider>
      <TvHomeContent />
    </TvFocusProvider>
  );
}
```

- [ ] **Step 2: 确认类型与 lint 通过**

Run: `npx tsc --noEmit && npx eslint components/tv/ lib/tv/`
Expected: tsc 无输出；eslint 无 error

- [ ] **Step 3: 提交**

```bash
git add components/tv/TvHome.tsx
git commit -m "feat(tv): add the TV home screen"
```

---

### Task 8: 接入首页并验证

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 加分流分支**

在 `app/page.tsx` 的 import 区加：

```tsx
import { useIsTvLike } from '@/lib/hooks/mobile/useDeviceDetection';
import { TvHome } from '@/components/tv/TvHome';
```

在 `function HomePage() {` 内部，**所有现有 hook 调用之后、`return (` 之前**加：

```tsx
  const isTvLike = useIsTvLike();
  if (isTvLike) return <TvHome />;
```

放在所有 hook 之后是必须的——提前 return 会违反 hooks 规则。

- [ ] **Step 2: 全量检查**

Run: `npm test 2>&1 | tail -6 && npx tsc --noEmit && npx eslint app/page.tsx components/tv/ lib/tv/ && npm run pages:build 2>&1 | tail -3`
Expected: 测试 `fail 0`；tsc 无输出；eslint 无 error；构建退出码 0

- [ ] **Step 3: 电视视口人工验证**

启动 `npx next dev -p 3100`，浏览器视口设为 **960×540**，打开 `http://localhost:3100`，并在控制台注入 `window.KVideoAndroid = {}` 后触发 `resize` 使 `isTvLike` 为真。

依次确认：
- 首屏出现顶栏行 + 分类行，前 2 行有海报，其余是骨架
- 按 ↓ 焦点从顶栏进入第一行海报，焦点卡片放大并有蓝环
- 按 → 焦点在行内右移，到最后一张停住不越界
- 按 ↓ 到骨架行，该行随即开始加载并填入海报
- **页面本身不再随方向键滚动**，只有焦点元素被滚入视野
- 按 Enter 跳转到该影片的搜索结果

- [ ] **Step 4: 手机回归验证**

视口设为 **375×812**，重新加载（不注入 `KVideoAndroid`）。确认渲染的仍是原有首页（搜索框 + PopularFeatures 网格），方向键行为不变。

- [ ] **Step 5: 提交**

```bash
git add app/page.tsx
git commit -m "feat(tv): route the home page to the TV screen on TV-like devices"
```

---

## 完成标准

- `npm test` 全绿，新增 9 个 focus-model 测试（84 → 93）
- `npx tsc --noEmit` 通过
- `npx eslint` 在改动文件上无新增 error（基线已有的 `useIsIOS` 的 `any` error 除外）
- `npm run pages:build` 退出码 0
- 960×540 视口下遥控器按键行为符合 Task 8 Step 3 的全部条目
- 375×812 视口下首页与改动前完全一致

---

## 执行期间的偏离记录

计划执行时发现并处理的问题，记在这里以免下次重蹈覆辙。

**新增 Task 7b（电视版搜索结果页）。** 原计划漏了一个洞：定义了首页长什么样、焦点怎么走，却没定义「选中一部片之后会怎样」。实现到 Task 7 时才发现按 Enter 完全没反应——`app/page.tsx` 的提前返回让搜索结果 JSX 永远到不了，而 `useHomePage` 读 `?q=` 的 effect 只在挂载时跑一次，同路由 `router.push` 不会重新挂载。修法是把搜索留在 React state 里而不是 URL 里，并新增 `TvSearchResults`。

**焦点注册的单一所有权。** `TvRowLoaded` 和它渲染的 `TvRowSkeleton` 原本注册同一个 id，子组件的 effect 清理会删掉父组件的注册项（连同 ref 刚写入的元素表）。当时能工作纯属巧合——任何 `rows` 变化都会重渲染所有行并重新触发 ref 回调补回来。已改为「一个 id 只有一个注册所有者」，并在代码里留了注释说明。

**懒加载阈值必须单调。** 用实时的 `pos.rowIndex` 算 `shouldLoad` 会在焦点回上时卸载已加载的行、丢弃数据并重新请求豆瓣。改为高水位标记。

**海报图片不要再包一层代理。** `/api/douban/recommend` 返回的 `cover` 已经是 `/api/douban/image?url=...`，再包一次会得到 502。

**性能实测。** dev 模式下每次方向键约 936ms，生产构建下约 40ms。dev 的数字不能用来判断。所有行共用同一个 context value，`pos` 一变全部重渲染——在更慢的电视硬件上可能仍需拆分 context，待真机验证。

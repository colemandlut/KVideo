'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TvFocusProvider, useTvFocus } from '@/lib/tv/TvFocusProvider';
import { useTvKeys } from '@/lib/tv/useTvKeys';
import { useSettingsPage } from '@/app/settings/hooks/useSettingsPage';
import { useTheme } from '@/components/ThemeProvider';
import { useRuntimeFeatures } from '@/components/RuntimeFeaturesProvider';
import { PermissionGate } from '@/components/PermissionGate';
import { clearSession, getSession } from '@/lib/store/auth-store';

/** How long a destructive button stays in its "press again to confirm" state
 *  before quietly reverting - long enough to glance at the label and press
 *  OK again, short enough that walking away doesn't leave a live trap for
 *  whoever picks up the remote next. */
const CONFIRM_RESET_MS = 4000;

/** Row indices are only a sort key for TvFocusProvider (see focus-model.ts:
 *  rows are compacted into contiguous positions once sorted), so a row that
 *  never registers - proxy mode when the media proxy is off, player/data
 *  sections behind a missing permission, the logout row when logged out -
 *  simply leaves a gap with no navigation dead end. */
const ROW = {
  back: 0,
  fullscreenType: 1,
  proxyMode: 2,
  theme: 3,
  locale: 4,
  realtimeLatency: 5,
  searchDisplayMode: 6,
  clearData: 7,
  logout: 8,
} as const;

/** Exactly one component may own the registration for a given row id - a
 *  second owner's effect cleanup would delete the first one's entry,
 *  including the element table its ref callbacks just populated. Mirrors
 *  TvFavorites / TvRow. */
function useRowRegistration(id: string, rowIndex: number, length: number) {
  const { registerRow, unregisterRow } = useTvFocus();

  useEffect(() => {
    registerRow(id, rowIndex, length);
    return () => unregisterRow(id);
  }, [id, rowIndex, length, registerRow, unregisterRow]);
}

function BackRow({ onBack }: { onBack: () => void }) {
  const { setItemElement } = useTvFocus();
  useRowRegistration('tv-back', ROW.back, 1);

  return (
    <div className="tv-row-strip pt-6">
      <button
        ref={(el) => setItemElement('tv-back', 0, el)}
        type="button"
        tabIndex={-1}
        className="tv-focusable flex-shrink-0 px-7 py-3 rounded-full bg-[#252b36] text-[16px]"
        onClick={onBack}
      >
        返回
      </button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="tv-row-title mt-4">{children}</h2>;
}

interface OptionRowProps {
  id: string;
  rowIndex: number;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

/** One label-left / options-right settings row. Selected state is a filled
 *  background independent of DOM focus, same idea as TvHome's 电影/电视剧
 *  pair, so the current value stays visible even when focus has moved to
 *  another row. `keepColumn` is left at its default (false, see
 *  TvFocusProvider.registerRow) so moving between settings rows always lands
 *  on the first option, matching the home screen's carousel rows. */
function OptionRow({ id, rowIndex, label, options, value, onChange }: OptionRowProps) {
  const { setItemElement } = useTvFocus();
  useRowRegistration(id, rowIndex, options.length);

  return (
    <div className="flex items-center gap-8 px-8 py-3">
      <span className="w-[200px] shrink-0 text-[15px] text-[#e8eaed]">{label}</span>
      <div className="flex flex-wrap gap-3">
        {options.map((option, index) => (
          <button
            key={option.value}
            ref={(el) => setItemElement(id, index, el)}
            type="button"
            tabIndex={-1}
            className={`tv-focusable flex-shrink-0 px-5 py-2.5 rounded-full text-[15px] font-medium ${
              option.value === value ? 'bg-[#3b82f6] text-white' : 'bg-[#252b36] text-[#e8eaed]'
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ConfirmActionRowProps {
  id: string;
  rowIndex: number;
  label: string;
  actionLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
}

/**
 * A destructive action that needs a second press instead of a modal dialog -
 * a dialog would need its own focus-trap and the panel pattern this screen
 * follows (TvFocusProvider + useTvKeys) has no such thing. First press swaps
 * the label to a confirming form; a second press within CONFIRM_RESET_MS
 * performs the action. Moving focus away (blur) or the timeout resets it.
 * The timer itself is only ever started/cleared from event handlers or the
 * unmount cleanup below - never written synchronously from a bare effect
 * body - matching useTvLongPressOk's press-timer pattern.
 */
function ConfirmActionRow({ id, rowIndex, label, actionLabel, confirmLabel, onConfirm }: ConfirmActionRowProps) {
  const { setItemElement } = useTvFocus();
  useRowRegistration(id, rowIndex, 1);

  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearConfirmTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Never leave the reset timer running past this row's lifetime.
  useEffect(() => clearConfirmTimer, []);

  const handleClick = () => {
    if (confirming) {
      clearConfirmTimer();
      setConfirming(false);
      onConfirm();
      return;
    }

    setConfirming(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setConfirming(false);
    }, CONFIRM_RESET_MS);
  };

  const handleBlur = () => {
    clearConfirmTimer();
    setConfirming(false);
  };

  return (
    <div className="flex items-center gap-8 px-8 py-3">
      <span className="w-[200px] shrink-0 text-[15px] text-[#e8eaed]">{label}</span>
      <button
        ref={(el) => setItemElement(id, 0, el)}
        type="button"
        tabIndex={-1}
        className={`tv-focusable flex-shrink-0 px-5 py-2.5 rounded-full text-[15px] font-medium ${
          confirming ? 'bg-red-600 text-white' : 'bg-[#252b36] text-[#e8eaed]'
        }`}
        onClick={handleClick}
        onBlur={handleBlur}
      >
        {confirming ? confirmLabel : actionLabel}
      </button>
    </div>
  );
}

function TvSettingsContent() {
  const router = useRouter();
  useTvKeys(true);

  const {
    fullscreenType,
    handleFullscreenTypeChange,
    proxyMode,
    handleProxyModeChange,
    realtimeLatency,
    handleRealtimeLatencyChange,
    searchDisplayMode,
    handleSearchDisplayModeChange,
    locale,
    handleLocaleChange,
    handleResetAll,
  } = useSettingsPage();

  const { theme, setTheme } = useTheme();
  const { mediaProxyEnabled } = useRuntimeFeatures();

  // getSession() is a synchronous module-level read (see lib/store/auth-store.ts),
  // and this whole tree only ever mounts client-side post-hydration (useIsTvLike's
  // server snapshot is always false), so calling it directly during render carries
  // no hydration-mismatch risk - the same pattern AccountSettings/page.tsx already
  // use for hasPermission().
  const session = getSession();

  const handleBack = () => {
    router.push('/');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch {
      // Best-effort logout: clear the local mirror even if the request fails.
    }
    clearSession();
    window.location.reload();
  };

  return (
    <div className="tv-root min-h-screen bg-[#0f1218] text-[#e8eaed] pb-12">
      <BackRow onBack={handleBack} />

      <PermissionGate permission="player_settings">
        <SectionTitle>播放器</SectionTitle>
        <OptionRow
          id="tv-fullscreen-type"
          rowIndex={ROW.fullscreenType}
          label="全屏方式"
          value={fullscreenType}
          onChange={(value) => handleFullscreenTypeChange(value as 'auto' | 'native' | 'window')}
          options={[
            { value: 'auto', label: '自动' },
            { value: 'native', label: '系统全屏' },
            { value: 'window', label: '网页全屏' },
          ]}
        />
        {/* On this Cloudflare deployment the upstream compliance mode forces
            the media proxy off - rendering a proxy-mode control that cannot
            do anything would be worse than omitting it, so the row simply
            never registers when mediaProxyEnabled is false. */}
        {mediaProxyEnabled ? (
          <OptionRow
            id="tv-proxy-mode"
            rowIndex={ROW.proxyMode}
            label="播放代理"
            value={proxyMode}
            onChange={(value) => handleProxyModeChange(value as 'retry' | 'none' | 'always')}
            options={[
              { value: 'retry', label: '自动重试' },
              { value: 'none', label: '仅直连' },
              { value: 'always', label: '总是代理' },
            ]}
          />
        ) : null}
      </PermissionGate>

      <SectionTitle>显示</SectionTitle>
      <OptionRow
        id="tv-theme"
        rowIndex={ROW.theme}
        label="主题"
        value={theme}
        onChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
        options={[
          { value: 'light', label: '浅色' },
          { value: 'dark', label: '深色' },
          { value: 'system', label: '跟随系统' },
        ]}
      />
      <OptionRow
        id="tv-locale"
        rowIndex={ROW.locale}
        label="界面语言"
        value={locale}
        onChange={(value) => handleLocaleChange(value as 'zh-CN' | 'zh-TW')}
        options={[
          { value: 'zh-CN', label: '简体中文' },
          { value: 'zh-TW', label: '繁體中文' },
        ]}
      />
      <OptionRow
        id="tv-realtime-latency"
        rowIndex={ROW.realtimeLatency}
        label="实时延迟显示"
        value={realtimeLatency ? 'on' : 'off'}
        onChange={(value) => handleRealtimeLatencyChange(value === 'on')}
        options={[
          { value: 'off', label: '关' },
          { value: 'on', label: '开' },
        ]}
      />
      <OptionRow
        id="tv-search-display-mode"
        rowIndex={ROW.searchDisplayMode}
        label="搜索结果显示"
        value={searchDisplayMode}
        onChange={(value) => handleSearchDisplayModeChange(value as 'normal' | 'grouped')}
        options={[
          { value: 'normal', label: '常规' },
          { value: 'grouped', label: '分组' },
        ]}
      />

      <PermissionGate permission="data_management">
        <SectionTitle>数据</SectionTitle>
        <ConfirmActionRow
          id="tv-clear-data"
          rowIndex={ROW.clearData}
          label="清除所有数据"
          actionLabel="清除所有数据"
          confirmLabel="再按一次确认"
          onConfirm={handleResetAll}
        />
      </PermissionGate>

      {session ? (
        <>
          <SectionTitle>账号</SectionTitle>
          <ConfirmActionRow
            id="tv-logout"
            rowIndex={ROW.logout}
            label="退出登录"
            actionLabel="退出登录"
            confirmLabel="再按一次确认"
            onConfirm={handleLogout}
          />
        </>
      ) : null}
    </div>
  );
}

export function TvSettings() {
  return (
    <TvFocusProvider>
      <TvSettingsContent />
    </TvFocusProvider>
  );
}

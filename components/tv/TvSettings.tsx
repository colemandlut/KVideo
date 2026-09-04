'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TvFocusProvider, useTvFocus } from '@/lib/tv/TvFocusProvider';
import { useTvKeys } from '@/lib/tv/useTvKeys';
import { TV_NAME_OPTIONS, useTvName, writeTvName } from '@/lib/tv/tv-name';
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
  tvName: 3,
  theme: 4,
  locale: 5,
  realtimeLatency: 6,
  searchDisplayMode: 7,
  clearData: 8,
  logout: 9,
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
  /** Permanent, row-level explanation shown under the label. Also the
   *  fallback description whenever focus is outside every option button. */
  description: string;
  options: { value: string; label: string; description?: string }[];
  value: string;
  onChange: (value: string) => void;
}

/** Fixed height for the description line, reserved regardless of which
 *  string is showing (row description vs. a focused option's own
 *  description) so a row never grows or shrinks as focus moves through it -
 *  see RowDescription below. */
const DESCRIPTION_LINE_HEIGHT = 'h-[18px] leading-[18px]';

/** The description line under a setting's label. Single line, truncated
 *  rather than wrapped, at a fixed height so swapping its text (row
 *  description <-> a focused option's description) never changes the row's
 *  height - see OptionRow's focusedIndex handling for why the text changes. */
function RowDescription({ text }: { text: string }) {
  // Full width, below the label and options rather than inside the 200px label
  // column: measured at 960 CSS px, five of the eight descriptions were being
  // truncated in that column - including "删除观看历史、收藏和本地缓存，无法撤销",
  // which lost the part that actually matters. A description that gets cut off
  // is worse than no description, because it still costs a line.
  return (
    <p className={`mt-1 px-8 truncate text-[13px] text-[#9aa0a6] ${DESCRIPTION_LINE_HEIGHT}`}>{text}</p>
  );
}

/** One label-left / options-right settings row. Selected state is a filled
 *  background independent of DOM focus, same idea as TvHome's 电影/电视剧
 *  pair, so the current value stays visible even when focus has moved to
 *  another row. `keepColumn` is left at its default (false, see
 *  TvFocusProvider.registerRow) so moving between settings rows always lands
 *  on the first option, matching the home screen's carousel rows.
 *
 *  When an option carries its own `description`, focusing that option's
 *  button swaps the row description for it - the same "explain the option
 *  you're on" affordance as TvHistoryCard's isFocused badge (onFocus/onBlur
 *  driving local state, never a synchronous effect). Blurring back out of
 *  every option in the row falls back to the row's own description. */
function OptionRow({ id, rowIndex, label, description, options, value, onChange }: OptionRowProps) {
  const { setItemElement } = useTvFocus();
  useRowRegistration(id, rowIndex, options.length);

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const focusedDescription = focusedIndex !== null ? options[focusedIndex]?.description : undefined;

  return (
    <div className="py-3">
      <div className="flex items-center gap-8 px-8">
        <div className="w-[200px] shrink-0">
          <span className="text-[15px] text-[#e8eaed]">{label}</span>
        </div>
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
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex((current) => (current === index ? null : current))}
          >
            {option.label}
          </button>
          ))}
        </div>
      </div>
      <RowDescription text={focusedDescription ?? description} />
    </div>
  );
}

interface ConfirmActionRowProps {
  id: string;
  rowIndex: number;
  label: string;
  description: string;
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
function ConfirmActionRow({ id, rowIndex, label, description, actionLabel, confirmLabel, onConfirm }: ConfirmActionRowProps) {
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
    <div className="py-3">
      <div className="flex items-center gap-8 px-8">
        <div className="w-[200px] shrink-0">
          <span className="text-[15px] text-[#e8eaed]">{label}</span>
        </div>
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
      <RowDescription text={description} />
    </div>
  );
}

function TvSettingsContent() {
  const tvName = useTvName();

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
          description="控制播放时如何铺满屏幕"
          value={fullscreenType}
          onChange={(value) => handleFullscreenTypeChange(value as 'auto' | 'native' | 'window')}
          options={[
            { value: 'auto', label: '自动', description: '由设备类型自动决定' },
            { value: 'native', label: '系统全屏', description: '进入浏览器原生全屏状态' },
            { value: 'window', label: '网页全屏', description: '播放器填满当前浏览器窗口' },
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
            description="视频请求是否经过代理转发"
            value={proxyMode}
            onChange={(value) => handleProxyModeChange(value as 'retry' | 'none' | 'always')}
            options={[
              { value: 'retry', label: '自动重试', description: '直连优先，失败时尝试代理' },
              { value: 'none', label: '仅直连', description: '不使用代理，失败则报错' },
              { value: 'always', label: '总是代理', description: '所有请求都通过代理转发' },
            ]}
          />
        ) : null}
      </PermissionGate>

      <SectionTitle>显示</SectionTitle>
      <OptionRow
        id="tv-name"
        rowIndex={ROW.tvName}
        label="电视名称"
        description="手机投屏时用这个名字认出这台电视。首次连接会自动分配「电视1」「电视2」，可在此改成固定名字"
        value={tvName}
        onChange={writeTvName}
        options={TV_NAME_OPTIONS.map((name) => ({ value: name, label: name }))}
      />
      <OptionRow
        id="tv-theme"
        rowIndex={ROW.theme}
        label="主题"
        description="界面明暗配色，跟随系统时随电视的深浅色设置变化"
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
        description="切换界面显示的中文字体（简体/繁体）"
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
        description="开启后，搜索结果中的延迟数值会每 5 秒更新一次"
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
        description="同名视频是否合并"
        value={searchDisplayMode}
        onChange={(value) => handleSearchDisplayModeChange(value as 'normal' | 'grouped')}
        options={[
          { value: 'normal', label: '常规', description: '每个源的结果单独显示' },
          { value: 'grouped', label: '分组', description: '相同名称的视频合并为一个卡片' },
        ]}
      />

      <PermissionGate permission="data_management">
        <SectionTitle>数据</SectionTitle>
        <ConfirmActionRow
          id="tv-clear-data"
          rowIndex={ROW.clearData}
          label="清除所有数据"
          description="删除观看历史、收藏和本地缓存，无法撤销"
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
            description="退出后需要用遥控器重新输入访问密码"
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

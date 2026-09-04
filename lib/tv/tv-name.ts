'use client';

import { useSyncExternalStore } from 'react';

/**
 * This TV's identity for casting: a code it keeps forever, and the name a
 * phone sees in the target list.
 *
 * The code is generated on first visit and never changes, so a TV keeps the
 * same identity across reconnects and restarts. A per-connection id would do
 * for delivery, but the phone's list would reshuffle every time a set woke up,
 * and nothing could remember which TV you cast to last.
 *
 * The name is assigned by the relay on first connect (电视1, 电视2, ...) rather
 * than chosen here, because only the relay can see which names the other TVs
 * in the house are already using. Once assigned it is stored locally and sent
 * on every later connect, so it stays put.
 */

const DEVICE_ID_KEY = 'kvideo-tv-device-id';
const NAME_KEY = 'kvideo-tv-name';

/** Presets for renaming a TV by hand. Typing on a D-pad keyboard costs about a
 *  dozen presses per character, so the settings row offers a row to pick from
 *  instead of a text field. Leaving the auto-assigned name is also fine. */
export const TV_NAME_OPTIONS = ['客厅电视', '卧室电视', '书房电视', '儿童房电视', '主卧电视'] as const;

function readStored(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    // Private mode or storage disabled.
    return '';
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do; the value simply will not persist.
  }
}

/**
 * Stable per-TV code, created on first call.
 *
 * randomUUID is unavailable on insecure origins and in older WebViews, so a
 * random fallback is kept - an id that is merely unlikely to collide is far
 * better than a TV with no identity at all.
 */
export function readDeviceId(): string {
  const existing = readStored(DEVICE_ID_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `tv-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

  writeStored(DEVICE_ID_KEY, generated);
  return generated;
}

/** Empty until the relay has assigned one, or the user has picked a preset. */
export function readTvName(): string {
  return readStored(NAME_KEY);
}

const listeners = new Set<() => void>();

export function writeTvName(name: string): void {
  writeStored(NAME_KEY, name);
  for (const listener of listeners) listener();
}

/**
 * Subscribed rather than read into state from an effect: writing state
 * synchronously inside an effect is a hard lint error here, and localStorage
 * is unavailable during the server render so a lazy initialiser cannot be used
 * either.
 */
export function useTvName(): string {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    readTvName,
    () => '',
  );
}

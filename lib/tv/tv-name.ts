'use client';

import { useSyncExternalStore } from 'react';

/**
 * What this TV calls itself when a phone lists the sets it can cast to.
 *
 * Presets rather than free text: naming a device is a one-off, and typing on a
 * D-pad keyboard costs a dozen presses per character. Picking from a row is
 * two presses, and the names below cover where a TV actually sits.
 */
export const TV_NAME_OPTIONS = ['客厅电视', '卧室电视', '书房电视', '儿童房电视', '主卧电视'] as const;

export const DEFAULT_TV_NAME = TV_NAME_OPTIONS[0];

const STORAGE_KEY = 'kvideo-tv-name';

export function readTvName(): string {
  if (typeof window === 'undefined') return DEFAULT_TV_NAME;
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_TV_NAME;
  } catch {
    // Private mode, or storage disabled - a default name still lets the TV be
    // picked from a list, it just will not be remembered.
    return DEFAULT_TV_NAME;
  }
}

const listeners = new Set<() => void>();

export function writeTvName(name: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Nothing to do; the name simply will not persist.
  }
  for (const listener of listeners) listener();
}

/**
 * Subscribed rather than read into state from an effect: writing state
 * synchronously inside an effect is a hard lint error in this codebase, and
 * localStorage is unavailable during the server render, so a lazy initialiser
 * cannot be used either. The server snapshot is the default name, which is
 * also what a first paint should show.
 */
export function useTvName(): string {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    readTvName,
    () => DEFAULT_TV_NAME,
  );
}

import { useSyncExternalStore } from 'react';
import { storage } from './storage';

const KEY = 'settlehub_prefs';

export interface Prefs {
  /** Playful copy and celebrations. Off gives a plain, quiet app. */
  fun: boolean;
  haptics: boolean;
}

const DEFAULTS: Prefs = { fun: true, haptics: true };
const listeners = new Set<() => void>();
let cache: Prefs | null = null;

function read(): Prefs {
  if (!cache) {
    try {
      cache = { ...DEFAULTS, ...JSON.parse(storage.get(KEY) ?? '{}') };
    } catch {
      cache = { ...DEFAULTS };
    }
  }
  return cache!;
}

export const getPrefs = read;

export function setPrefs(patch: Partial<Prefs>) {
  cache = { ...read(), ...patch };
  storage.set(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    read,
  );
}

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/** Animations and confetti need Fun mode on AND no OS "reduce motion" request. */
export function motionAllowed(): boolean {
  return getPrefs().fun && !reducedMotion();
}

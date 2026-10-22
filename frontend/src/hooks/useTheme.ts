import { useCallback, useEffect, useState } from 'react';
import { storage } from '../lib/storage';

export type ThemePreference = 'dark' | 'light' | 'system';
const KEY = 'settlehub_theme';

function resolve(pref: ThemePreference): 'dark' | 'light' {
  if (pref !== 'system') return pref;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyStoredTheme() {
  const pref = (storage.get(KEY) as ThemePreference) || 'system';
  document.documentElement.dataset.theme = resolve(pref);
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(
    () => (storage.get(KEY) as ThemePreference) || 'system',
  );

  useEffect(() => {
    const apply = () => {
      const theme = resolve(preference);
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f6f8' : '#090d16');
    };
    apply();
    if (preference !== 'system') return;
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    media?.addEventListener('change', apply);
    return () => media?.removeEventListener('change', apply);
  }, [preference]);

  const setTheme = useCallback((pref: ThemePreference) => {
    storage.set(KEY, pref);
    setPreference(pref);
  }, []);

  return { preference, resolved: resolve(preference), setTheme };
}

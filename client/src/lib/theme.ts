import type { ThemeMode } from '../api/types';

export function applyTheme(theme: ThemeMode) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

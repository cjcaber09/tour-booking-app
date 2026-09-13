import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'admin.theme';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function getStoredTheme(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY);
  return isThemePreference(stored) ? stored : 'system';
}

function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

interface ThemeState {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setTheme: (pref: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  // initTheme() overwrites these synchronously before React ever mounts (see below) —
  // these are just placeholder defaults so the store has a valid shape either way.
  preference: 'system',
  resolved: 'light',

  setTheme: (pref) => {
    localStorage.setItem(THEME_KEY, pref);
    const resolved = resolveTheme(pref);
    document.documentElement.dataset.theme = resolved;
    set({ preference: pref, resolved });
  },
}));

// Called once from renderer.tsx, before createRoot(...).render() — sets the DOM
// attribute synchronously so there's no flash of the wrong theme before first paint,
// then registers the OS-theme-change listener.
export function initTheme(): void {
  const preference = getStoredTheme();
  const resolved = resolveTheme(preference);
  useThemeStore.setState({ preference, resolved });
  document.documentElement.dataset.theme = resolved;

  // Reads the store's live in-memory preference (not localStorage) so this never
  // clobbers a preference change that hasn't been through setTheme() — but since
  // setTheme() is the *only* place preference ever changes, this is always current.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = useThemeStore.getState().preference;
    if (current === 'system') {
      const resolvedNow = resolveTheme(current);
      document.documentElement.dataset.theme = resolvedNow;
      useThemeStore.setState({ resolved: resolvedNow });
    }
  });
}

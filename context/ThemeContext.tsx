import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme as useNativewindColorScheme } from 'nativewind';
import { THEME_COLORS, setThemeMode, type ResolvedScheme, type ThemeMode } from '../lib/theme';

type ThemePalette = { [K in keyof (typeof THEME_COLORS)['light']]: string };

type ThemeContextValue = {
  /** The user's preference — 'system' means "follow the OS", not a scheme itself. */
  mode: ThemeMode;
  /** What's actually rendered right now, with 'system' already resolved. */
  scheme: ResolvedScheme;
  colors: ThemePalette;
  setMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Reads the mode App.tsx already applied via initTheme() before first paint
 * (colorScheme.set() there is synchronous+global), so this never flashes the
 * wrong scheme on mount — it just needs to mirror that starting mode into
 * local state for the Settings toggle to display correctly.
 */
export function ThemeProvider({ initialMode, children }: { initialMode: ThemeMode; children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const { colorScheme } = useNativewindColorScheme();
  const scheme: ResolvedScheme = colorScheme === 'dark' ? 'dark' : 'light';

  const setMode = async (next: ThemeMode) => {
    setModeState(next);
    await setThemeMode(next);
  };

  return (
    <ThemeContext.Provider value={{ mode, scheme, colors: THEME_COLORS[scheme], setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Falls back to the raw OS/NativeWind scheme (no persisted-mode awareness)
 * when rendered outside ThemeProvider — e.g. LoadingSpinner during App.tsx's
 * own pre-provider boot screen, before initTheme() has resolved.
 */
function useFallbackTheme(): ThemeContextValue {
  const { colorScheme } = useNativewindColorScheme();
  const scheme: ResolvedScheme = colorScheme === 'dark' ? 'dark' : 'light';
  return {
    mode: 'system',
    scheme,
    colors: THEME_COLORS[scheme],
    setMode: setThemeMode,
  };
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  const fallback = useFallbackTheme();
  return ctx ?? fallback;
}

/** Convenience for screens that only need the resolved color palette. */
export function useThemeColors() {
  return useTheme().colors;
}

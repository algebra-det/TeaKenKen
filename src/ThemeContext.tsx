/**
 * Theme context: resolves the user's preference against the OS setting and
 * hands the active palette to the tree.
 *
 * @format
 */

import {createContext, useContext, useMemo, useState, type ReactNode} from 'react';
import {useColorScheme} from 'react-native';
import {
  palettes,
  type ColorScheme,
  type Palette,
  type ThemeMode,
} from './theme';

interface ThemeValue {
  /** What the user picked: may be `system`. */
  mode: ThemeMode;
  /** What that resolves to right now. */
  scheme: ColorScheme;
  palette: Palette;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  initialMode?: ThemeMode;
  /** Fired whenever the preference changes, so the host can persist it. */
  onModeChange?: (mode: ThemeMode) => void;
}

export function ThemeProvider({
  children,
  initialMode = 'system',
  onModeChange,
}: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  const value = useMemo<ThemeValue>(() => {
    const scheme: ColorScheme =
      mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

    return {
      mode,
      scheme,
      palette: palettes[scheme],
      setMode: next => {
        setModeState(next);
        onModeChange?.(next);
      },
    };
  }, [mode, systemScheme, onModeChange]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return value;
}

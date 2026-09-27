/**
 * Visual tokens.
 *
 * Colours are split into two palettes with identical shapes, so every
 * component can read `palette.<name>` without caring which scheme is active.
 * Sizing tokens are scheme-independent.
 *
 * @format
 */

export type ColorScheme = 'light' | 'dark';

/** What the user asked for. `system` defers to the OS setting. */
export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

export interface Palette {
  background: string;
  surface: string;
  surfaceMuted: string;

  text: string;
  textMuted: string;
  textInverse: string;
  textDisabled: string;

  border: string;
  /** Heavy lines that trace cage outlines. */
  cageBorder: string;
  /** Hairlines between cells inside the same cage. */
  gridLine: string;

  accent: string;
  accentSoft: string;
  accentStrong: string;
  /** Foreground for text sitting on top of a solid `accent` fill. */
  onAccent: string;

  selected: string;
  peer: string;

  danger: string;
  dangerSoft: string;

  success: string;
  successSoft: string;
}

const light: Palette = {
  background: '#EEF2F7',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',

  text: '#0F172A',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',
  textDisabled: '#B6C2D1',

  border: '#D7DEE8',
  cageBorder: '#0F172A',
  gridLine: '#C6D0DC',

  accent: '#4F46E5',
  accentSoft: '#E0E7FF',
  accentStrong: '#3730A3',
  onAccent: '#FFFFFF',

  selected: '#C7D2FE',
  peer: '#EEF2FF',

  danger: '#DC2626',
  dangerSoft: '#FEE2E2',

  success: '#15803D',
  successSoft: '#DCFCE7',
};

/**
 * Dark is not a simple inversion. The cage outline flips to a light colour so
 * it still reads as the strongest line on the board, accents lighten (a
 * saturated indigo goes muddy on a dark ground), and the "soft" fills become
 * deep tints rather than pale washes so text stays legible on top of them.
 */
const dark: Palette = {
  background: '#0B1220',
  surface: '#18212F',
  surfaceMuted: '#131B27',

  text: '#E9EEF6',
  textMuted: '#93A1B5',
  textInverse: '#FFFFFF',
  textDisabled: '#4A5A70',

  border: '#2B3749',
  cageBorder: '#E9EEF6',
  gridLine: '#3C4A5E',

  accent: '#7C8CF8',
  accentSoft: '#26306B',
  accentStrong: '#C3CBFF',
  // Dark's accent is a light indigo, so white text on it would fall to about
  // 2.6:1 contrast. Solid accent fills get dark text instead.
  onAccent: '#0B1220',

  selected: '#3B3F9E',
  peer: '#1E2938',

  danger: '#F87171',
  dangerSoft: '#4A1D22',

  success: '#4ADE80',
  successSoft: '#123524',
};

export const palettes: Record<ColorScheme, Palette> = {light, dark};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** Board line weights. Cage edges are heavy, interior lines are hairlines. */
export const borderWidths = {
  thin: 1,
  thick: 2.5,
} as const;

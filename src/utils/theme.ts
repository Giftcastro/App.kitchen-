export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  /** Foreground color for content placed on top of `accent` (e.g. primary button text) — flips with accent so it stays legible in both modes. */
  onAccent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  white: string;
  black: string;
  tabBar: string;
  headerBg: string;
  cardBg: string;
  inputBg: string;
  modalOverlay: string;
  statusBarStyle: 'light-content' | 'dark-content';
}

// Uber-style light theme: white/near-white surfaces, black as the primary
// UI color (buttons, active states, prices) instead of a brand accent hue —
// color is reserved for semantic status (success/warning/error), matching
// how the reference app itself uses almost no color outside food photography.
export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSecondary: '#F6F6F6',
  border: '#EBEBEB',
  text: '#000000',
  textSecondary: '#6B6B6B',
  textTertiary: '#9E9E9E',
  accent: '#000000',
  onAccent: '#FFFFFF',
  success: '#1DA836',
  warning: '#E8A100',
  error: '#E0393E',
  info: '#0073E6',
  white: '#FFFFFF',
  black: '#000000',
  tabBar: '#FFFFFF',
  headerBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  inputBg: '#F6F6F6',
  modalOverlay: 'rgba(0,0,0,0.5)',
  statusBarStyle: 'dark-content',
};

// Dark theme mirrors the same monochrome logic: near-black surfaces, white
// as the primary UI color. `accent` flips from black to white here — a
// light-mode black button would otherwise vanish against a near-black
// background — so anything painting text/icons on top of `accent` must use
// `onAccent`, not a hardcoded white, or it renders invisible in this mode.
export const darkColors: ThemeColors = {
  background: '#0B0B0B',
  surface: '#141414',
  surfaceSecondary: '#1E1E1E',
  border: '#2C2C2C',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textTertiary: '#6B6B6B',
  accent: '#FFFFFF',
  onAccent: '#000000',
  success: '#22C55E',
  warning: '#F5A623',
  error: '#F0544F',
  info: '#3B9EFF',
  white: '#FFFFFF',
  black: '#000000',
  tabBar: '#141414',
  headerBg: '#141414',
  cardBg: '#141414',
  inputBg: '#1E1E1E',
  modalOverlay: 'rgba(0,0,0,0.7)',
  statusBarStyle: 'light-content',
};

// Phone-like frame width: on viewports wider than this (e.g., desktop web),
// the entire app renders as a centered mobile-width column, like a phone.
export const APP_MAX_WIDTH = 480;

// Tablet frame width: on tablets (>= TABLET_BREAKPOINT) the centered frame
// widens so content can breathe and multi-column grids have room.
export const TABLET_MAX_WIDTH = 720;

// Minimum viewport width at which the app switches to its tablet layout.
export const TABLET_BREAKPOINT = 600;

export function getThemeColors(mode: ResolvedScheme): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}

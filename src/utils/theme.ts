export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
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
export const theme: ThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSecondary: '#F6F6F6',
  border: '#EBEBEB',
  text: '#000000',
  textSecondary: '#6B6B6B',
  textTertiary: '#9E9E9E',
  accent: '#000000',
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

// Phone-like frame width: on viewports wider than this (e.g., desktop web),
// the entire app renders as a centered mobile-width column, like a phone.
export const APP_MAX_WIDTH = 480;

// Tablet frame width: on tablets (>= TABLET_BREAKPOINT) the centered frame
// widens so content can breathe and multi-column grids have room.
export const TABLET_MAX_WIDTH = 720;

// Minimum viewport width at which the app switches to its tablet layout.
export const TABLET_BREAKPOINT = 600;

export const darkTheme: ThemeColors = theme;
export const lightTheme: ThemeColors = theme;

export function getThemeColors(): ThemeColors {
  return theme;
}
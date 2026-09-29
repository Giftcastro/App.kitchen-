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
  /**
   * The CI colour "pop" the client asked for on top of the black-and-white
   * look (client review, Sep 2026 — repeated 2026-09-15: "bring in a bit of
   * colour... pops of colour to just liven it up but not too much").
   * Deliberately separate from `accent`, which stays black/white and keeps
   * driving every primary button/CTA — this is only for a handful of narrow,
   * mostly-decorative spots (active tab bar icon, the login glow, the
   * "Ordering for <day>" bar) so the app still *reads* as black and white
   * everywhere else. Currently plain black/white (same as accent) by
   * choice — the client's moodboard blue #3571B7 (dark: #B6DFF8) read cold
   * against the warm menu, so it was dropped. Change here to bring a pop back.
   */
  brandPop: string;
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

// Black-and-white theme (client review, Sep 2026): "keep the overall feel
// black and white", with only subtle pops of colour.
//
// So `accent` — which paints every primary button, active chip and selected
// state in the app — is plain black here and plain white in dark mode, and
// the only colours left anywhere are the semantic status ones below:
// success/warning/error/info. Those are the pops, and they are reserved for
// things that genuinely carry meaning (an order status, a saving, a cutoff
// warning, a destructive action) rather than for decoration.
//
// Two earlier accents live in the history here: the brand blue #3571B7 and a
// sage green #C4D29B trialled on 2026-09-05. Both are superseded — reinstating
// either means changing `accent`/`onAccent` in both palettes together, since
// anything drawn on top of the accent reads `onAccent` for its colour.
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
  brandPop: '#000000',
  success: '#1DA836',
  warning: '#E8A100',
  error: '#AF1718',
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

// Dark theme mirrors the same logic against near-black surfaces. `accent`
// inverts to white here — light mode's black accent would vanish into the
// background — so anything painting text or icons on top of `accent` must use
// `onAccent`, never a hardcoded white, or it renders invisible in one mode or
// the other. `error` is likewise brightened from the brand red, following the
// same lighten-for-dark-mode pattern already used below for
// success/warning/info.
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
  brandPop: '#FFFFFF',
  success: '#22C55E',
  warning: '#F5A623',
  error: '#CB6869',
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

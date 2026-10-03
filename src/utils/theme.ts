/**
 * Colour tokens, 1:1 with the YourKitchenCo MAUI app's
 * Resources/Styles/Colors.xaml (qwertystig/KitchenCO main) — each token is
 * the {AppThemeBinding Light=..., Dark=...} pair the MAUI views use, so a
 * screen ported from a .xaml file reads the same token names it bound to.
 *
 * Base is black/white monochrome. `brandPop` (the client's CI blue) is kept
 * to the same three narrow spots as MAUI: the selected tab icon, the glow
 * behind the login logo, and the delivery-day calendar icon.
 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

export interface ThemeColors {
  /** PageBgLight / PageBgDark */
  pageBg: string;
  /** CardBgLight / CardBgDark */
  cardBg: string;
  /** PrimaryTextLight / PrimaryTextDark */
  text: string;
  /** SecondaryTextLight / SecondaryTextDark */
  textSecondary: string;
  /** Primary / PrimaryDark — every primary button and accent. Also BrandGold, Gold, Secondary, Tertiary (all monochrome). */
  primary: string;
  /** Text on top of `primary`: White / PrimaryDarkText */
  onPrimary: string;
  /** BrandPop / BrandPopDark */
  brandPop: string;
  /** BrandPopGlowOuter* (5%) */
  brandPopGlowOuter: string;
  /** BrandPopGlowInner* (9%) */
  brandPopGlowInner: string;
  /** SurfaceBorderLight / SurfaceBorderDark */
  surfaceBorder: string;
  /** Cream on Menu/Cart/Orders/Profile/Payment in light mode; PageBgDark in dark */
  cream: string;
  /** Entry borders (#E0E0E0 / #333333) */
  inputBorder: string;
  /** Card borders on Profile/Settings/Orders (#E0E0E0 / #252525) */
  cardBorder: string;
  /** Warm tan chip/notice background (#EFE9DC / #242426) */
  tan: string;
  /** Admin card surfaces (White / #1E1E1E) */
  adminCard: string;
  /** Menu toggle track (#EFEFEF / #1E1E1E) */
  segmentTrack: string;
  /** Unselected menu toggle text (#777777 / #AAAAAA) */
  segmentText: string;
  /** Cart count badge (#DC2626 / #F87171) */
  badge: string;
  /** Floating cart bar (#121212 / #F7F2E8) */
  floatingBar: string;
  /** Text on the floating cart bar (White / #121212) */
  onFloatingBar: string;
  /** Muted text on the floating cart bar (#A6FFFFFF / #A6121212) */
  onFloatingBarMuted: string;
  /** Watermark badge behind empty-state emoji (#10000000 / #15FFFFFF) */
  watermark: string;
  /** Plain-entry placeholder colour (Gray200 / Gray500) */
  placeholder: string;
  /** Disabled button background (Gray200 / Gray600) */
  disabledBg: string;
  /** Disabled button text (Gray950 / Gray200) */
  disabledText: string;
  /** Divider under the admin nav strip (#E0E0E0 / #2E2E32) */
  navDivider: string;
  /** Dashboard order item text (#333333 / #CCCCCC) */
  bodyMuted: string;
  /** Help tip text (#4E4E4E / #A1A1AA) */
  tipText: string;
  /** Product detail editor (#F5F5F5 / #2A2A2A) */
  editorBg: string;
  /** Order history icon tile (#F5F5F5 / #1F1F1F) */
  tileBg: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  /** Status bar content */
  statusBarStyle: 'light-content' | 'dark-content';
}

export const lightColors: ThemeColors = {
  pageBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  text: '#000000',
  textSecondary: '#6B6B6B',
  primary: '#000000',
  onPrimary: '#FFFFFF',
  brandPop: '#3571B7',
  brandPopGlowOuter: 'rgba(53,113,183,0.05)',
  brandPopGlowInner: 'rgba(53,113,183,0.09)',
  surfaceBorder: '#EBEBEB',
  cream: '#FDF9E9',
  inputBorder: '#E0E0E0',
  cardBorder: '#E0E0E0',
  tan: '#EFE9DC',
  adminCard: '#FFFFFF',
  segmentTrack: '#EFEFEF',
  segmentText: '#777777',
  badge: '#DC2626',
  floatingBar: '#121212',
  onFloatingBar: '#FFFFFF',
  onFloatingBarMuted: 'rgba(255,255,255,0.65)',
  watermark: 'rgba(0,0,0,0.063)',
  placeholder: '#C8C8C8',
  disabledBg: '#C8C8C8',
  disabledText: '#141414',
  navDivider: '#E0E0E0',
  bodyMuted: '#333333',
  tipText: '#4E4E4E',
  editorBg: '#F5F5F5',
  tileBg: '#F5F5F5',
  error: '#AF1718',
  success: '#1DA836',
  warning: '#E8A100',
  info: '#0073E6',
  statusBarStyle: 'dark-content',
};

export const darkColors: ThemeColors = {
  pageBg: '#0B0B0B',
  cardBg: '#141414',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  primary: '#FFFFFF',
  onPrimary: '#000000',
  brandPop: '#B6DFF8',
  brandPopGlowOuter: 'rgba(182,223,248,0.05)',
  brandPopGlowInner: 'rgba(182,223,248,0.09)',
  surfaceBorder: '#2C2C2C',
  cream: '#0B0B0B',
  inputBorder: '#333333',
  cardBorder: '#252525',
  tan: '#242426',
  adminCard: '#1E1E1E',
  segmentTrack: '#1E1E1E',
  segmentText: '#AAAAAA',
  badge: '#F87171',
  floatingBar: '#F7F2E8',
  onFloatingBar: '#121212',
  onFloatingBarMuted: 'rgba(18,18,18,0.65)',
  watermark: 'rgba(255,255,255,0.082)',
  placeholder: '#6E6E6E',
  disabledBg: '#404040',
  disabledText: '#C8C8C8',
  navDivider: '#2E2E32',
  bodyMuted: '#CCCCCC',
  tipText: '#A1A1AA',
  editorBg: '#2A2A2A',
  tileBg: '#1F1F1F',
  error: '#CB6869',
  success: '#22C55E',
  warning: '#F5A623',
  info: '#3B9EFF',
  statusBarStyle: 'light-content',
};

/** Fixed colours MAUI hardcodes in both themes. */
export const fixed = {
  /** Allergy / dispute amber text */
  amber: '#B45309',
  /** Allergy / dispute amber background (#1AF59E0B) */
  amberBg: 'rgba(245,158,11,0.10)',
  /** Allergy editor focused (#33F59E0B) */
  amberBgStrong: 'rgba(245,158,11,0.20)',
  /** Destructive outline (Sign Out) */
  danger: '#C62828',
  /** Logout / delete outline */
  dangerBright: '#DC2626',
  /** Success green used by Register's auto-match tick and the confirmation badge */
  green: '#059669',
  greenBg: 'rgba(5,150,105,0.10)',
  /** Ordering-closed notice */
  noticeBg: '#FFF3CD',
  noticeText: '#856404',
  /** Neutral translucent admin buttons (#22888888) */
  neutralButton: 'rgba(136,136,136,0.13)',
  /** Admin status/role badge (#22121212) */
  badgeBg: 'rgba(18,18,18,0.13)',
  muted: '#888888',
  faint: '#AAAAAA',
  nearBlack: '#121212',
};

/**
 * Phone-like frame width: on viewports wider than this (desktop web), the app
 * renders as a centered mobile-width column.
 */
export const APP_MAX_WIDTH = 480;
export const TABLET_MAX_WIDTH = 720;
export const TABLET_BREAKPOINT = 600;

export function getThemeColors(mode: ResolvedScheme): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}

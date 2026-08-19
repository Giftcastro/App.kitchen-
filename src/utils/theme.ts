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

// Modern dark theme with warm orange accent and subtle blue-grey surfaces
export const theme: ThemeColors = {
  background: '#0F1115',
  surface: '#1A1D24',
  surfaceSecondary: '#22262F',
  border: '#2E3340',
  text: '#F5F7FA',
  textSecondary: '#9AA3B2',
  textTertiary: '#6B7280',
  accent: '#FF6B35',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#38BDF8',
  white: '#FFFFFF',
  black: '#000000',
  tabBar: '#0F1115',
  headerBg: '#0F1115',
  cardBg: '#1A1D24',
  inputBg: '#14171C',
  modalOverlay: 'rgba(0,0,0,0.8)',
  statusBarStyle: 'light-content',
};

export const darkTheme: ThemeColors = theme;
export const lightTheme: ThemeColors = theme;

export function getThemeColors(): ThemeColors {
  return theme;
}
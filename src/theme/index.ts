import { Platform } from 'react-native';
import { ThemeColors } from '../types';

export const typography = {
  heading: Platform.select({
    web: "'Century Gothic', 'CenturyGothic', 'AppleGothic', 'URW Gothic L', 'Avant Garde', sans-serif",
    ios: 'Century Gothic',
    android: 'sans-serif',
    default: 'GotchaGothic',
  }) as string,
  headingLight: Platform.select({
    web: "'Century Gothic', 'CenturyGothic', 'AppleGothic', 'URW Gothic L', sans-serif",
    ios: 'Century Gothic',
    android: 'sans-serif-light',
    default: 'GotchaGothic-Light',
  }) as string,
  headingStamp: 'GotchaGothic-StampBasic',
  body: Platform.select({
    web: "'Century Gothic', 'CenturyGothic', 'AppleGothic', sans-serif",
    ios: 'Century Gothic',
    android: 'sans-serif',
    default: 'RobotoCondensed_400Regular',
  }) as string,
  bodyMedium: Platform.select({
    web: "'Century Gothic', 'CenturyGothic', 'AppleGothic', sans-serif",
    ios: 'Century Gothic',
    android: 'sans-serif-medium',
    default: 'RobotoCondensed_500Medium',
  }) as string,
  bodyBold: Platform.select({
    web: "'Century Gothic', 'CenturyGothic', 'AppleGothic', sans-serif",
    ios: 'Century Gothic',
    android: 'sans-serif',
    default: 'RobotoCondensed_700Bold',
  }) as string,
  centuryGothic: Platform.select({
    web: "'Century Gothic', 'CenturyGothic', 'AppleGothic', sans-serif",
    ios: 'Century Gothic',
    android: 'sans-serif',
    default: 'Century Gothic',
  }) as string,
};

export const darkColors: ThemeColors = {
  background: '#121212',
  backgroundSecondary: '#18181A',
  surface: '#1C1C1E',
  surfaceElevated: '#242426',
  surfaceHighlight: '#2A2A2E',
  surfaceBorder: '#2E2E32',
  surfaceBorderLight: '#3C3C42',

  // Monochromatic Primary Accent (Cream / White on dark)
  primary: '#F7F2E8',
  primaryLight: '#FFFFFF',
  primaryDark: '#EFE9DC',
  primaryMuted: 'rgba(247, 242, 232, 0.12)',
  primaryGlow: 'rgba(247, 242, 232, 0.25)',
  onPrimary: '#121212',
  brandGold: '#F7F2E8',
  onBrandGold: '#121212',
  chipBg: '#242426',
  subtleFill: 'rgba(136, 136, 136, 0.133)',
  subtleFillStrong: 'rgba(247, 242, 232, 0.12)',

  // Typography (Warm Cream primary on dark carbon)
  textPrimary: '#F7F2E8',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  textInverse: '#121212',

  // Status & Subtle Alerts
  goldWarning: '#F7F2E8',
  goldWarningSurface: 'rgba(247, 242, 232, 0.10)',
  goldWarningBorder: 'rgba(247, 242, 232, 0.25)',

  error: '#F87171',
  errorSurface: 'rgba(248, 113, 113, 0.12)',
  errorBorder: 'rgba(248, 113, 113, 0.3)',

  success: '#34D399',
  successSurface: 'rgba(52, 211, 153, 0.12)',
  successBorder: 'rgba(52, 211, 153, 0.3)',

  // Inputs & Controls
  inputBackground: '#1C1C1E',
  inputBorder: '#2E2E32',
  inputBorderFocus: '#F7F2E8',
  buttonDisabled: '#27272A',
  buttonDisabledText: '#71717A',

  // Badges & Tags
  tagBackground: '#242426',
  tagBorder: '#323236',
  tagText: '#F7F2E8',

  // Liquid Glass Tokens
  glassBackground: 'rgba(24, 24, 27, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassPill: 'rgba(36, 36, 38, 0.9)',

  overlay: 'rgba(0, 0, 0, 0.8)',
  isDark: true,
};

export const lightColors: ThemeColors = {
  background: '#F7F2E8', // Warm Cream / Linen
  backgroundSecondary: '#EFE9DC',
  surface: '#FFFFFF', // Crisp White Cards
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: '#EFE9DC',
  surfaceBorder: '#E5DFD3',
  surfaceBorderLight: '#ECE6DB',

  // Executive Black Primary Accent
  primary: '#121212',
  primaryLight: '#2C2C2E',
  primaryDark: '#000000',
  primaryMuted: 'rgba(18, 18, 18, 0.08)',
  primaryGlow: 'rgba(18, 18, 18, 0.20)',
  onPrimary: '#FFFFFF',
  brandGold: '#121212',
  onBrandGold: '#FFFFFF',
  chipBg: '#EFE9DC',
  subtleFill: 'rgba(136, 136, 136, 0.133)',
  subtleFillStrong: 'rgba(18, 18, 18, 0.133)',

  // Typography (Sharp Carbon Black)
  textPrimary: '#121212',
  textSecondary: '#4E4E4E',
  textMuted: '#767676',
  textInverse: '#FFFFFF',

  // Status & Subtle Alerts
  goldWarning: '#121212',
  goldWarningSurface: '#EFE9DC',
  goldWarningBorder: '#DDD6C8',

  error: '#DC2626',
  errorSurface: 'rgba(220, 38, 38, 0.08)',
  errorBorder: 'rgba(220, 38, 38, 0.25)',

  success: '#059669',
  successSurface: 'rgba(5, 150, 105, 0.08)',
  successBorder: 'rgba(5, 150, 105, 0.25)',

  // Inputs & Controls
  inputBackground: '#FFFFFF',
  inputBorder: '#E5DFD3',
  inputBorderFocus: '#121212',
  buttonDisabled: '#EAE4D8',
  buttonDisabledText: '#A1A1AA',

  // Badges & Tags
  tagBackground: '#EFE9DC',
  tagBorder: '#E5DFD3',
  tagText: '#121212',

  // Liquid Glass Tokens
  glassBackground: 'rgba(247, 242, 232, 0.92)',
  glassBorder: 'rgba(18, 18, 18, 0.08)',
  glassPill: 'rgba(239, 233, 220, 0.95)',

  overlay: 'rgba(0, 0, 0, 0.65)',
  isDark: false,
};

export const pantryLightColors: ThemeColors = {
  ...lightColors,
  background: '#FBF7E7',
  backgroundSecondary: '#F1ECD3',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: '#F1ECD3',
  surfaceBorder: '#E7E0C4',
  surfaceBorderLight: '#EFE9D2',
  primary: '#D53220',
  primaryLight: '#E84A38',
  primaryDark: '#B22516',
  primaryMuted: 'rgba(213, 50, 32, 0.10)',
  primaryGlow: 'rgba(213, 50, 32, 0.25)',
  onPrimary: '#FFFFFF',
  brandGold: '#507B45',
  onBrandGold: '#FFFFFF',
  chipBg: '#F1ECD3',
  subtleFill: 'rgba(80, 123, 69, 0.149)',
  subtleFillStrong: 'rgba(213, 50, 32, 0.149)',
  textPrimary: '#33351D',
  textSecondary: '#6B6B4F',
  textMuted: '#8A8A6E',
  textInverse: '#FFFFFF',
  // Notices and disabled controls, in the pantry palette rather than inherited Ink & Cream.
  goldWarning: '#33351D',
  goldWarningSurface: '#F1ECD3',
  goldWarningBorder: '#E7E0C4',
  buttonDisabled: '#EDE7CC',
  buttonDisabledText: '#8A8A6E',
  inputBackground: '#FFFFFF',
  inputBorder: '#E7E0C4',
  inputBorderFocus: '#D53220',
  tagBackground: '#F1ECD3',
  tagBorder: '#E7E0C4',
  tagText: '#33351D',
  glassBackground: 'rgba(251, 247, 231, 0.92)',
  glassBorder: 'rgba(51, 53, 29, 0.08)',
  glassPill: 'rgba(241, 236, 211, 0.95)',
  isDark: false,
};

export const pantryDarkColors: ThemeColors = {
  ...darkColors,
  background: '#1A1D10',
  backgroundSecondary: '#242816',
  surface: '#242816',
  surfaceElevated: '#2E321D',
  surfaceHighlight: '#33361F',
  surfaceBorder: '#33361F',
  surfaceBorderLight: '#3D4226',
  primary: '#F5E8A6',
  primaryLight: '#FFF5BD',
  primaryDark: '#E2D38A',
  primaryMuted: 'rgba(245, 232, 166, 0.12)',
  primaryGlow: 'rgba(245, 232, 166, 0.25)',
  onPrimary: '#363C1E',
  brandGold: '#C4D29B',
  onBrandGold: '#363C1E',
  chipBg: '#2E321D',
  subtleFill: 'rgba(80, 123, 69, 0.149)',
  subtleFillStrong: 'rgba(213, 50, 32, 0.149)',
  textPrimary: '#F5E8A6',
  textSecondary: '#A9B98A',
  textMuted: '#9AA882',
  textInverse: '#1A1D10',
  // Notices and disabled controls, in the pantry palette rather than inherited Ink & Cream.
  goldWarning: '#F5E8A6',
  goldWarningSurface: 'rgba(245, 232, 166, 0.10)',
  goldWarningBorder: 'rgba(245, 232, 166, 0.25)',
  buttonDisabled: '#2E321D',
  buttonDisabledText: '#9AA882',
  inputBackground: '#242816',
  inputBorder: '#33361F',
  inputBorderFocus: '#F5E8A6',
  tagBackground: '#2E321D',
  tagBorder: '#3D4226',
  tagText: '#F5E8A6',
  glassBackground: 'rgba(26, 29, 16, 0.88)',
  glassBorder: 'rgba(245, 232, 166, 0.12)',
  glassPill: 'rgba(46, 50, 29, 0.92)',
  isDark: true,
};

export const BRAND_THEMES: { key: 'Current' | 'MediterraneanPantry'; label: string; swatch: string }[] = [
  { key: 'Current', label: 'Ink & Cream', swatch: '#121212' },
  { key: 'MediterraneanPantry', label: 'Mediterranean Pantry', swatch: '#D53220' },
];

export const colors = lightColors;

/**
 * Colour tokens, 1:1 with the YourKitchenCo MAUI app (qwertystig/KitchenCO,
 * rebrand/colors-and-parity): Resources/Styles/Colors.xaml is the "Ink &
 * Cream" theme, and Resources/Styles/Themes/MediterraneanPantryTheme.xaml
 * re-defines the brand keys for "Mediterranean Pantry". Settings > App Theme
 * switches between them; each has its own light and dark values.
 *
 * Token names follow the XAML resource keys: `primary` = Primary/PrimaryDark,
 * `onPrimary` = the Light=White / Dark=PrimaryDarkText pairing every
 * button on the accent uses, `brandGold` = BrandGold/BrandGoldDark, etc.
 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';
export type BrandTheme = 'Current' | 'MediterraneanPantry';

export interface ThemeColors {
  /** PageBgLight / PageBgDark */
  pageBg: string;
  /** CardBgLight / CardBgDark */
  cardBg: string;
  /** PrimaryTextLight / PrimaryTextDark */
  text: string;
  /** SecondaryTextLight / SecondaryTextDark */
  textSecondary: string;
  /** Primary / PrimaryDark — buttons, prices, accents. Gold/GoldDark share it. */
  primary: string;
  /** Text on `primary`: White (light) / PrimaryDarkText (dark) */
  onPrimary: string;
  /** BrandGold / BrandGoldDark — secondary accent (labels, admin buttons, switches) */
  brandGold: string;
  /** Text on `brandGold`: White (light) / PrimaryDarkText (dark) */
  onBrandGold: string;
  /** SurfaceBorderLight / SurfaceBorderDark */
  surfaceBorder: string;
  /** ChipBgLight / ChipBgDark — chips, pills, toggles, notices */
  chipBg: string;
  /** MutedTextLight / MutedTextDark */
  mutedText: string;
  /** TabBarBg* — bottom tab bar */
  tabBarBg: string;
  /** TabBarText* — selected tab */
  tabBarText: string;
  /** TabBarUnselected* */
  tabBarUnselected: string;
  /** HeaderBg* — the Menu's header band */
  headerBg: string;
  /** HeaderChipBg* — cart button / admin-preview banner on the band */
  headerChipBg: string;
  /** Which logo reads on the header band: 'light' = yourkcolight.png (dark ink), 'dark' = yourkcodark.png (cream ink) */
  headerLogo: 'light' | 'dark';
  /** SubtleFill — translucent neutral buttons/tiles */
  subtleFill: string;
  /** SubtleFillStrong — translucent badges */
  subtleFillStrong: string;
  /** ErrorLight / ErrorDark */
  error: string;
  /** SuccessLight / SuccessDark */
  success: string;
  /** Styles.xaml's default Entry/Editor placeholder (Gray200 / Gray500) */
  placeholder: string;
  /** Styles.xaml's disabled Button (Gray200 / Gray600 background, Gray950 / Gray200 text) */
  disabledBg: string;
  disabledText: string;
  statusBarStyle: 'light-content' | 'dark-content';
}

const inkLight: ThemeColors = {
  pageBg: '#F7F2E8',
  cardBg: '#FFFFFF',
  text: '#121212',
  textSecondary: '#4E4E4E',
  primary: '#121212',
  onPrimary: '#FFFFFF',
  brandGold: '#121212',
  onBrandGold: '#FFFFFF',
  surfaceBorder: '#E5DFD3',
  chipBg: '#EFE9DC',
  mutedText: '#888888',
  tabBarBg: '#121212',
  tabBarText: '#FFFFFF',
  tabBarUnselected: '#B7B0A2',
  headerBg: '#F7F2E8',
  headerChipBg: '#121212',
  headerLogo: 'light',
  subtleFill: 'rgba(136,136,136,0.133)',
  subtleFillStrong: 'rgba(18,18,18,0.133)',
  error: '#DC2626',
  success: '#059669',
  placeholder: '#C8C8C8',
  disabledBg: '#C8C8C8',
  disabledText: '#141414',
  statusBarStyle: 'dark-content',
};

const inkDark: ThemeColors = {
  pageBg: '#121212',
  cardBg: '#1C1C1E',
  text: '#F7F2E8',
  textSecondary: '#A1A1AA',
  primary: '#F7F2E8',
  onPrimary: '#121212',
  brandGold: '#F7F2E8',
  onBrandGold: '#121212',
  surfaceBorder: '#2E2E32',
  chipBg: '#242426',
  mutedText: '#AAAAAA',
  tabBarBg: '#F7F2E8',
  tabBarText: '#121212',
  tabBarUnselected: '#6E6E72',
  headerBg: '#121212',
  headerChipBg: '#F7F2E8',
  headerLogo: 'dark',
  subtleFill: 'rgba(136,136,136,0.133)',
  subtleFillStrong: 'rgba(18,18,18,0.133)',
  error: '#F87171',
  success: '#34D399',
  placeholder: '#6E6E6E',
  disabledBg: '#404040',
  disabledText: '#C8C8C8',
  statusBarStyle: 'light-content',
};

/** MediterraneanPantryTheme.xaml — everything it doesn't define falls through to Ink & Cream. */
const pantryLight: ThemeColors = {
  ...inkLight,
  pageBg: '#FBF7E7',
  cardBg: '#FFFFFF',
  text: '#33351D',
  textSecondary: '#6B6B4F',
  surfaceBorder: '#E7E0C4',
  primary: '#D53220',
  onPrimary: '#FFFFFF',
  brandGold: '#507B45',
  onBrandGold: '#FFFFFF',
  chipBg: '#F1ECD3',
  mutedText: '#8A8A6E',
  tabBarBg: '#363C1E',
  tabBarText: '#F5E8A6',
  tabBarUnselected: '#A9B98A',
  headerBg: '#363C1E',
  headerChipBg: '#D53220',
  headerLogo: 'dark',
  subtleFill: 'rgba(80,123,69,0.149)',
  subtleFillStrong: 'rgba(213,50,32,0.149)',
};

const pantryDark: ThemeColors = {
  ...inkDark,
  pageBg: '#1A1D10',
  cardBg: '#242816',
  text: '#F5E8A6',
  textSecondary: '#A9B98A',
  surfaceBorder: '#33361F',
  primary: '#F5E8A6',
  onPrimary: '#363C1E',
  brandGold: '#C4D29B',
  onBrandGold: '#363C1E',
  chipBg: '#2E321D',
  mutedText: '#9AA882',
  tabBarBg: '#F5E8A6',
  tabBarText: '#363C1E',
  tabBarUnselected: '#8A8F63',
  headerBg: '#F5E8A6',
  headerChipBg: '#363C1E',
  headerLogo: 'light',
  subtleFill: 'rgba(80,123,69,0.149)',
  subtleFillStrong: 'rgba(213,50,32,0.149)',
};

export function getThemeColors(scheme: ResolvedScheme, brand: BrandTheme = 'Current'): ThemeColors {
  if (brand === 'MediterraneanPantry') return scheme === 'dark' ? pantryDark : pantryLight;
  return scheme === 'dark' ? inkDark : inkLight;
}

/** Settings > App Theme swatches. */
export const BRAND_THEMES: { key: BrandTheme; label: string; swatch: string }[] = [
  { key: 'MediterraneanPantry', label: 'Mediterranean Pantry', swatch: '#D53220' },
  { key: 'Current', label: 'Ink & Cream', swatch: '#121212' },
];

/**
 * Native colours MAUI sets outside Colors.xaml:
 * Platforms/Android/Resources/values/colors.xml (colorPrimary/Dark/Accent —
 * the Android status bar, text cursor/selection) and the csproj's
 * MauiIcon/MauiSplashScreen Color.
 */
export const native = {
  androidPrimary: '#2B0B98',
  splash: '#AF1718',
};

/** Fixed colours MAUI hardcodes in every theme. */
export const fixed = {
  /** Allergy / dispute amber text */
  amber: '#B45309',
  /** Allergy / dispute amber background (#1AF59E0B) */
  amberBg: 'rgba(245,158,11,0.10)',
  /** Confirmation tick */
  green: '#059669',
  greenBg: 'rgba(5,150,105,0.10)',
  /** Admin quick-status buttons */
  statusPreparing: '#1E88E5',
  statusOutForDelivery: '#FB8C00',
  statusDelivered: '#43A047',
  /** Admin Users: Activate / Suspended label */
  activate: '#2E7D32',
  suspendedText: '#E53935',
};

export const APP_MAX_WIDTH = 480;
export const TABLET_MAX_WIDTH = 720;
export const TABLET_BREAKPOINT = 600;

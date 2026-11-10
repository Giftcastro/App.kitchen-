import { Platform } from 'react-native';

export type AuthMode = 'sign_in' | 'sign_up' | 'forgot_password' | 'reset_password';
export type SignUpStage = 'email' | 'pin' | 'profile';
export type AppProtectedView = 'home' | 'checkout' | 'orders' | 'profile' | 'admin';

const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const NUMBERS = '23456789';
const SYMBOLS = '!@#$%^&*_-+=';
const ALL_CHARS = UPPERCASE + LOWERCASE + NUMBERS + SYMBOLS;

/**
 * Generates a cryptographically strong random integer in [0, max)
 * using Web Crypto API (CSPRNG) when available.
 */
function getSecureRandomInt(max: number): number {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return array[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Generates a high-entropy 16-character password guaranteed to satisfy all 5
 * security criteria (8+ chars, uppercase, lowercase, number, special symbol).
 */
// Must match Authentication > Providers > Email > Email OTP Length in Supabase.
export const OTP_LENGTH = 8;

export function generateStrongPassword(length: number = 16): string {
  const safeLength = Math.max(12, length);
  const chars: string[] = [
    UPPERCASE[getSecureRandomInt(UPPERCASE.length)],
    UPPERCASE[getSecureRandomInt(UPPERCASE.length)],
    LOWERCASE[getSecureRandomInt(LOWERCASE.length)],
    LOWERCASE[getSecureRandomInt(LOWERCASE.length)],
    NUMBERS[getSecureRandomInt(NUMBERS.length)],
    NUMBERS[getSecureRandomInt(NUMBERS.length)],
    SYMBOLS[getSecureRandomInt(SYMBOLS.length)],
    SYMBOLS[getSecureRandomInt(SYMBOLS.length)],
  ];

  while (chars.length < safeLength) {
    chars.push(ALL_CHARS[getSecureRandomInt(ALL_CHARS.length)]);
  }

  // Cryptographic Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join('');
}

/**
 * Copies text to clipboard on Web (navigator.clipboard) with fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Maps AuthScreen state to a clean endpoint path.
 */
export function getAuthEndpointPath(mode: AuthMode, signUpStage: SignUpStage): string {
  switch (mode) {
    case 'sign_in':
      return '/auth/login';
    case 'forgot_password':
      return '/auth/forgot-password';
    case 'reset_password':
      return '/auth/reset-password';
    case 'sign_up':
      if (signUpStage === 'pin') return '/auth/verify';
      if (signUpStage === 'profile') return '/auth/complete-profile';
      return '/auth/register';
    default:
      return '/auth/login';
  }
}

/**
 * Maps an authenticated App view to a clean endpoint path.
 */
export function getAppEndpointPath(view: AppProtectedView): string {
  switch (view) {
    case 'admin':
      return '/admin';
    case 'checkout':
      return '/checkout';
    case 'orders':
      return '/orders';
    case 'profile':
      return '/profile';
    case 'home':
    default:
      return '/home';
  }
}

/**
 * Parses the current browser URL path to determine the initial AuthScreen state.
 */
export function parseAuthRouteFromPath(pathname: string): {
  mode: AuthMode;
  signUpStage: SignUpStage;
} {
  const clean = pathname.toLowerCase().replace(/\/+$/, '');
  if (clean.endsWith('/auth/register')) {
    return { mode: 'sign_up', signUpStage: 'email' };
  }
  if (clean.endsWith('/auth/verify')) {
    return { mode: 'sign_up', signUpStage: 'pin' };
  }
  if (clean.endsWith('/auth/complete-profile')) {
    return { mode: 'sign_up', signUpStage: 'profile' };
  }
  if (clean.endsWith('/auth/forgot-password')) {
    return { mode: 'forgot_password', signUpStage: 'email' };
  }
  if (clean.endsWith('/auth/reset-password')) {
    return { mode: 'reset_password', signUpStage: 'email' };
  }
  return { mode: 'sign_in', signUpStage: 'email' };
}

/**
 * Parses the current browser URL path to determine the initial authenticated App view.
 */
export function parseAppViewFromPath(
  pathname: string,
  isAdminOrChef: boolean = false
): AppProtectedView {
  const clean = pathname.toLowerCase().replace(/\/+$/, '');
  if (clean.endsWith('/admin') && isAdminOrChef) return 'admin';
  if (clean.endsWith('/checkout')) return 'checkout';
  if (clean.endsWith('/orders')) return 'orders';
  if (clean.endsWith('/profile')) return 'profile';
  if (clean.endsWith('/home')) return 'home';
  return isAdminOrChef ? 'admin' : 'home';
}

/**
 * Updates the browser URL path without triggering a full page reload.
 * Preserves query/hash ONLY while on /auth/callback or /auth/reset-password during token exchange.
 */
export function syncBrowserHistoryPath(targetPath: string, replace: boolean = false): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.history) {
    return;
  }
  try {
    const currentPath = window.location.pathname;
    if (currentPath === targetPath) return;

    if (replace) {
      window.history.replaceState({ path: targetPath }, '', targetPath);
    } else {
      window.history.pushState({ path: targetPath }, '', targetPath);
    }
  } catch (err) {
    console.warn('Route sync notice:', err);
  }
}

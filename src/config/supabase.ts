import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper to strip any accidental surrounding quotes or whitespace from environment variables
const sanitizeEnvVar = (val?: string): string => {
  if (!val) return '';
  return val.trim().replace(/^['"]|['"]$/g, '');
};

const rawUrl = sanitizeEnvVar(process.env.EXPO_PUBLIC_SUPABASE_URL);
const rawKey = sanitizeEnvVar(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Validates if the Supabase URL and Anon Key are properly configured via .env
 */
export const isSupabaseConfigured = (): boolean => {
  const isValidUrl =
    Boolean(rawUrl) &&
    (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) &&
    !rawUrl.includes('your-project.supabase.co') &&
    !rawUrl.includes('mock-kitchenco.supabase.co');

  const isValidKey =
    Boolean(rawKey) &&
    rawKey !== 'your-anon-key' &&
    rawKey.length > 20;

  return isValidUrl && isValidKey;
};

// Fallback placeholder only used when .env is missing in offline test environments (never contains live keys)
const PLACEHOLDER_URL = 'https://placeholder-offline.supabase.co';
const PLACEHOLDER_KEY = 'offline-placeholder-anon-key';

const validSupabaseUrl = isSupabaseConfigured() ? rawUrl : PLACEHOLDER_URL;
const validSupabaseAnonKey = isSupabaseConfigured() ? rawKey : PLACEHOLDER_KEY;

export const supabase = createClient(validSupabaseUrl, validSupabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    storageKey: '@kitchen_co_sb_auth_token',
    autoRefreshToken: true,
    persistSession: true,
    flowType: 'pkce',
    // Enable session detection in URL on Web so OAuth PKCE (?code=...) and password recovery links automatically hydrate
    detectSessionInUrl: Platform.OS === 'web',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

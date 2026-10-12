/**
 * The one Supabase client the whole app shares. Credentials come from .env
 * (EXPO_PUBLIC_* vars are inlined into the bundle at build time), and the
 * session is persisted in AsyncStorage so sign-in survives app restarts.
 */
// supabase-js needs a WHATWG URL implementation, which React Native lacks.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — set them in .env (see .env.example).'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No OAuth redirects in this app, so never parse tokens out of the URL.
    detectSessionInUrl: false,
  },
});

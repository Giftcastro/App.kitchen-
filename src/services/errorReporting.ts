import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../config/supabase';

// Masks emails and long digit runs, so logs don't collect personal data.
const scrub = (text: string): string =>
  text.replace(/[^\s@]+@[^\s@]+/g, '[email]').replace(/\d{6,}/g, '[number]');

/**
 * Records a client error in public.app_error_logs. Never throws, and needs a
 * signed-in user because the table is insert-only for authenticated users.
 */
export async function reportError(context: string, error: unknown): Promise<void> {
  const raw = error instanceof Error ? error.message : String(error);
  console.warn(`[${context}]`, raw);

  try {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    await supabase.from('app_error_logs').insert({
      user_id: userId,
      context: context.slice(0, 120),
      message: scrub(raw).slice(0, 1000),
      platform: Platform.OS,
    });
  } catch {
    // Reporting must never break the app.
  }
}

/** Sends uncaught JavaScript errors to reportError, then runs the default handler. */
export function installGlobalErrorReporting(): void {
  const errorUtils = (globalThis as any).ErrorUtils;
  if (!errorUtils?.getGlobalHandler) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    reportError(isFatal ? 'uncaught_fatal' : 'uncaught', error);
    previous?.(error, isFatal);
  });
}

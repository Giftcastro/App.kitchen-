/**
 * Supabase Auth, shaped like the MAUI LoginViewModel/RegisterViewModel +
 * SessionService flow: sign in -> UserAccount, suspended accounts refused.
 */
import { supabase } from '../lib/supabase/client';
import type { Company, CompanyLocation, UserAccount } from '../models';
import { mapProfile } from './directory';

export class SuspendedAccountError extends Error {
  constructor() {
    super('This account has been suspended. Please contact your admin.');
  }
}

async function loadUser(userId: string): Promise<UserAccount> {
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error || !profile) throw error ?? new Error('Profile not found');
  let personalAddressId = '';
  if (profile.account_type !== 'company') {
    const { data: address } = await supabase
      .from('addresses')
      .select('id')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();
    personalAddressId = address?.id ?? '';
  }
  return mapProfile(profile, personalAddressId);
}

/** Re-links company membership by email domain (a company registered after signup still picks them up). */
async function resolveCompany(email: string, preferredAddressId?: string) {
  const { data } = await supabase.rpc('resolve_company_for_email', {
    p_email: email,
    p_preferred_address_id: preferredAddressId ?? null,
  });
  return data as { company_id: string } | null;
}

export async function signIn(email: string, password: string): Promise<UserAccount> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  await resolveCompany(email.trim());
  const user = await loadUser(data.user.id);
  if (!user.isActive) {
    await supabase.auth.signOut();
    throw new SuspendedAccountError();
  }
  return user;
}

/** Which company (if any) an email's domain auto-matches — safe before sign-in. */
export async function previewCompanyId(email: string): Promise<string | null> {
  const result = await resolveCompany(email.trim());
  return result?.company_id ?? null;
}

/**
 * MAUI registration requires a company and a delivery location. When the
 * email's domain belongs to the picked company the account is linked to it
 * (subsidy and all, via resolve_company_for_email). Anyone else who picks a
 * company by hand delivers to that location as an individual — company
 * membership is only ever granted by a whitelisted domain, never self-chosen.
 */
export async function register(
  fullName: string,
  email: string,
  password: string,
  company: Company,
  location: CompanyLocation
): Promise<UserAccount> {
  const cleanEmail = email.trim();
  const matchedCompanyId = await previewCompanyId(cleanEmail);
  const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
  if (error) throw error;
  if (!data.user) throw new Error('Sign-up did not return a user');
  if (!data.session) {
    throw new Error('Check your inbox to confirm your email address, then log in.');
  }

  await supabase.from('profiles').update({ name: fullName.trim() }).eq('id', data.user.id);

  if (matchedCompanyId && matchedCompanyId === company.id) {
    await resolveCompany(cleanEmail, location.id);
  } else {
    const { error: addressErr } = await supabase.from('addresses').insert({
      user_id: data.user.id,
      label: `${company.name} — ${location.name}`,
      street: location.unit ? `${location.unit}, ${location.street}` : location.street,
      suburb: location.suburb,
      city: location.city,
      code: location.code,
      distance_km: location.distanceKm || null,
      is_default: true,
    });
    if (addressErr) throw addressErr;
  }
  return loadUser(data.user.id);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Cold start: the saved session's user, or null. */
export async function restoreSession(): Promise<UserAccount | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;
  try {
    const user = await loadUser(userId);
    if (!user.isActive) {
      await supabase.auth.signOut();
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export async function reloadUser(userId: string): Promise<UserAccount> {
  return loadUser(userId);
}

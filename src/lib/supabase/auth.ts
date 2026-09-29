import { supabase } from './client';
import type { AccountType } from '../../context/KitchenCoContext';

/** Shape the rest of the app already expects (KitchenCoContext's `User`). */
export interface AuthedUser {
  email: string;
  role: string;
  name?: string;
  accountType?: AccountType;
  companyName?: string;
  /** Real company_id FK — the source of truth for discount eligibility (see isItemEligibleForDiscount in KitchenCoContext), unlike companyName which is display-only and can't safely be compared across companies (a company-targeted discount's name is RLS-scoped to its own members). */
  companyId?: string;
  companyAddressId?: string;
}

type CompanyResolution = { company_name?: string } | null;

export interface CompanyAddressPreview {
  id: string;
  label: string | null;
  street: string;
  unit: string | null;
  suburb: string;
  city: string;
  code: string;
  distance_km: number | null;
}

export interface CompanyPreview {
  company_id: string;
  company_name: string;
  meal_subsidy_cents: number | null;
  addresses: CompanyAddressPreview[];
}

/**
 * Read-only, pre-auth-safe lookup for the signup form's "we detected your
 * company" preview. Calls the same resolve_company_for_email RPC used at
 * real signup/sign-in time, so what the form shows always matches the real
 * company_domains table — never the app's old local demo company list,
 * which isn't the source of truth any more. Safe to call unauthenticated:
 * the RPC only attempts a profile write when auth.uid() is present.
 */
export async function previewCompanyForEmail(email: string): Promise<CompanyPreview | null> {
  const { data } = await supabase.rpc('resolve_company_for_email', { p_email: email });
  return (data as CompanyPreview) ?? null;
}

/** Reads the caller's own profile row — RLS limits this to their own row anyway. */
async function loadProfile(email: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('email, name, role, account_type, company_id, company_address_id')
    .eq('email', email)
    .single();
  if (error || !data) throw error ?? new Error('Profile not found');
  return data;
}

async function loadCompanyName(companyId: string | null): Promise<string | undefined> {
  if (!companyId) return undefined;
  const { data } = await supabase.from('companies').select('name').eq('id', companyId).single();
  return data?.name;
}

/**
 * Re-checks the email's domain against registered companies and updates the
 * profile's company linkage accordingly (resolve_company_for_email is
 * security definer — it does the actual write). Mirrors the app's original
 * rule: a company registered after someone's original signup still links
 * them, so this runs on every sign-in/sign-up, not just once.
 */
async function resolveAndBuildUser(email: string, preferredAddressId?: string): Promise<AuthedUser> {
  const { data: companyResult } = await supabase.rpc('resolve_company_for_email', {
    p_email: email,
    p_preferred_address_id: preferredAddressId ?? null,
  });
  const profile = await loadProfile(email);

  return {
    email: profile.email,
    role: profile.role,
    name: profile.name ?? undefined,
    accountType: profile.account_type,
    companyName: (companyResult as CompanyResolution)?.company_name,
    companyId: profile.company_id ?? undefined,
    companyAddressId: profile.company_address_id ?? undefined,
  };
}

export interface SignupAddress {
  /** Defaults to 'Home' if omitted — set to the picked location's company name/label when it comes from the delivery-location dropdown (see listDeliveryLocations). */
  label?: string;
  street: string;
  suburb: string;
  city: string;
  code?: string;
  /** Carried over from the picked delivery location so a fresh individual signup already has a delivery fee, rather than needing an admin to survey and set one later. */
  distanceKm?: number;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
  address?: SignupAddress,
  preferredCompanyAddressId?: string
): Promise<AuthedUser> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Sign-up did not return a user');

  // handle_new_user() (DB trigger) already created the profiles row by the
  // time this resolves — set the display name, then resolve company linkage.
  await supabase.from('profiles').update({ name }).eq('id', data.user.id);

  // Individuals only (company staff deliver to a registered company address
  // instead) — saved for real so place_order can find it later, not just
  // held in local app state the way the rest of address management still is.
  if (address) {
    await supabase.from('addresses').insert({
      user_id: data.user.id,
      label: address.label?.trim() || 'Home',
      street: address.street,
      suburb: address.suburb,
      city: address.city,
      code: address.code ?? '',
      distance_km: address.distanceKm ?? null,
      is_default: true,
    });
  }

  return resolveAndBuildUser(email, preferredCompanyAddressId);
}

export async function signInWithEmail(email: string, password: string): Promise<AuthedUser> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return resolveAndBuildUser(email);
}

export async function signOutUser(): Promise<void> {
  await supabase.auth.signOut();
}

/** Called once on app start — restores `user` from an existing session without re-running company resolution (that's for actual sign-in events, not every cold start). */
export async function restoreSessionUser(): Promise<AuthedUser | null> {
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  if (!email) return null;

  const profile = await loadProfile(email);
  return {
    email: profile.email,
    role: profile.role,
    name: profile.name ?? undefined,
    accountType: profile.account_type,
    companyName: await loadCompanyName(profile.company_id),
    companyId: profile.company_id ?? undefined,
    companyAddressId: profile.company_address_id ?? undefined,
  };
}

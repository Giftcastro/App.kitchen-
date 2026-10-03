/**
 * Companies, delivery locations and user accounts — the MAUI
 * ICompanyDirectoryService + IUserDirectoryService, backed by Supabase.
 *
 * RLS decides what comes back: an admin sees every company and profile; a
 * customer sees only their own company and their own profile row.
 */
import { supabase } from '../lib/supabase/client';
import type { Company, CompanyLocation, DiscountType, Role, UserAccount } from '../models';

function joinAddress(parts: (string | null | undefined)[]): string {
  return parts.filter(p => p && String(p).trim()).join(', ');
}

export function mapLocation(row: Record<string, any>, companyId?: string): CompanyLocation {
  return {
    id: row.id ?? row.address_id,
    companyId: companyId ?? row.company_id ?? '',
    name: row.label?.trim() ? row.label : row.street,
    address: joinAddress([row.unit, row.street, row.suburb, row.city, row.code]),
    deliveryInstructions: row.instructions ?? '',
    isActive: true,
    distanceKm: row.distance_km != null ? Number(row.distance_km) : 0,
    distanceKnown: row.distance_km != null,
    street: row.street ?? '',
    unit: row.unit ?? undefined,
    suburb: row.suburb ?? '',
    city: row.city ?? '',
    code: row.code ?? '',
    label: row.label ?? undefined,
  };
}

const DISCOUNT_FROM_DB: Record<string, DiscountType> = { percentage: 'Percentage', fixed: 'FixedZar' };
const DISCOUNT_TO_DB: Record<DiscountType, string> = { None: 'none', Percentage: 'percentage', FixedZar: 'fixed' };

function mapCompany(row: Record<string, any>): Company {
  return {
    id: row.id,
    name: row.name,
    billingEmail: row.billing_email ?? '',
    isActive: row.is_active !== false,
    mealSubsidyAmount: row.meal_subsidy_cents != null ? row.meal_subsidy_cents / 100 : 0,
    discountType: DISCOUNT_FROM_DB[row.discount_type] ?? 'None',
    discountValue: row.discount_value != null ? Number(row.discount_value) : 0,
    whitelistedDomains: (row.company_domains ?? []).map((d: { domain: string }) => d.domain),
    locations: ((row.company_addresses ?? []) as Record<string, any>[])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(a => mapLocation(a, row.id)),
  };
}

export async function getCompanies(): Promise<Company[]> {
  const { data, error } = await supabase.from('companies').select('*, company_domains(domain), company_addresses(*)').order('name');
  if (error) throw error;
  return (data ?? []).map(mapCompany);
}

export async function getCompany(companyId: string): Promise<Company | null> {
  if (!companyId) return null;
  const { data } = await supabase.from('companies').select('*, company_domains(domain), company_addresses(*)').eq('id', companyId).maybeSingle();
  return data ? mapCompany(data) : null;
}

export async function addCompany(name: string, billingEmail: string): Promise<Company> {
  const { data, error } = await supabase
    .from('companies')
    .insert({ name, billing_email: billingEmail || null, is_active: true })
    .select('*, company_domains(domain), company_addresses(*)')
    .single();
  if (error) throw error;
  return mapCompany(data);
}

export async function updateCompany(company: Company): Promise<void> {
  const { error } = await supabase
    .from('companies')
    .update({
      name: company.name,
      billing_email: company.billingEmail || null,
      is_active: company.isActive,
      meal_subsidy_cents: Math.round(company.mealSubsidyAmount * 100),
      discount_type: DISCOUNT_TO_DB[company.discountType],
      discount_value: company.discountValue,
    })
    .eq('id', company.id);
  if (error) throw error;
}

/** Replaces the company's whitelisted domains wholesale. */
export async function setCompanyDomains(companyId: string, domains: string[]): Promise<void> {
  const { error: delErr } = await supabase.from('company_domains').delete().eq('company_id', companyId);
  if (delErr) throw delErr;
  if (domains.length === 0) return;
  const { error } = await supabase.from('company_domains').insert(domains.map(domain => ({ company_id: companyId, domain })));
  if (error) {
    if (error.code === '23505') throw new Error('That domain already belongs to another company.');
    throw error;
  }
}

export async function addLocation(companyId: string, name: string, address: string, distanceKm: number, sortOrder: number): Promise<CompanyLocation> {
  const { data, error } = await supabase
    .from('company_addresses')
    .insert({
      company_id: companyId,
      label: name,
      street: address,
      suburb: '',
      city: '',
      code: '',
      distance_km: distanceKm,
      is_primary: sortOrder === 0,
      sort_order: sortOrder,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapLocation(data, companyId);
}

/** MAUI edits a location as name + one-line address; the address lands in `street`. */
export async function updateLocation(location: CompanyLocation, name: string, address: string, distanceKm: number): Promise<void> {
  const addressChanged = address !== location.address;
  const { error } = await supabase
    .from('company_addresses')
    .update({
      label: name,
      distance_km: distanceKm,
      ...(addressChanged ? { street: address, unit: null, suburb: '', city: '', code: '' } : {}),
    })
    .eq('id', location.id);
  if (error) throw error;
}

/** Every active company's locations, readable before sign-in (Register's pickers). */
export async function listRegistrationCompanies(): Promise<Company[]> {
  const [{ data, error }, { data: domains }] = await Promise.all([
    supabase.rpc('list_delivery_locations'),
    // Public on purpose (company_domains_read_all) — drives the email auto-match.
    supabase.from('company_domains').select('company_id, domain'),
  ]);
  if (error) throw error;
  const byCompany = new Map<string, Company>();
  for (const row of (data ?? []) as Record<string, any>[]) {
    const key = row.company_id ?? row.company_name;
    if (!byCompany.has(key)) {
      byCompany.set(key, {
        id: row.company_id ?? '',
        name: row.company_name,
        billingEmail: '',
        isActive: true,
        mealSubsidyAmount: 0,
        discountType: 'None',
        discountValue: 0,
        whitelistedDomains: (domains ?? []).filter((d: Record<string, any>) => d.company_id === row.company_id).map((d: Record<string, any>) => d.domain),
        locations: [],
      });
    }
    byCompany.get(key)!.locations.push(mapLocation(row, row.company_id ?? ''));
  }
  return [...byCompany.values()];
}

// ── Users ───────────────────────────────────────────────────────────────

const ROLE_FROM_DB: Record<string, Role> = { admin: 'Admin', kitchen_staff: 'Kitchen Staff' };
const ROLE_TO_DB: Record<Role, string> = { Customer: 'customer', 'Kitchen Staff': 'kitchen_staff', Admin: 'admin' };

export function mapProfile(row: Record<string, any>, personalAddressId = ''): UserAccount {
  return {
    id: row.id,
    fullName: row.name?.trim() ? row.name : row.email,
    email: row.email,
    role: ROLE_FROM_DB[row.role] ?? 'Customer',
    isActive: row.is_active !== false,
    joinedDate: row.created_at,
    companyId: row.account_type === 'company' ? row.company_id ?? '' : '',
    locationId: row.account_type === 'company' ? row.company_address_id ?? '' : personalAddressId,
    deliveryFloor: row.delivery_floor ?? '',
    accountType: row.account_type === 'company' ? 'company' : 'individual',
  };
}

export async function getUsers(): Promise<UserAccount[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at');
  if (error) throw error;
  return (data ?? []).map(row => mapProfile(row));
}

export async function updateUser(user: UserAccount): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ name: user.fullName, role: ROLE_TO_DB[user.role], is_active: user.isActive })
    .eq('id', user.id);
  if (error) throw error;
}

export async function updateDeliveryFloor(userId: string, floor: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ delivery_floor: floor }).eq('id', userId);
  if (error) throw error;
}

/** The location a user's orders deliver to: their company site, or (individuals) their own default address. */
export async function getDeliveryLocation(user: UserAccount): Promise<CompanyLocation | null> {
  if (!user.locationId) return null;
  const table = user.accountType === 'company' ? 'company_addresses' : 'addresses';
  const { data } = await supabase.from(table).select('*').eq('id', user.locationId).maybeSingle();
  return data ? mapLocation(data, user.companyId) : null;
}

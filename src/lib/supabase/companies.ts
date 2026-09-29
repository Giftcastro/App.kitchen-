import { supabase } from './client';
import type { Company, CompanyAddress } from '../../context/KitchenCoContext';

/** Postgres foreign-key-violation error code — company_address_id/company_id
 *  both reference these rows with no ON DELETE cascade, so removing an
 *  address or company an employee is still linked to fails at the database,
 *  not silently. */
const FK_VIOLATION = '23503';

interface DbCompanyAddressRow {
  id: string;
  label: string | null;
  street: string;
  unit: string | null;
  suburb: string;
  city: string;
  code: string;
  instructions: string | null;
  distance_km: number | null;
  sort_order: number;
}

function mapAddress(row: DbCompanyAddressRow): CompanyAddress {
  return {
    id: row.id,
    label: row.label ?? undefined,
    street: row.street,
    unit: row.unit ?? undefined,
    suburb: row.suburb,
    city: row.city,
    code: row.code,
    instructions: row.instructions ?? undefined,
    distanceKm: row.distance_km ?? undefined,
  };
}

/**
 * Every company this account can see — RLS does the filtering
 * (companies_read_own_or_admin in 0002): an admin gets every registered
 * company, a signed-in employee gets only their own, and anyone else gets
 * none. Shared by the admin Corporate Clients tab and Profile's own-company
 * card, same as `menus` is shared between the admin Meals tab and the
 * customer Menu screen.
 */
export async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, meal_subsidy_cents, company_domains(domain), company_addresses(*)')
    .order('name');
  if (error) throw error;
  return (data ?? []).map((row: Record<string, any>) => ({
    id: row.id,
    name: row.name,
    domains: (row.company_domains ?? []).map((d: Record<string, any>) => d.domain),
    addresses: (row.company_addresses ?? [])
      .slice()
      .sort((a: DbCompanyAddressRow, b: DbCompanyAddressRow) => a.sort_order - b.sort_order)
      .map(mapAddress),
    mealSubsidy: row.meal_subsidy_cents != null ? row.meal_subsidy_cents / 100 : undefined,
  }));
}

export interface CompanyDraft {
  name: string;
  domains: string[];
  /** `id` is a real DB uuid for an address that already exists, or the
   *  admin form's local `addr-N` placeholder for a newly added one. */
  addresses: CompanyAddress[];
  mealSubsidy?: number;
}

async function insertAddresses(companyId: string, addresses: CompanyAddress[], startingSortOrder: number) {
  if (addresses.length === 0) return;
  const { error } = await supabase.from('company_addresses').insert(
    addresses.map((a, idx) => ({
      company_id: companyId,
      label: a.label ?? null,
      street: a.street,
      unit: a.unit ?? null,
      suburb: a.suburb,
      city: a.city,
      code: a.code,
      instructions: a.instructions ?? null,
      distance_km: a.distanceKm ?? null,
      is_primary: startingSortOrder + idx === 0,
      sort_order: startingSortOrder + idx,
    }))
  );
  if (error) throw error;
}

/** Admin-only (companies_write_admin / company_domains_write_admin / company_addresses_write_admin in 0002). */
export async function adminCreateCompany(draft: CompanyDraft): Promise<void> {
  const { data: company, error } = await supabase
    .from('companies')
    .insert({
      name: draft.name,
      meal_subsidy_cents: draft.mealSubsidy != null ? Math.round(draft.mealSubsidy * 100) : null,
    })
    .select('id')
    .single();
  if (error) throw error;

  if (draft.domains.length > 0) {
    const { error: domainErr } = await supabase
      .from('company_domains')
      .insert(draft.domains.map(domain => ({ company_id: company.id, domain })));
    if (domainErr) throw domainErr;
  }

  await insertAddresses(company.id, draft.addresses, 0);
}

/**
 * Updates the company row, replaces its domains wholesale (nothing else
 * references a domain row), and diffs its addresses rather than replacing
 * them: an address already assigned to an employee
 * (profiles.company_address_id) can't be deleted — the FK has no cascade —
 * so existing addresses are updated in place by id and only ones genuinely
 * removed from the form are deleted. If one of those turns out to be
 * assigned to an employee, that single delete fails (FK_VIOLATION) without
 * losing the rest of the save; the caller surfaces which one.
 */
export async function adminUpdateCompany(companyId: string, draft: CompanyDraft): Promise<{ blockedAddressDeletes: CompanyAddress[] }> {
  const { error: companyErr } = await supabase
    .from('companies')
    .update({
      name: draft.name,
      meal_subsidy_cents: draft.mealSubsidy != null ? Math.round(draft.mealSubsidy * 100) : null,
    })
    .eq('id', companyId);
  if (companyErr) throw companyErr;

  const { error: deleteDomainsErr } = await supabase.from('company_domains').delete().eq('company_id', companyId);
  if (deleteDomainsErr) throw deleteDomainsErr;
  if (draft.domains.length > 0) {
    const { error: insertDomainsErr } = await supabase
      .from('company_domains')
      .insert(draft.domains.map(domain => ({ company_id: companyId, domain })));
    if (insertDomainsErr) throw insertDomainsErr;
  }

  const { data: existingRows, error: existingErr } = await supabase
    .from('company_addresses')
    .select('id')
    .eq('company_id', companyId);
  if (existingErr) throw existingErr;
  const existingIds = new Set((existingRows ?? []).map((r: { id: string }) => r.id));

  // A draft address is "existing" only if its id is a real row on this
  // company — the admin form's placeholder ids for newly-added addresses
  // (createCompanyAddressId(), e.g. "addr-3") never match a uuid here.
  const toUpdate = draft.addresses.filter(a => existingIds.has(a.id));
  const toInsert = draft.addresses.filter(a => !existingIds.has(a.id));
  const keptIds = new Set(toUpdate.map(a => a.id));
  const toDeleteIds = [...existingIds].filter(id => !keptIds.has(id));

  for (let idx = 0; idx < toUpdate.length; idx++) {
    const a = toUpdate[idx];
    const { error } = await supabase
      .from('company_addresses')
      .update({
        label: a.label ?? null,
        street: a.street,
        unit: a.unit ?? null,
        suburb: a.suburb,
        city: a.city,
        code: a.code,
        instructions: a.instructions ?? null,
        distance_km: a.distanceKm ?? null,
        is_primary: idx === 0,
        sort_order: idx,
      })
      .eq('id', a.id);
    if (error) throw error;
  }

  await insertAddresses(companyId, toInsert, toUpdate.length);

  const blockedAddressDeletes: CompanyAddress[] = [];
  for (const id of toDeleteIds) {
    const { error } = await supabase.from('company_addresses').delete().eq('id', id);
    if (error) {
      if (error.code === FK_VIOLATION) {
        const stillThere = draft.addresses.find(a => a.id === id) ?? { id, street: '(removed address)', suburb: '', city: '', code: '' };
        blockedAddressDeletes.push(stillThere);
        continue;
      }
      throw error;
    }
  }

  return { blockedAddressDeletes };
}

export interface DeliveryLocation {
  id: string;
  companyName: string;
  label: string | null;
  street: string;
  unit: string | null;
  suburb: string;
  city: string;
  code: string;
  distanceKm: number | null;
}

/**
 * UI-review placeholder only (user instruction, Sep 2026: "this is just for
 * UI... we do not need to update the backend yet, until everything is
 * approved") — the real `list_delivery_locations()` RPC (0007) hasn't been
 * pushed to the live Supabase project, so it currently returns nothing.
 *
 * Deliberately NOT the three real corporate clients (Ecogra/TATA/RCL) —
 * those are private corporate accounts, not public pickup points, and the
 * client's own feedback (Sep 2026) is specifically that *she* will create
 * the businesses/delivery addresses individuals choose from, separate from
 * her corporate clients' offices. These are generic, clearly-invented example
 * locations instead, so nothing here implies the general public can collect
 * from a real client's premises. Never persisted — signup/Profile only ever
 * copy a chosen location's display fields into a real address row, so these
 * ids never need to resolve to anything real. Delete this constant and the
 * fallback below once 0007 is live and the client's real addresses are in it.
 */
const DEMO_DELIVERY_LOCATIONS: DeliveryLocation[] = [
  { id: 'demo-1', companyName: 'Sandton Collection Point', label: null, street: '1 Maude Street', unit: null, suburb: 'Sandton', city: 'Johannesburg', code: '', distanceKm: null },
  { id: 'demo-2', companyName: 'Rosebank Pickup Point', label: null, street: '15 Baker Street', unit: null, suburb: 'Rosebank', city: 'Johannesburg', code: '', distanceKm: null },
  { id: 'demo-3', companyName: 'Fourways Depot', label: null, street: '4 Cedar Road', unit: null, suburb: 'Fourways', city: 'Johannesburg', code: '', distanceKm: null },
];

/**
 * Every registered business/delivery address, across every company — the
 * pool individuals now pick their delivery/collection point from at signup
 * and in Profile, instead of typing their own address (client review, Sep
 * 2026). Pre-auth-safe (list_delivery_locations is a public RPC, see 0007),
 * unlike fetchCompanies above which RLS restricts to admins and that
 * company's own employees.
 */
export async function listDeliveryLocations(): Promise<DeliveryLocation[]> {
  try {
    const { data, error } = await supabase.rpc('list_delivery_locations');
    if (error) throw error;
    const mapped = (data ?? []).map((row: Record<string, any>) => ({
      id: row.address_id,
      companyName: row.company_name,
      label: row.label ?? null,
      street: row.street,
      unit: row.unit ?? null,
      suburb: row.suburb,
      city: row.city,
      code: row.code,
      distanceKm: row.distance_km ?? null,
    }));
    return mapped.length > 0 ? mapped : DEMO_DELIVERY_LOCATIONS;
  } catch {
    return DEMO_DELIVERY_LOCATIONS;
  }
}

/** Throws with a friendly message if employees are still linked to this company (FK_VIOLATION). */
export async function adminDeleteCompany(companyId: string): Promise<void> {
  const { error } = await supabase.from('companies').delete().eq('id', companyId);
  if (error) {
    if (error.code === FK_VIOLATION) {
      throw new Error('This company still has employee accounts linked to it — reassign or remove them first.');
    }
    throw error;
  }
}

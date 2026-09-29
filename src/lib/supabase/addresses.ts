import { supabase } from './client';

export interface ResolvedAddress {
  id: string;
  label: string;
  street: string;
  suburb: string;
  city: string;
  code: string | null;
  distanceKm: number | null;
}

/**
 * Resolves the signed-in user's real delivery address for checkout —
 * individuals' own default address, or their company's assigned site.
 * Deliberately reads only the real Supabase tables, not the app's older
 * local mock address/company state (Profile's "add address" screen still
 * only writes to that local state, not here — a separate follow-up).
 */
export async function fetchMyDeliveryAddress(
  accountType: string | undefined,
  companyAddressId: string | undefined
): Promise<ResolvedAddress | null> {
  if (accountType === 'company') {
    if (!companyAddressId) return null;
    const { data } = await supabase.from('company_addresses').select('*').eq('id', companyAddressId).maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      label: data.label || data.street,
      street: data.unit ? `${data.unit}, ${data.street}` : data.street,
      suburb: data.suburb,
      city: data.city,
      code: data.code,
      distanceKm: data.distance_km,
    };
  }

  const { data } = await supabase
    .from('addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    label: data.label || 'Home',
    street: data.street,
    suburb: data.suburb,
    city: data.city,
    code: data.code,
    distanceKm: data.distance_km,
  };
}

export interface AdminAddress {
  id: string;
  userEmail: string;
  userName: string | null;
  label: string | null;
  street: string;
  suburb: string;
  city: string;
  code: string;
  distanceKm: number | null;
}

/**
 * Every individual customer's address, for the admin "Addresses" tab — the
 * only place distance_km on a personal address can be set (see 0006's
 * addresses_read_own_or_admin policy; nothing geocodes it automatically).
 * Company addresses aren't included here — those are still edited through
 * the (local-only, for now) Corporate Clients admin screen.
 */
export async function fetchAllAddressesForAdmin(): Promise<AdminAddress[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('id, label, street, suburb, city, code, distance_km, profiles(email, name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, any>) => ({
    id: row.id,
    userEmail: row.profiles?.email ?? 'Unknown',
    userName: row.profiles?.name ?? null,
    label: row.label,
    street: row.street,
    suburb: row.suburb,
    city: row.city,
    code: row.code,
    distanceKm: row.distance_km,
  }));
}

/** Admin-only write (see 0006's addresses_write_admin policy). */
export async function adminSetAddressDistance(addressId: string, distanceKm: number): Promise<void> {
  const { error } = await supabase.from('addresses').update({ distance_km: distanceKm }).eq('id', addressId);
  if (error) throw error;
}

import { supabase } from './client';
import type { AppUser } from '../../context/KitchenCoContext';

/**
 * Every registered account, for the admin Users list and for attributing
 * orders to their corporate client. profiles_read_own_or_admin (0002) means a
 * non-admin only gets their own row back, so callers should only use this
 * for an admin. orderCount is left at 0 — the caller derives it from the
 * orders it already has instead of a second round-trip.
 */
export async function fetchUserDirectory(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, account_type, created_at, company:companies!profiles_company_id_fkey(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, any>): AppUser => {
    const company = Array.isArray(row.company) ? row.company[0] : row.company;
    return {
      id: row.id,
      email: row.email,
      name: row.name ?? row.email.split('@')[0],
      role: row.role,
      accountType: row.account_type,
      companyName: company?.name ?? undefined,
      joinedDate: new Date(row.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }),
      orderCount: 0,
    };
  });
}

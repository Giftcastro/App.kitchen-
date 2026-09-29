import { supabase } from './client';
import type { Discount } from '../../context/KitchenCoContext';

/** Postgres unique-violation code — discounts.code is `unique`. */
const DUPLICATE_CODE = '23505';

function mapDiscount(row: Record<string, any>): Discount {
  return {
    id: row.id,
    code: row.code,
    percentage: row.percentage,
    active: row.active,
    expires: row.expires_at
      ? new Date(row.expires_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
      : undefined,
    // companyId is the scalar FK on this row — always correct, no matter
    // who's viewing (discount visibility is governed by
    // discounts_read_active_or_admin, not by companies' own RLS). `company`
    // is the display name via an embedded join that IS scoped by
    // companies_read_own_or_admin: correct for an admin (bypasses RLS
    // entirely) but can come back unset for a non-admin viewing a discount
    // that targets a company other than their own. That's fine — see
    // Discount.company's doc comment — nothing reads it for eligibility.
    companyId: row.company_id ?? undefined,
    company: row.companies?.name,
    categoryId: row.category_id ?? undefined,
    itemName: row.menu_items?.name,
  };
}

/**
 * Every discount this account can see — discounts_read_active_or_admin in
 * 0002 gives an admin every discount (active or not, for management) and
 * everyone else only the active ones (for checkout pricing).
 */
export async function fetchDiscounts(): Promise<Discount[]> {
  const { data, error } = await supabase
    .from('discounts')
    .select('id, code, percentage, active, expires_at, company_id, category_id, companies(name), menu_items(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDiscount);
}

async function resolveCompanyId(companyName: string | undefined): Promise<string | null> {
  if (!companyName) return null;
  const { data, error } = await supabase.from('companies').select('id').eq('name', companyName).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No company named "${companyName}" found.`);
  return data.id;
}

/** Item targeting is scoped to a category (the admin form only offers items from the chosen category), so the lookup needs both. */
async function resolveItemId(categoryId: string | undefined, itemName: string | undefined): Promise<string | null> {
  if (!itemName) return null;
  if (!categoryId) throw new Error('Pick a category before picking an item to target.');
  const { data, error } = await supabase.from('menu_items').select('id').eq('category_id', categoryId).eq('name', itemName).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No dish named "${itemName}" found in that category.`);
  return data.id;
}

export interface DiscountDraft {
  code: string;
  percentage: number;
  active: boolean;
  /** Free-form date the admin form collects, e.g. "31 Dec 2026" — already validated as parseable there. */
  expires?: string;
  company?: string;
  categoryId?: string;
  itemName?: string;
}

/** Admin-only (discounts_write_admin in 0002). */
export async function adminCreateDiscount(draft: DiscountDraft): Promise<void> {
  const companyId = await resolveCompanyId(draft.company);
  const itemId = await resolveItemId(draft.categoryId, draft.itemName);
  const { error } = await supabase.from('discounts').insert({
    code: draft.code,
    percentage: draft.percentage,
    active: draft.active,
    expires_at: draft.expires ? new Date(draft.expires).toISOString() : null,
    company_id: companyId,
    category_id: draft.categoryId ?? null,
    item_id: itemId,
  });
  if (error) {
    if (error.code === DUPLICATE_CODE) throw new Error(`A discount code "${draft.code}" already exists.`);
    throw error;
  }
}

/** Only ever called with `{ active }` today (the admin list's toggle) — the other fields are handled defensively in case a future edit form sends more. */
export async function adminUpdateDiscount(discountId: string, updates: Partial<DiscountDraft>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.code !== undefined) patch.code = updates.code;
  if (updates.percentage !== undefined) patch.percentage = updates.percentage;
  if (updates.active !== undefined) patch.active = updates.active;
  if (updates.expires !== undefined) patch.expires_at = updates.expires ? new Date(updates.expires).toISOString() : null;
  if (updates.company !== undefined) patch.company_id = await resolveCompanyId(updates.company);
  if (updates.categoryId !== undefined) patch.category_id = updates.categoryId ?? null;
  if (updates.itemName !== undefined || updates.categoryId !== undefined) {
    patch.item_id = await resolveItemId(updates.categoryId, updates.itemName);
  }
  const { error } = await supabase.from('discounts').update(patch).eq('id', discountId);
  if (error) {
    if (error.code === DUPLICATE_CODE) throw new Error(`A discount code "${updates.code}" already exists.`);
    throw error;
  }
}

export async function adminDeleteDiscount(discountId: string): Promise<void> {
  const { error } = await supabase.from('discounts').delete().eq('id', discountId);
  if (error) throw error;
}

/**
 * Discount codes (MAUI IDiscountService) and broadcast notifications (MAUI
 * AdminNotificationsViewModel's sent history), backed by Supabase.
 */
import { supabase } from '../lib/supabase/client';
import type { Discount, NotificationLog, UserAccount } from '../models';
import { getAllActiveOrders } from './orders';

function mapDiscount(row: Record<string, any>): Discount {
  return {
    id: row.id,
    code: row.code,
    percentage: Number(row.percentage),
    active: row.active,
    expires: row.expires_at ?? undefined,
    companyId: row.company_id ?? undefined,
    companyName: row.companies?.name ?? undefined,
    categoryId: row.category_id ?? undefined,
    itemId: row.item_id ?? undefined,
  };
}

/** Active codes first, as MAUI orders them. RLS: admins see all, customers only active codes. */
export async function getDiscounts(): Promise<Discount[]> {
  const { data, error } = await supabase
    .from('discounts')
    .select('id, code, percentage, active, expires_at, company_id, category_id, item_id, companies(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDiscount).sort((a, b) => Number(b.active) - Number(a.active));
}

export async function addDiscount(code: string, percentage: number, expires: Date | null, companyId: string | null): Promise<void> {
  const { error } = await supabase.from('discounts').insert({
    code,
    percentage,
    active: true,
    expires_at: expires ? expires.toISOString() : null,
    company_id: companyId,
  });
  if (error) {
    if (error.code === '23505') throw new Error(`A discount code "${code}" already exists.`);
    throw error;
  }
}

export async function setDiscountActive(discountId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('discounts').update({ active }).eq('id', discountId);
  if (error) throw error;
}

export async function deleteDiscount(discountId: string): Promise<void> {
  const { error } = await supabase.from('discounts').delete().eq('id', discountId);
  if (error) throw error;
}

// ── Notifications ───────────────────────────────────────────────────────

export const AUDIENCE_OPTIONS = ['All Users', 'All Customers', 'Kitchen Staff', 'Active Order Holders'];

export async function getSentHistory(): Promise<NotificationLog[]> {
  const { data, error } = await supabase.from('announcements').select('*').order('sent_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, any>) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    targetAudience: row.target_audience ?? 'All Users',
    sentAt: row.sent_at,
    recipientCount: row.recipient_count ?? 0,
  }));
}

export async function getRecipientCount(audience: string, users: UserAccount[]): Promise<number> {
  switch (audience) {
    case 'Kitchen Staff':
      return users.filter(u => u.role === 'Kitchen Staff').length;
    case 'All Customers':
      return users.filter(u => u.role === 'Customer').length;
    case 'Active Order Holders': {
      const active = await getAllActiveOrders();
      return new Set(active.map(o => o.userId)).size;
    }
    default:
      return users.length;
  }
}

export async function sendNotification(title: string, body: string, audience: string, recipientCount: number): Promise<NotificationLog> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('announcements')
    .insert({ title, body, company_id: null, target_audience: audience, recipient_count: recipientCount, created_by: auth.user?.id ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return { id: data.id, title: data.title, body: data.body, targetAudience: audience, sentAt: data.sent_at, recipientCount };
}

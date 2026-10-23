/**
 * Discount codes (MAUI IDiscountService; read-only here — checkout applies
 * them, codes are managed in the database) and broadcast notifications (MAUI
 * AdminNotificationsViewModel) and each person's in-app inbox, backed by Supabase.
 */
import { supabase } from '../lib/supabase/client';
import type { Discount, InboxMessage, NotificationLog } from '../models';

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

// ── Notifications ───────────────────────────────────────────────────────

/** Who a message goes to; send_announcement (migration 0012) resolves it to people on the server. */
export type MessageTarget =
  | { audience: 'All Users' | 'All Customers' | 'Kitchen Staff' | 'Active Order Holders' }
  | { audience: 'Company'; companyId: string }
  | { audience: 'Person'; userId: string };

export const GROUP_AUDIENCES = ['All Users', 'All Customers', 'Kitchen Staff', 'Active Order Holders'] as const;
export const COMPANY_AUDIENCE = 'A Company…';
export const PERSON_AUDIENCE = 'One Person…';
export const AUDIENCE_OPTIONS = [...GROUP_AUDIENCES, COMPANY_AUDIENCE, PERSON_AUDIENCE];

function mapLog(row: Record<string, any>): NotificationLog {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    targetAudience: row.target_audience ?? 'All Users',
    sentAt: row.sent_at,
    recipientCount: row.recipient_count ?? 0,
  };
}

export async function getSentHistory(): Promise<NotificationLog[]> {
  const { data, error } = await supabase.from('announcements').select('*').order('sent_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapLog);
}

/** Logs the message and delivers it to each recipient's inbox; the returned log carries the real recipient count. */
export async function sendNotification(title: string, body: string, target: MessageTarget): Promise<NotificationLog> {
  const { data, error } = await supabase.rpc('send_announcement', {
    p_title: title,
    p_body: body,
    p_audience: target.audience,
    p_company_id: target.audience === 'Company' ? target.companyId : null,
    p_user_id: target.audience === 'Person' ? target.userId : null,
  });
  if (error) throw error;
  return mapLog(data);
}

// ── Inbox (Profile > Messages) ──────────────────────────────────────────

/** The signed-in person's messages, newest first. RLS limits the rows to their own. */
export async function getMyMessages(userId: string): Promise<InboxMessage[]> {
  const { data, error } = await supabase
    .from('announcement_recipients')
    .select('read_at, announcements(id, title, body, sent_at)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? [])
    .filter((row: Record<string, any>) => row.announcements)
    .map((row: Record<string, any>) => ({
      id: row.announcements.id,
      title: row.announcements.title,
      body: row.announcements.body,
      sentAt: row.announcements.sent_at,
      isRead: !!row.read_at,
    }))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('announcement_recipients')
    .select('announcement_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markMessagesRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_announcements_read');
  if (error) throw error;
}

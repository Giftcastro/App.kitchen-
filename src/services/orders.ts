/**
 * Orders — the MAUI IOrderService, backed by Supabase. All writes go through
 * the security-definer RPCs (place_order, update_order_status,
 * submit_order_rating, report_order_dispute); the database prices every line
 * itself and never trusts the client's numbers.
 *
 * One Supabase order is one checkout (it can hold several lines); the
 * screens show it the way MAUI shows an order, with ItemName summarising its
 * lines ("2x Classic Burger, Caesar Salad").
 */
import { supabase } from '../lib/supabase/client';
import type { CartItem, DisputeStatus, Order, OrderLine, OrderStatus } from '../models';
import { todayIso } from './scheduling';

const STATUS_FROM_DB: Record<string, OrderStatus> = {
  pending: 'Received',
  preparing: 'Preparing',
  on_the_way: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
const STATUS_TO_DB: Record<string, string> = {
  Received: 'pending',
  Preparing: 'preparing',
  'Out for Delivery': 'on_the_way',
  Delivered: 'delivered',
};
const DISPUTE_FROM_DB: Record<string, DisputeStatus> = { investigating: 'Investigating', refunded: 'Refunded', resolved: 'Resolved' };

const first = (x: any) => (Array.isArray(x) ? x[0] : x);

function friendlyError(error: { message?: string } | null, fallback: string): Error {
  const msg = error?.message ?? '';
  const known: [string, string][] = [
    ['ORDER_NOT_DELIVERED', 'This order can only be rated once it has been delivered.'],
    ['ALREADY_RATED', 'This order has already been rated.'],
    ['ALREADY_DISPUTED', 'A ticket has already been logged for this order.'],
    ['ORDER_NOT_FOUND', 'This order could not be found.'],
    ['NOT_AUTHORIZED', 'You do not have permission to do this.'],
    ['CUTOFF_PASSED', 'One of the delivery dates in your basket has passed the 9:00 AM order cutoff. Please pick a new date.'],
    ['UNDELIVERABLE_DISTANCE', "Your delivery location doesn't have a delivery distance set yet, or is beyond our 50km range. Please contact us to arrange delivery."],
    ['ADDRESS_NOT_FOUND', "We couldn't find your delivery location. Please contact support."],
    ['MENU_ITEM_INACTIVE', 'One of the dishes in your basket is no longer available. Please remove it and try again.'],
    ['ACCOUNT_SUSPENDED', 'This account has been suspended. Please contact your admin.'],
    ['EMPTY_CART', 'Your basket is empty.'],
  ];
  const hit = known.find(([code]) => msg.includes(code));
  return new Error(hit ? hit[1] : fallback);
}

function mapLine(row: Record<string, any>): OrderLine {
  const menuItem = first(row.menu_items);
  const category = first(menuItem?.menu_categories);
  return {
    name: row.name,
    quantity: row.quantity,
    unitPrice: row.price_cents / 100,
    sizeLabel: row.size_label ?? undefined,
    notes: row.notes ?? '',
    allergyNotes: row.allergy_notes ?? '',
    category: category?.name ?? (row.menu_item_id ? '' : 'Cycling Menu'),
    deliveryDate: row.delivery_date,
    isCycle: !row.menu_item_id,
  };
}

function mapOrder(row: Record<string, any>): Order {
  const lines: OrderLine[] = (row.order_items ?? []).map(mapLine);
  const rating = first(row.order_ratings);
  const dispute = first(row.order_disputes);
  const profile = first(row.profile);
  const notes = lines.map(l => l.notes).filter(Boolean);
  const allergies = lines.map(l => l.allergyNotes).filter(Boolean);
  return {
    id: row.id,
    orderNumber: row.invoice_number ?? row.id.slice(0, 8).toUpperCase(),
    orderId: row.invoice_number ?? row.id.slice(0, 8).toUpperCase(),
    userId: row.user_id,
    customerName: profile?.name?.trim() ? profile.name : profile?.email ?? '',
    status: STATUS_FROM_DB[row.status] ?? 'Received',
    summaryText: notes.join('; '),
    allergyNotes: allergies.join('; '),
    itemName: lines.map(l => (l.quantity > 1 ? `${l.quantity}x ${l.name}` : l.name)).join(', '),
    lines,
    category: lines[0]?.category ?? '',
    orderDate: row.created_at,
    totalAmount: row.total_cents / 100,
    subsidyAmount: (row.subsidy_amount_cents ?? 0) / 100,
    deliveryFee: (row.delivery_fee_cents ?? 0) / 100,
    discountAmount: (row.discount_amount_cents ?? 0) / 100,
    rating: rating?.rating ?? 0,
    ratingFeedback: rating?.feedback ?? '',
    taxInvoiceNumber: row.invoice_number ?? '',
    disputeReason: dispute?.reason ?? '',
    disputeTicketRef: dispute?.ticket_ref ?? '',
    disputeReportedAt: dispute?.reported_at ?? undefined,
    disputeStatus: dispute ? DISPUTE_FROM_DB[dispute.status] ?? 'Investigating' : '',
    deliveryDate: row.delivery_date,
    menuType: lines.length > 0 && lines.every(l => l.isCycle) ? 'cycle' : 'static',
    companyId: row.company_id ?? '',
    locationId: row.delivery_address_snapshot?.address_id ?? '',
    deliveryFloor: profile?.delivery_floor ?? '',
  };
}

const ORDER_SELECT =
  '*, order_items(*, menu_items(menu_categories(name))), order_ratings(*), order_disputes(*), profile:profiles!orders_user_id_fkey(*)';

/** Every order the caller can see — their own, or (admin) everyone's. Newest delivery first. */
export async function getAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).order('delivery_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapOrder);
}

/** The caller's own upcoming orders (delivery today or later), soonest first. */
export async function getActiveOrdersForUser(userId: string): Promise<Order[]> {
  const today = todayIso();
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('user_id', userId)
    .gte('delivery_date', today)
    .neq('status', 'cancelled')
    .order('delivery_date');
  if (error) throw error;
  return (data ?? []).map(mapOrder);
}

/** The caller's own past orders (delivery before today), newest first. */
export async function getOrderHistoryForUser(userId: string): Promise<Order[]> {
  const today = todayIso();
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('user_id', userId)
    .lt('delivery_date', today)
    .order('delivery_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapOrder);
}

/** Every upcoming order across every company (admin). */
export async function getAllActiveOrders(): Promise<Order[]> {
  const today = todayIso();
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .gte('delivery_date', today)
    .neq('status', 'cancelled')
    .order('delivery_date');
  if (error) throw error;
  return (data ?? []).map(mapOrder);
}

/**
 * Places the basket as one real order. Returns it so the confirmation screen
 * shows real details (invoice number, server-priced total).
 */
export async function placeCartOrder(items: CartItem[], addressId: string, paymentReference: string): Promise<Order> {
  const payload = items.map(item => {
    const size = item.selectedOptions.find(o => o.sizeLabel);
    return {
      source: item.menuType,
      menu_item_id: item.menuType === 'static' ? item.product.id : null,
      size_label: item.menuType === 'static' ? size?.sizeLabel ?? item.product.baseSizeLabel ?? null : null,
      cycle_week_number: item.product.cycleRef?.weekNumber ?? null,
      cycle_day_of_week: item.product.cycleRef?.dayOfWeek ?? null,
      cycle_slot: item.product.cycleRef?.slot ?? null,
      name: item.product.name,
      quantity: item.quantity,
      notes: item.specialRequests.trim() || null,
      allergy_notes: item.allergyNotes.trim() || null,
      delivery_date: item.deliveryDate,
      addons: item.selectedOptions.filter(o => o.isAddOn).map(o => ({ name: o.name })),
    };
  });
  const { data, error } = await supabase.rpc('place_order', {
    p_cart: payload,
    p_address_id: addressId,
    p_payment_reference: paymentReference,
  });
  if (error) throw friendlyError(error, 'Your order could not be placed — check your connection and try again.');
  const { data: full, error: fetchErr } = await supabase.from('orders').select(ORDER_SELECT).eq('id', data.id).single();
  if (fetchErr) throw fetchErr;
  return mapOrder(full);
}

/** Admin. The database applies it to the whole company + delivery-day batch. */
export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const { error } = await supabase.rpc('update_order_status', { p_order_id: orderId, p_new_status: STATUS_TO_DB[status] });
  if (error) throw friendlyError(error, 'Could not update this order — check your connection and try again.');
}

/** 1-5 stars, or 0 to clear. Feedback is kept when omitted. */
export async function rateOrder(orderId: string, rating: number, feedback?: string): Promise<void> {
  const { error } = await supabase.rpc('submit_order_rating', { p_order_id: orderId, p_rating: rating, p_feedback: feedback ?? null });
  if (error) throw friendlyError(error, 'Could not save your rating — check your connection and try again.');
}

/** Opens a support ticket; returns its reference (e.g. "TCK-00012"). */
export async function reportDispute(orderId: string, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc('report_order_dispute', { p_order_id: orderId, p_reason: reason });
  if (error) throw friendlyError(error, 'Could not log this ticket — check your connection and try again.');
  return data.ticket_ref;
}

/** Admin resolves a dispute. */
export async function updateDisputeStatus(orderId: string, status: DisputeStatus): Promise<void> {
  const { error } = await supabase.from('order_disputes').update({ status: status.toLowerCase() }).eq('order_id', orderId);
  if (error) throw friendlyError(error, 'Could not update this dispute — check your connection and try again.');
}

/** Resolves location names for a set of address ids (company sites and personal addresses). */
export async function getLocationNames(addressIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(addressIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const [{ data: sites }, { data: personal }] = await Promise.all([
    supabase.from('company_addresses').select('id, label, street').in('id', ids),
    supabase.from('addresses').select('id, label, street').in('id', ids),
  ]);
  const names: Record<string, string> = {};
  for (const row of [...(sites ?? []), ...(personal ?? [])]) names[row.id] = row.label?.trim() ? row.label : row.street;
  return names;
}

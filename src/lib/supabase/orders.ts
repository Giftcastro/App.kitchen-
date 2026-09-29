import { supabase } from './client';
import type { CartItem, Order } from '../../context/KitchenCoContext';

/** A real order id is a Supabase uuid; seeded demo orders use ids like "ORD-1234" and have no database row to update. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isRealOrderId(id: string): boolean {
  return UUID_RE.test(id);
}

/** update_order_status/submit_order_rating/report_order_dispute (0003) raise these as plain exception messages — map them to something a customer or admin can actually read. */
function friendlyRpcError(error: { message?: string } | null | undefined, fallback: string): Error {
  const msg = error?.message ?? '';
  if (msg.includes('ORDER_NOT_DELIVERED')) return new Error('This order can only be rated once it has been delivered.');
  if (msg.includes('ALREADY_RATED')) return new Error('This order has already been rated.');
  if (msg.includes('ALREADY_DISPUTED')) return new Error('A ticket has already been logged for this order.');
  if (msg.includes('ORDER_NOT_FOUND')) return new Error('This order could not be found.');
  if (msg.includes('NOT_AUTHORIZED')) return new Error('You do not have permission to do this.');
  return new Error(fallback);
}

function toCartPayload(items: CartItem[], fallbackDeliveryDate: string | null) {
  return items.map(item => ({
    source: item.source ?? 'static',
    menu_item_id: item.menuItemId ?? null,
    size_label: item.selectedSize ?? null,
    cycle_week_number: item.cycleWeekNumber ?? null,
    cycle_day_of_week: item.cycleDayOfWeek ?? null,
    cycle_slot: item.cycleSlot ?? null,
    name: item.name,
    quantity: item.quantity,
    notes: item.notes ?? null,
    // The RPC requires a delivery_date on every line — falls back to the
    // customer's chosen default ordering date for the rare item added
    // without one, rather than sending null and failing the DB's not-null
    // constraint on order_items.delivery_date.
    delivery_date: item.deliveryDate ?? fallbackDeliveryDate,
    addons: item.addOns && item.addOns.length > 0 ? item.addOns.map(a => ({ name: a.name })) : undefined,
  }));
}

/** order_ratings/order_disputes are keyed 1:1 on order_id (their primary key IS the FK), so PostgREST embeds a single object — but this stays defensive since the untyped `Database = any` client can't confirm that at compile time. */
function firstOrSelf(x: any): any {
  return Array.isArray(x) ? x[0] : x;
}

/**
 * delivery_address_snapshot always carries address_id; the fuller label/street
 * fields are optional (place_order only stores the id today, the demo seed
 * stores the full address) — so this returns undefined rather than a blank
 * address card when there's nothing displayable.
 */
function mapAddressSnapshot(snapshot: Record<string, any> | null | undefined): Order['deliveryAddress'] {
  if (!snapshot?.street) return undefined;
  return {
    id: snapshot.address_id ?? '',
    label: snapshot.label ?? '',
    street: snapshot.street,
    suburb: snapshot.suburb ?? '',
    city: snapshot.city ?? '',
    code: snapshot.code ?? '',
    isDefault: false,
  };
}

function mapDbOrderRow(row: Record<string, any>): Order {
  const ratingRow = firstOrSelf(row.order_ratings);
  const disputeRow = firstOrSelf(row.order_disputes);
  const profileRow = firstOrSelf(row.profile);
  return {
    id: row.id,
    // Who actually placed it — not whoever is signed in. An admin's fetch
    // returns everyone's orders, and every admin view attributes an order to
    // its company through userEmail.
    userEmail: profileRow?.email ?? undefined,
    userName: profileRow?.name ?? undefined,
    deliveryAddress: mapAddressSnapshot(row.delivery_address_snapshot),
    items: (row.order_items ?? []).map((oi: Record<string, any>): CartItem => ({
      id: oi.id,
      name: oi.name,
      price: oi.price_cents / 100,
      category: '',
      quantity: oi.quantity,
      selectedSize: oi.size_label ?? undefined,
      notes: oi.notes ?? undefined,
      deliveryDate: oi.delivery_date ?? undefined,
    })),
    total: row.total_cents / 100,
    totalPrice: row.subtotal_cents / 100,
    status: row.status,
    date: new Date(row.created_at).toLocaleString(),
    // ISO, not toLocaleString(): every consumer does new Date(timestamp), and a
    // locale-formatted string isn't reliably parseable back across devices.
    timestamp: row.created_at,
    deliveryFee: row.delivery_fee_cents ? row.delivery_fee_cents / 100 : undefined,
    note: row.notes ?? undefined,
    discountAmount: row.discount_amount_cents ? row.discount_amount_cents / 100 : undefined,
    subsidyAmount: row.subsidy_amount_cents ? row.subsidy_amount_cents / 100 : undefined,
    paymentReference: row.payment_reference ?? undefined,
    rating: ratingRow
      ? { rating: ratingRow.rating, feedback: ratingRow.feedback ?? undefined, submittedAt: ratingRow.submitted_at }
      : undefined,
    dispute: disputeRow
      ? { reportedAt: disputeRow.reported_at, reason: disputeRow.reason ?? '', supportTicketRef: disputeRow.ticket_ref, status: disputeRow.status }
      : undefined,
  };
}

/**
 * Calls the real place_order RPC — server re-validates cutoff, re-prices
 * every line from the catalog, resolves discount/subsidy, and mints a real
 * invoice number. Returns an Order shaped for immediate local display; the
 * `items` on it come from the cart passed in (already known client-side)
 * rather than a round-trip re-fetch, mirroring what the old mock placeOrder
 * did with `items: [...cart]`.
 */
export async function placeRealOrder(
  cart: CartItem[],
  addressId: string,
  fallbackDeliveryDate: string | null,
  paymentReference?: string
): Promise<Order> {
  const { data, error } = await supabase.rpc('place_order', {
    p_cart: toCartPayload(cart, fallbackDeliveryDate),
    p_address_id: addressId,
    p_payment_reference: paymentReference ?? null,
  });
  if (error) throw error;

  return {
    ...mapDbOrderRow(data),
    items: cart,
  };
}

/**
 * The signed-in customer's own orders — RLS already restricts this to their
 * own rows (orders_read_own_or_admin in 0002), or to every real order when
 * called by an admin.
 */
export async function fetchMyOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), order_ratings(*), order_disputes(*), profile:profiles!orders_user_id_fkey(email, name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDbOrderRow);
}

/**
 * Admin-only (update_order_status in 0003 checks is_admin() itself).
 * Propagates to every order sharing the same real corporate batch
 * (company + delivery day) in one statement — the actual batching rule,
 * enforced server-side so it can't be bypassed by updating one row
 * directly. Returns every order id the database actually changed, so the
 * caller can patch local state by id instead of re-deriving batch
 * membership client-side (which, for a real order, would need the
 * customer's real company — not always available locally).
 */
export async function adminUpdateOrderStatus(orderId: string, status: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('update_order_status', { p_order_id: orderId, p_new_status: status });
  if (error) throw friendlyRpcError(error, 'Could not update this order — check your connection and try again.');
  return (data ?? []).map((row: { id: string }) => row.id);
}

export async function submitRealOrderRating(orderId: string, rating: number, feedback?: string): Promise<void> {
  const { error } = await supabase.rpc('submit_order_rating', { p_order_id: orderId, p_rating: rating, p_feedback: feedback ?? null });
  if (error) throw friendlyRpcError(error, 'Could not submit your rating — check your connection and try again.');
}

/** Returns the real support ticket reference the database minted, so the UI never has to invent its own. */
export async function reportRealOrderDispute(orderId: string, reason?: string): Promise<string> {
  const { data, error } = await supabase.rpc('report_order_dispute', { p_order_id: orderId, p_reason: reason ?? null });
  if (error) throw friendlyRpcError(error, 'Could not log this ticket — check your connection and try again.');
  return data.ticket_ref;
}

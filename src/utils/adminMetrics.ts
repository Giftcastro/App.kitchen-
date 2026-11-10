/**
 * One definition of every number on the admin screens, so they cannot disagree.
 *
 * Order: one customer's purchase for one delivery date.
 * Meal: one portion. An order holds one or more meals.
 * Revenue: what customers paid (total_amount), including the delivery fee.
 */

import { OrderHistoryItem } from '../types';
import { formatDateISO, getNowInSAST, parseDateISO } from './sastTime';

type Order = OrderHistoryItem;

export type ReportTimeframe = 'Today' | 'This Week' | 'This Month' | 'Last 30 Days';

export const getTodayIsoSAST = (): string => formatDateISO(getNowInSAST());

export function addDaysIso(iso: string, days: number): string {
  const date = parseDateISO(iso);
  date.setDate(date.getDate() + days);
  return formatDateISO(date);
}

export const isPreparing = (o: Order): boolean =>
  o.status === 'paid_scheduled' || o.status === 'kitchen_prepping';
export const isOutForDelivery = (o: Order): boolean => o.status === 'out_for_delivery';
export const isDelivered = (o: Order): boolean => o.status === 'delivered';
export const isUnfulfilled = (o: Order): boolean => o.status === 'unfulfilled';

/** Still to be delivered. Equals Preparing plus Out for Delivery. */
export const isActiveOrder = (o: Order): boolean => isPreparing(o) || isOutForDelivery(o);

/** A paid order. Unpaid checkouts never reach the admin screens; cancelled ones do not count. */
export const isSale = (o: Order): boolean => o.status !== 'cancelled' && o.status !== 'pending_payment';

export const mealsInOrder = (o: Order): number => o.items.reduce((sum, item) => sum + item.quantity, 0);
export const sumMeals = (orders: Order[]): number => orders.reduce((sum, o) => sum + mealsInOrder(o), 0);
export const sumRevenue = (orders: Order[]): number => orders.reduce((sum, o) => sum + (o.totalPaid || 0), 0);

export const mealsLabel = (count: number): string => `${count} ${count === 1 ? 'meal' : 'meals'}`;
export const ordersLabel = (count: number): string => `${count} ${count === 1 ? 'order' : 'orders'}`;
export const mealsAndOrdersLabel = (orders: Order[]): string =>
  `${mealsLabel(sumMeals(orders))} · ${ordersLabel(orders.length)}`;

/** Paid orders whose delivery date is today or later. */
export const upcomingSales = (orders: Order[], todayIso: string): Order[] =>
  orders.filter((o) => isSale(o) && o.targetDeliveryDate >= todayIso);

/** Paid orders delivered, or due, from the 1st of this month up to and including today. */
export const monthToDateSales = (orders: Order[], todayIso: string): Order[] =>
  orders.filter(
    (o) =>
      isSale(o) &&
      o.targetDeliveryDate?.startsWith(todayIso.slice(0, 7)) &&
      o.targetDeliveryDate <= todayIso
  );

/** Paid orders recorded with no meals, which needs investigating. */
export const ordersWithoutMeals = (orders: Order[]): Order[] =>
  orders.filter((o) => isSale(o) && mealsInOrder(o) === 0);

/** Report periods are by delivery date, Monday to Sunday for a week. */
export function isInTimeframe(deliveryIso: string, timeframe: ReportTimeframe, todayIso: string): boolean {
  if (!deliveryIso) return false;
  if (timeframe === 'Today') return deliveryIso === todayIso;
  if (timeframe === 'This Month') return deliveryIso.startsWith(todayIso.slice(0, 7));
  if (timeframe === 'Last 30 Days') return deliveryIso >= addDaysIso(todayIso, -29) && deliveryIso <= todayIso;

  const daysSinceMonday = (parseDateISO(todayIso).getDay() + 6) % 7;
  const monday = addDaysIso(todayIso, -daysSinceMonday);
  return deliveryIso >= monday && deliveryIso <= addDaysIso(monday, 6);
}

/** Delivered as a percentage of orders that were delivered or reported missing. Null if neither. */
export function fulfilmentRate(orders: Order[]): number | null {
  const delivered = orders.filter(isDelivered).length;
  const total = delivered + orders.filter(isUnfulfilled).length;
  return total === 0 ? null : (delivered / total) * 100;
}

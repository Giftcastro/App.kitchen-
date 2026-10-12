/**
 * AdminOrderRow — an order plus its resolved company/location names, for
 * the admin dashboard and Active Orders grid. Shared filtering helpers match
 * both MAUI view models (company + date pickers, "All ..." options first).
 */
import type { Company, Order } from '../models';
import { getAllActiveOrders, getLocationNames, updateOrderStatus } from './orders';
import { getCompanies } from './directory';
import { fmtDayLabel } from './scheduling';

export interface AdminOrderRow {
  order: Order;
  companyName: string;
  locationName: string;
  deliveryDateLabel: string;
}

export const ALL_COMPANIES = 'All Companies';
export const ALL_DATES = 'All Dates';
/** Orders from individual (non-company) accounts — they have no company to file under. */
export const INDIVIDUAL = 'Individual';

/** Every active order with its company / location names resolved, plus the company list for the filters. */
export async function loadActiveOrderRows(): Promise<{ rows: AdminOrderRow[]; companies: Company[] }> {
  const [orders, companies] = await Promise.all([getAllActiveOrders(), getCompanies()]);
  const names = await getLocationNames(orders.map(o => o.locationId));
  const companyName = new Map(companies.map(c => [c.id, c.name]));
  const rows = orders.map(order => ({
    order,
    companyName: order.companyId ? companyName.get(order.companyId) ?? 'Unknown Company' : INDIVIDUAL,
    locationName: names[order.locationId] ?? 'Unknown Location',
    deliveryDateLabel: fmtDayLabel(order.deliveryDate),
  }));
  return { rows, companies };
}

/** "All Companies", each company, and "Individual" only if individuals have active orders. */
export function companyFilterOptions(companies: Company[], rows: AdminOrderRow[]): string[] {
  const options = [ALL_COMPANIES, ...companies.map(c => c.name)];
  if (rows.some(r => r.companyName === INDIVIDUAL)) options.push(INDIVIDUAL);
  return options;
}

/** "All Dates" followed by each delivery day that has orders, earliest first. */
export function dateFilterOptions(rows: AdminOrderRow[]): string[] {
  const dates = [...new Set(rows.map(r => r.order.deliveryDate))].sort();
  return [ALL_DATES, ...dates.map(fmtDayLabel)];
}

/** Applies the Company + Date picker values (as their display labels). */
export function filterRows(rows: AdminOrderRow[], company: string, date: string): AdminOrderRow[] {
  return rows.filter(r => (company === ALL_COMPANIES || r.companyName === company) && (date === ALL_DATES || r.deliveryDateLabel === date));
}

/**
 * Sets every given order to one status. The database applies a status to a
 * whole company + delivery-day batch at once, so one call per batch covers
 * every order in it.
 */
export async function updateRowsStatus(rows: AdminOrderRow[], status: string): Promise<void> {
  const batches = new Map<string, string>();
  for (const r of rows) batches.set(`${r.order.companyId}:${r.order.deliveryDate}`, r.order.id);
  for (const orderId of batches.values()) await updateOrderStatus(orderId, status);
}

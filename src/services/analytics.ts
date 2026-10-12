/**
 * Reports & Analytics — every number on the Reports tab, computed from the
 * orders the admin can see. Pure functions (no I/O) so the screen and the
 * Excel exports read the same figures.
 *
 * Definitions (stated once, used everywhere):
 *  - Period: orders whose DELIVERY date falls in [start, end]; the comparison
 *    period is the same number of days immediately before it.
 *  - Cancelled orders are left out of every money / volume figure.
 *  - Revenue = what customers paid (incl. delivery fees) + meal subsidies
 *    billed to their companies. Discounts are money given away, shown
 *    separately.
 *  - Meals = dish quantities (an order of 2x Burger + Salad is 3 meals).
 */
import type { Company, Order, UserAccount } from '../models';
import { fromIso, toIso } from './scheduling';

const DAY = 86400000;
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
/** "R12,345.67" */
export const rand = (n: number) => `R${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
/** Fewer ratings than this and an average says more about one diner than about the dish. */
export const MIN_RATINGS = 3;

/** ISO date shifted by a number of days (negative goes back). */
export const addDays = (iso: string, days: number) => {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
};
const daysBetween = (a: string, b: string) => Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / DAY);

/** Cancelled orders are excluded from every figure. */
export const isLive = (o: Order) => o.status !== 'Cancelled';
/** Meals in an order = sum of line quantities. */
export const meals = (o: Order) => sum(o.lines, l => l.quantity);
/** Revenue of one order: what the customer paid + the subsidy billed to their company. */
export const revenueOf = (o: Order) => o.totalAmount + o.subsidyAmount;

export interface Headline {
  revenue: number;
  customerPaid: number;
  subsidies: number;
  discounts: number;
  deliveryFees: number;
  orders: number;
  meals: number;
  aov: number;
  mealsPerOrder: number;
  cancelled: number;
}

/** Top-line Sales figures for a set of orders. */
export function headline(orders: Order[]): Headline {
  const live = orders.filter(isLive);
  const revenue = sum(live, revenueOf);
  return {
    revenue: round2(revenue),
    customerPaid: round2(sum(live, o => o.totalAmount)),
    subsidies: round2(sum(live, o => o.subsidyAmount)),
    discounts: round2(sum(live, o => o.discountAmount)),
    deliveryFees: round2(sum(live, o => o.deliveryFee)),
    orders: live.length,
    meals: sum(live, meals),
    aov: live.length ? round2(revenue / live.length) : 0,
    mealsPerOrder: live.length ? Math.round((sum(live, meals) / live.length) * 10) / 10 : 0,
    cancelled: orders.length - live.length,
  };
}

/** % change vs the previous period; null when there's no baseline to compare with. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** The equally long period immediately before [start, end], for the comparison. */
export function previousRange(start: string, end: string): [string, string] {
  const length = daysBetween(start, end) + 1;
  return [addDays(start, -length), addDays(start, -1)];
}

/** Orders whose delivery date falls in [start, end] (inclusive). */
export const inRange = (orders: Order[], start: string, end: string) => orders.filter(o => o.deliveryDate >= start && o.deliveryDate <= end);

// ── Menu ────────────────────────────────────────────────────────────────

export interface DishStat {
  name: string;
  category: string;
  units: number;
  revenue: number;
  avgPrice: number;
  orders: number;
  avgRating: number | null;
  ratings: number;
}

/** Per-dish units, revenue, average price and rating, best sellers first; optionally one category only. */
export function dishStats(orders: Order[], category?: string): DishStat[] {
  const map = new Map<string, DishStat & { ratingSum: number; orderIds: Set<string> }>();
  for (const o of orders.filter(isLive)) {
    for (const l of o.lines) {
      if (category && l.category !== category) continue;
      const s = map.get(l.name) ?? { name: l.name, category: l.category, units: 0, revenue: 0, avgPrice: 0, orders: 0, avgRating: null, ratings: 0, ratingSum: 0, orderIds: new Set() };
      s.units += l.quantity;
      s.revenue += l.unitPrice * l.quantity;
      if (!s.orderIds.has(o.id)) {
        s.orderIds.add(o.id);
        if (o.rating > 0) {
          s.ratings += 1;
          s.ratingSum += o.rating;
        }
      }
      map.set(l.name, s);
    }
  }
  return [...map.values()]
    .map(({ ratingSum, orderIds, ...s }) => ({
      ...s,
      revenue: round2(s.revenue),
      avgPrice: s.units ? round2(s.revenue / s.units) : 0,
      orders: orderIds.size,
      avgRating: s.ratings ? Math.round((ratingSum / s.ratings) * 10) / 10 : null,
    }))
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue);
}

export type Quadrant = 'Stars' | 'Workhorses' | 'Puzzles' | 'Dogs';

/** Classic menu-engineering split (Kasavana & Smith): popularity vs price, using price as the margin proxy we have. */
export const QUADRANTS: { key: Quadrant; emoji: string; hint: string }[] = [
  { key: 'Stars', emoji: '⭐', hint: 'Popular and premium — protect and feature these' },
  { key: 'Workhorses', emoji: '🐴', hint: 'Popular but low-priced — a small price rise or cheaper sides' },
  { key: 'Puzzles', emoji: '🧩', hint: 'Premium but rarely ordered — promote, rename or reposition' },
  { key: 'Dogs', emoji: '🐕', hint: 'Low sales, low price — candidates to rework or drop' },
];

/** Sorts dishes into Stars / Workhorses / Puzzles / Dogs by popularity x average price. */
export function menuMatrix(dishes: DishStat[]): { quadrant: Record<string, Quadrant>; popularityLine: number; priceLine: number } {
  const totalUnits = sum(dishes, d => d.units);
  // Popular = at least 70% of an equal share of units (the standard menu-engineering threshold).
  const popularityLine = dishes.length ? (totalUnits / dishes.length) * 0.7 : 0;
  const priceLine = totalUnits ? sum(dishes, d => d.revenue) / totalUnits : 0;
  const quadrant: Record<string, Quadrant> = {};
  for (const d of dishes) {
    const popular = d.units >= popularityLine;
    const premium = d.avgPrice >= priceLine;
    quadrant[d.name] = popular ? (premium ? 'Stars' : 'Workhorses') : premium ? 'Puzzles' : 'Dogs';
  }
  return { quadrant, popularityLine: Math.round(popularityLine * 10) / 10, priceLine: round2(priceLine) };
}

export interface MixRow {
  name: string;
  value: number;
  count: number;
  detail?: string;
}

/** Meals and food revenue per menu category. */
export function categoryMix(orders: Order[]): MixRow[] {
  const map = new Map<string, MixRow>();
  for (const o of orders.filter(isLive))
    for (const l of o.lines) {
      const key = l.category || 'Uncategorised';
      const row = map.get(key) ?? { name: key, value: 0, count: 0 };
      row.value += l.unitPrice * l.quantity;
      row.count += l.quantity;
      map.set(key, row);
    }
  return [...map.values()].map(r => ({ ...r, value: round2(r.value) })).sort((a, b) => b.value - a.value);
}

// ── Customers ───────────────────────────────────────────────────────────

export interface CustomerStats {
  active: number;
  newCustomers: number;
  returning: number;
  repeatRate: number;
  ordersPerCustomer: number;
  revenuePerCustomer: number;
}

/** `allOrders` (every period) decides who is new: their first-ever order falls on or after `periodStart`. */
export function customerStats(periodOrders: Order[], allOrders: Order[], periodStart: string): CustomerStats {
  const live = periodOrders.filter(isLive);
  const byCustomer = new Map<string, Order[]>();
  for (const o of live) byCustomer.set(o.userId, [...(byCustomer.get(o.userId) ?? []), o]);
  const firstOrder = new Map<string, string>();
  for (const o of allOrders.filter(isLive)) {
    const prev = firstOrder.get(o.userId);
    if (!prev || o.deliveryDate < prev) firstOrder.set(o.userId, o.deliveryDate);
  }
  const active = byCustomer.size;
  const newCustomers = [...byCustomer.keys()].filter(id => (firstOrder.get(id) ?? '') >= periodStart).length;
  const repeaters = [...byCustomer.values()].filter(os => os.length >= 2).length;
  return {
    active,
    newCustomers,
    returning: active - newCustomers,
    repeatRate: active ? Math.round((repeaters / active) * 100) : 0,
    ordersPerCustomer: active ? Math.round((live.length / active) * 10) / 10 : 0,
    revenuePerCustomer: active ? round2(sum(live, revenueOf) / active) : 0,
  };
}

export interface AdoptionRow {
  company: string;
  registered: number;
  ordering: number;
  rate: number;
  revenue: number;
}

/** Share of each company's registered staff who ordered in the period — the headline health metric for a corporate account. */
export function companyAdoption(periodOrders: Order[], companies: Company[], users: UserAccount[]): AdoptionRow[] {
  const live = periodOrders.filter(isLive);
  return companies
    .map(c => {
      const staff = users.filter(u => u.role === 'Customer' && u.companyId === c.id);
      const orderers = new Set(live.filter(o => o.companyId === c.id).map(o => o.userId));
      const registered = Math.max(staff.length, orderers.size);
      return {
        company: c.name,
        registered,
        ordering: orderers.size,
        rate: registered ? Math.round((orderers.size / registered) * 100) : 0,
        revenue: round2(sum(live.filter(o => o.companyId === c.id), revenueOf)),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

/** Highest-revenue customers (by name), with their company as the detail line. */
export function topCustomers(orders: Order[], companyName: (id: string) => string, limit = 10): MixRow[] {
  const map = new Map<string, Order[]>();
  for (const o of orders.filter(isLive)) {
    const key = o.customerName.trim() || 'Unknown';
    map.set(key, [...(map.get(key) ?? []), o]);
  }
  return [...map.entries()]
    .map(([name, os]) => ({ name, value: round2(sum(os, revenueOf)), count: os.length, detail: companyName(os[0].companyId) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Revenue per company, with the subsidy / discount it received. */
export function byCompany(orders: Order[], companyName: (id: string) => string): MixRow[] {
  const map = new Map<string, Order[]>();
  for (const o of orders.filter(isLive)) {
    const key = companyName(o.companyId);
    map.set(key, [...(map.get(key) ?? []), o]);
  }
  return [...map.entries()]
    .map(([name, os]) => ({
      name,
      value: round2(sum(os, revenueOf)),
      count: os.length,
      detail: `subsidy ${rand(sum(os, o => o.subsidyAmount))} · discount ${rand(sum(os, o => o.discountAmount))}`,
    }))
    .sort((a, b) => b.value - a.value);
}

// ── Operations ──────────────────────────────────────────────────────────

export interface DemandDay {
  date: string;
  meals: number;
  orders: number;
  topDishes: string;
}

/** Committed meals for the next `days` delivery days — what the kitchen has to buy for and prep. */
export function upcomingDemand(allOrders: Order[], today: string, days = 7): DemandDay[] {
  const end = addDays(today, days);
  const upcoming = allOrders.filter(o => isLive(o) && o.deliveryDate >= today && o.deliveryDate < end);
  const byDay = new Map<string, Order[]>();
  for (const o of upcoming) byDay.set(o.deliveryDate, [...(byDay.get(o.deliveryDate) ?? []), o]);
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, os]) => ({
      date,
      meals: sum(os, meals),
      orders: os.length,
      topDishes: dishStats(os)
        .slice(0, 3)
        .map(d => `${d.units}× ${d.name}`)
        .join(', '),
    }));
}

/** Orders by the hour they were placed (local time). */
export function orderHours(orders: Order[]): { hour: number; orders: number }[] {
  const counts = new Array(24).fill(0) as number[];
  for (const o of orders.filter(isLive)) counts[new Date(o.orderDate).getHours()] += 1;
  return counts.map((n, hour) => ({ hour, orders: n }));
}

/** Days between placing an order and its delivery. */
export function leadTimes(orders: Order[]): { avg: number; buckets: MixRow[] } {
  const live = orders.filter(isLive);
  const lead = live.map(o => Math.max(0, daysBetween(toIso(new Date(o.orderDate)), o.deliveryDate)));
  const buckets: [string, (d: number) => boolean][] = [
    ['2 days (at cutoff)', d => d <= 2],
    ['3–4 days', d => d >= 3 && d <= 4],
    ['5–7 days', d => d >= 5 && d <= 7],
    ['8+ days', d => d >= 8],
  ];
  return {
    avg: lead.length ? Math.round((sum(lead, d => d) / lead.length) * 10) / 10 : 0,
    buckets: buckets.map(([name, test]) => ({ name, value: lead.filter(test).length, count: lead.filter(test).length })),
  };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Meals per delivery weekday, Monday–Friday. */
export function weekdayDemand(orders: Order[]): { day: string; meals: number }[] {
  const counts = new Array(7).fill(0) as number[];
  for (const o of orders.filter(isLive)) counts[fromIso(o.deliveryDate).getDay()] += meals(o);
  return [1, 2, 3, 4, 5].map(i => ({ day: WEEKDAYS[i], meals: counts[i] }));
}

export interface QualityStats {
  avgRating: number | null;
  rated: number;
  ratable: number;
  coverage: number;
  distribution: { stars: number; count: number }[];
  disputes: number;
  disputeRate: number;
  openDisputes: number;
}

/** Rating average / spread / coverage and dispute counts. */
export function quality(orders: Order[]): QualityStats {
  const live = orders.filter(isLive);
  const ratable = live.filter(o => o.status === 'Delivered');
  const rated = live.filter(o => o.rating > 0);
  const disputes = live.filter(o => !!o.disputeTicketRef);
  return {
    avgRating: rated.length ? Math.round((sum(rated, o => o.rating) / rated.length) * 10) / 10 : null,
    rated: rated.length,
    ratable: ratable.length,
    coverage: ratable.length ? Math.round((rated.length / ratable.length) * 100) : 0,
    distribution: [5, 4, 3, 2, 1].map(stars => ({ stars, count: rated.filter(o => o.rating === stars).length })),
    disputes: disputes.length,
    disputeRate: live.length ? Math.round((disputes.length / live.length) * 1000) / 10 : 0,
    openDisputes: disputes.filter(o => o.disputeStatus === 'Investigating').length,
  };
}

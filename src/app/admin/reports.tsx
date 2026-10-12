/**
 * Reports & Analytics — built around the questions an admin actually asks,
 * one tab each:
 *
 *  - Sales:     how are we doing vs the previous period, where does revenue
 *               come from, which companies drive it
 *  - Menu:      what sells, the category mix, and a menu-engineering matrix
 *               (popularity x price) that says what to feature, reprice or drop
 *  - Customers: who orders, new vs returning, repeat rate, and per-company
 *               adoption (staff ordering vs staff registered)
 *  - Kitchen:   committed demand for the next 7 delivery days, when orders
 *               come in, lead time, weekday demand, ratings and disputes
 *
 * All figures come from services/analytics (definitions live there). The
 * range / company / category filters apply everywhere except the 7-day
 * demand outlook, which always looks forward from today.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { BarChart, BarList, ChartDatum } from '../../components/Charts';
import { Btn, Card, LabeledPicker, Page, Picker } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { getCompanies, getUsers } from '../../services/directory';
import { getAllOrders, updateDisputeStatus } from '../../services/orders';
import { getStaticProducts } from '../../services/catalog';
import { fmtDate, fmtDayLabel, fmtDayMonth, fmtShortWeekday, fromIso, todayIso, toIso } from '../../services/scheduling';
import { fmtIssued, shareXlsx, XlsxWriter } from '../../services/export';
import {
  byCompany,
  categoryMix,
  change,
  companyAdoption,
  customerStats,
  DishStat,
  dishStats,
  headline,
  inRange,
  isLive,
  leadTimes,
  MIN_RATINGS,
  rand,
  menuMatrix,
  orderHours,
  previousRange,
  QUADRANTS,
  quality,
  revenueOf,
  topCustomers,
  upcomingDemand,
  weekdayDemand,
} from '../../services/analytics';
import { hasDispute } from '../../models';
import type { Company, DisputeStatus, Order, UserAccount } from '../../models';

const TIMEFRAMES = ['Today', 'This Week', 'This Month', 'Last 30 Days', 'Custom Range'];
const ALL_COMPANIES = 'All Companies';
const ALL_CATEGORIES = 'All Categories';
const TABS = ['Sales', 'Menu', 'Customers', 'Kitchen'] as const;
type Tab = (typeof TABS)[number];

const pct = (n: number) => `${n}%`;

/** Turns a timeframe choice into an inclusive [start, end] ISO date range (weeks start on Monday). */
function resolveRange(timeframe: string, customStart: string, customEnd: string): [string, string] {
  const today = new Date();
  const iso = toIso(today);
  switch (timeframe) {
    case 'Today':
      return [iso, iso];
    case 'This Month':
      return [toIso(new Date(today.getFullYear(), today.getMonth(), 1)), toIso(new Date(today.getFullYear(), today.getMonth() + 1, 0))];
    case 'Last 30 Days':
      return [toIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)), iso];
    case 'Custom Range':
      return customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart];
    default: {
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
      return [toIso(monday), toIso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6))];
    }
  }
}

/** "ddd dd MMM" — e.g. "Wed 07 Oct" */
const shortDay = (iso: string) => `${fmtShortWeekday(iso)} ${fmtDayMonth(iso)}`;

/** [label, fromHour, toHour) groups for the "When orders come in" chart. */
const HOUR_BUCKETS: [string, number, number][] = [
  ['<6', 0, 6],
  ['6–9', 6, 9],
  ['9–12', 9, 12],
  ['12–15', 12, 15],
  ['15–18', 15, 18],
  ['18–21', 18, 21],
  ['21+', 21, 24],
];

export default function AdminReportsScreen() {
  const { colors } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [menuItemNames, setMenuItemNames] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('Sales');
  const [timeframe, setTimeframe] = useState('This Week');
  const [companyFilter, setCompanyFilter] = useState(ALL_COMPANIES);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [customStart, setCustomStart] = useState(() => toIso(new Date(Date.now() - 7 * 86400000)));
  const [customEnd, setCustomEnd] = useState(() => toIso(new Date()));

  // Everything is computed client-side from the full order history, reloaded on focus.
  useFocusEffect(
    useCallback(() => {
      Promise.all([getAllOrders(), getCompanies(), getUsers()])
        .then(([loadedOrders, loadedCompanies, loadedUsers]) => {
          setOrders(loadedOrders);
          setCompanies(loadedCompanies);
          setUsers(loadedUsers);
        })
        .catch(err => alerts.show('Could Not Load', (err as Error)?.message ?? 'Check your connection and try again.', 'OK'));
      // Menu names so the worst performers include dishes that never sold at all.
      getStaticProducts()
        .then(products => setMenuItemNames([...new Set(products.filter(p => p.isAvailable).map(p => p.name).filter(n => n.trim()))]))
        .catch(() => setMenuItemNames([]));
    }, [])
  );

  const companyNameById = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);
  const companyName = useCallback((id: string) => companyNameById.get(id) ?? 'Individual', [companyNameById]);
  const categories = useMemo(
    () => [ALL_CATEGORIES, ...[...new Set(orders.flatMap(o => o.lines.map(l => l.category)).filter(Boolean))].sort()],
    [orders]
  );

  // Company + category filters apply everywhere; the date range is applied per period below.
  const scoped = useMemo(
    () =>
      orders.filter(
        o =>
          (companyFilter === ALL_COMPANIES || companyName(o.companyId) === companyFilter) &&
          (categoryFilter === ALL_CATEGORIES || o.lines.some(l => l.category === categoryFilter))
      ),
    [orders, companyFilter, categoryFilter, companyName]
  );
  const [start, end] = resolveRange(timeframe, customStart, customEnd);
  const [prevStart, prevEnd] = previousRange(start, end);
  const period = useMemo(() => inRange(scoped, start, end), [scoped, start, end]);
  const previous = useMemo(() => inRange(scoped, prevStart, prevEnd), [scoped, prevStart, prevEnd]);
  const now = headline(period);
  const before = headline(previous);
  const category = categoryFilter === ALL_CATEGORIES ? undefined : categoryFilter;

  // ── Menu ──
  const dishes = useMemo(() => dishStats(period, category), [period, category]);
  const matrix = useMemo(() => menuMatrix(dishes), [dishes]);
  const topPerformers = useMemo(() => dishes.slice(0, 10), [dishes]);
  // Never-ordered menu items first, then the slowest sellers that aren't already in the top 10.
  const bottomPerformers = useMemo(() => {
    const sold = new Set(dishes.map(d => d.name));
    const best = new Set(topPerformers.map(d => d.name));
    const neverSold: DishStat[] = menuItemNames
      .filter(n => !sold.has(n))
      .map(n => ({ name: n, category: '', units: 0, revenue: 0, avgPrice: 0, orders: 0, avgRating: null, ratings: 0 }));
    const lowest = [...dishes].filter(d => !best.has(d.name)).sort((a, b) => a.units - b.units || a.revenue - b.revenue);
    return [...neverSold, ...lowest].slice(0, 10);
  }, [dishes, topPerformers, menuItemNames]);
  const mix = useMemo(() => categoryMix(period), [period]);
  const mixTotal = mix.reduce((t, r) => t + r.value, 0);

  // ── Customers ──
  const customers = useMemo(() => customerStats(period, scoped, start), [period, scoped, start]);
  const customersBefore = useMemo(() => customerStats(previous, scoped, prevStart), [previous, scoped, prevStart]);
  const adoption = useMemo(
    () => companyAdoption(period, companyFilter === ALL_COMPANIES ? companies : companies.filter(c => c.name === companyFilter), users),
    [period, companies, users, companyFilter]
  );
  // Companies where fewer than 30% of registered staff ordered — flagged in an insight line.
  const lowAdoption = adoption.filter(r => r.rate < 30 && r.registered > 0);
  const top = useMemo(() => topCustomers(period, companyName), [period, companyName]);
  const revenueByCompany = useMemo(() => byCompany(period, companyName), [period, companyName]);

  // ── Kitchen ──
  const today = todayIso();
  const demand = useMemo(() => upcomingDemand(scoped, today), [scoped, today]);
  const hours = useMemo(() => {
    const raw = orderHours(period);
    return HOUR_BUCKETS.map(([label, from, to]) => ({ label, orders: raw.filter(h => h.hour >= from && h.hour < to).reduce((s, h) => s + h.orders, 0) }));
  }, [period]);
  const busiestHour = [...hours].sort((a, b) => b.orders - a.orders)[0];
  const lead = useMemo(() => leadTimes(period), [period]);
  const leadTotal = lead.buckets.reduce((t, x) => t + x.count, 0);
  const weekdays = useMemo(() => weekdayDemand(period), [period]);
  const q = useMemo(() => quality(period), [period]);
  const lowestRated = useMemo(
    () => dishes.filter(d => d.ratings >= MIN_RATINGS).sort((a, b) => (a.avgRating ?? 0) - (b.avgRating ?? 0)).slice(0, 5),
    [dishes]
  );
  // Every dispute (not just this range), open tickets first, newest first within each group.
  const disputed = useMemo(
    () =>
      orders
        .filter(hasDispute)
        .sort(
          (a, b) =>
            Number(b.disputeStatus === 'Investigating') - Number(a.disputeStatus === 'Investigating') ||
            (b.disputeReportedAt ?? '').localeCompare(a.disputeReportedAt ?? '')
        ),
    [orders]
  );
  const openDisputes = disputed.filter(o => o.disputeStatus === 'Investigating').length;

  /** Revenue-over-time bars: one per day for ranges up to two weeks, otherwise one per week. */
  const bars: ChartDatum[] = useMemo(() => {
    const live = period.filter(isLive);
    const dayCount = Math.round((fromIso(end).getTime() - fromIso(start).getTime()) / 86400000) + 1;
    if (dayCount <= 14) {
      const out: ChartDatum[] = [];
      for (let d = fromIso(start); toIso(d) <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        const iso = toIso(d);
        out.push({ label: fmtShortWeekday(iso), value: live.filter(o => o.deliveryDate === iso).reduce((s, o) => s + revenueOf(o), 0), color: colors.primary });
      }
      return out;
    }
    const weeks = new Map<number, number>();
    for (const o of live) {
      const week = Math.floor(fromIso(o.deliveryDate).getTime() / (7 * 86400000));
      weeks.set(week, (weeks.get(week) ?? 0) + revenueOf(o));
    }
    return [...weeks.keys()].sort((a, b) => a - b).map((k, i) => ({ label: `Wk ${i + 1}`, value: weeks.get(k)!, color: colors.primary }));
  }, [period, start, end, colors.primary]);
  const bestDay = [...bars].sort((a, b) => b.value - a.value)[0];

  /** Moves a dispute ticket between Investigating / Refunded / Resolved. */
  const resolveDispute = async (order: Order) => {
    const status = await alerts.actionSheet(`Update dispute ${order.disputeTicketRef}`, 'Cancel', 'Investigating', 'Refunded', 'Resolved');
    if (!status) return;
    try {
      await updateDisputeStatus(order.id, status as DisputeStatus);
      setOrders(list => list.map(o => (o.id === order.id ? { ...o, disputeStatus: status as DisputeStatus } : o)));
    } catch (err) {
      await alerts.show('Not Saved', (err as Error)?.message ?? 'Could not update this dispute.', 'OK');
    }
  };

  /** Custom-range date entry (a typed yyyy-mm-dd; anything else is ignored). */
  const pickDate = async (label: string, current: string, set: (iso: string) => void) => {
    const value = await alerts.prompt(label, 'Enter a date (yyyy-mm-dd):', { initialValue: current });
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) set(value.trim());
  };

  // ===================== Excel =====================

  const rangeText = start === end ? fmtDate(fromIso(start)) : `${fmtDate(fromIso(start))} – ${fmtDate(fromIso(end))}`;
  const filterDescription = `${timeframe} (${rangeText}) · ${companyFilter} · ${categoryFilter}`;

  /** One writer per worksheet; the workbooks below are just different selections of these. */
  const sheets = {
    summary: (x: XlsxWriter) => {
      const s = x.addSheet('Summary').widths(32, 16, 16, 12);
      s.header('Your Kitchen Co. — Reports', '', '', '');
      s.row('Filters', filterDescription);
      s.row('Compared with', `${fmtDate(fromIso(prevStart))} – ${fmtDate(fromIso(prevEnd))}`);
      s.row('Generated', fmtIssued(new Date().toISOString()));
      s.blank();
      s.header('Metric', 'This period', 'Previous', 'Change %');
      const rows: [string, number, number][] = [
        ['Revenue (R)', now.revenue, before.revenue],
        ['Paid by customers (R)', now.customerPaid, before.customerPaid],
        ['Subsidies billed to companies (R)', now.subsidies, before.subsidies],
        ['Discounts given (R)', now.discounts, before.discounts],
        ['Delivery fees (R)', now.deliveryFees, before.deliveryFees],
        ['Orders', now.orders, before.orders],
        ['Meals', now.meals, before.meals],
        ['Average order value (R)', now.aov, before.aov],
        ['Active customers', customers.active, customersBefore.active],
        ['Repeat rate (%)', customers.repeatRate, customersBefore.repeatRate],
      ];
      for (const [label, a, b] of rows) s.row(label, a, b, change(a, b));
      s.row('Cancelled orders (excluded)', now.cancelled, before.cancelled);
    },
    daily: (x: XlsxWriter) => {
      const s = x.addSheet('Revenue Over Time').widths(14, 14);
      s.header('Day / week', 'Revenue (R)');
      for (const b of bars) s.row(b.label, Math.round(b.value * 100) / 100);
    },
    companies: (x: XlsxWriter) => {
      const s = x.addSheet('Revenue by Company').widths(30, 10, 14, 44);
      s.header('Company', 'Orders', 'Revenue (R)', 'Subsidy / discount');
      for (const r of revenueByCompany) s.row(r.name, r.count, r.value, r.detail);
    },
    dishes: (x: XlsxWriter) => {
      const s = x.addSheet('Dishes').widths(36, 22, 10, 14, 12, 14, 10);
      s.header('Dish', 'Category', 'Meals', 'Revenue (R)', 'Avg price (R)', 'Menu matrix', 'Avg rating');
      for (const d of dishes) s.row(d.name, d.category, d.units, d.revenue, d.avgPrice, matrix.quadrant[d.name], d.avgRating);
      for (const d of bottomPerformers.filter(b => b.units === 0)) s.row(d.name, '', 0, 0, null, 'Not ordered', null);
    },
    mix: (x: XlsxWriter) => {
      const s = x.addSheet('Category Mix').widths(30, 10, 14, 10);
      s.header('Category', 'Meals', 'Revenue (R)', 'Share %');
      for (const r of mix) s.row(r.name, r.count, r.value, mixTotal ? Math.round((r.value / mixTotal) * 1000) / 10 : 0);
    },
    adoption: (x: XlsxWriter) => {
      const s = x.addSheet('Company Adoption').widths(30, 16, 14, 12, 14);
      s.header('Company', 'Staff registered', 'Staff ordering', 'Adoption %', 'Revenue (R)');
      for (const r of adoption) s.row(r.company, r.registered, r.ordering, r.rate, r.revenue);
    },
    customers: (x: XlsxWriter) => {
      const s = x.addSheet('Top Customers').widths(30, 28, 10, 14);
      s.header('Customer', 'Company', 'Orders', 'Revenue (R)');
      for (const r of top) s.row(r.name, r.detail, r.count, r.value);
    },
    demand: (x: XlsxWriter) => {
      const s = x.addSheet('Next 7 Days Demand').widths(18, 10, 10, 60);
      s.header('Delivery day', 'Meals', 'Orders', 'Top dishes');
      for (const d of demand) s.row(shortDay(d.date), d.meals, d.orders, d.topDishes);
    },
    timing: (x: XlsxWriter) => {
      const s = x.addSheet('Order Timing').widths(24, 12);
      s.header('Placed between (hours)', 'Orders');
      for (const h of hours) s.row(h.label, h.orders);
      s.blank();
      s.header('Lead time', 'Orders');
      for (const b of lead.buckets) s.row(b.name, b.count);
      s.row('Average (days)', lead.avg);
      s.blank();
      s.header('Delivery weekday', 'Meals');
      for (const w of weekdays) s.row(w.day, w.meals);
    },
    quality: (x: XlsxWriter) => {
      const s = x.addSheet('Ratings').widths(28, 12);
      s.header('Measure', 'Value');
      s.row('Average rating', q.avgRating);
      s.row('Delivered orders rated (%)', q.coverage);
      for (const d of q.distribution) s.row(`${d.stars} star`, d.count);
      s.row('Dispute rate (%)', q.disputeRate);
      s.row('Open disputes', q.openDisputes);
      const p = x.addSheet('Disputes').widths(14, 14, 24, 36, 40, 16, 18);
      p.header('Ticket', 'Order #', 'Customer', 'Item', 'Reason', 'Status', 'Reported');
      for (const o of disputed) p.row(o.disputeTicketRef, o.orderNumber, o.customerName, o.itemName, o.disputeReason, o.disputeStatus, o.disputeReportedAt ? fmtDate(o.disputeReportedAt) : '');
    },
    orders: (x: XlsxWriter) => {
      // One row per dish; the order's money sits on its first row so columns still sum correctly.
      const s = x.addSheet('All Orders').widths(14, 18, 24, 28, 36, 8, 22, 14, 14, 12, 12, 12);
      s.header('Order #', 'Ordered', 'Customer', 'Company', 'Dish', 'Qty', 'Category', 'Delivery', 'Status', 'Paid (R)', 'Subsidy (R)', 'Discount (R)');
      for (const o of [...period].sort((a, b) => a.orderDate.localeCompare(b.orderDate)))
        o.lines.forEach((l, i) =>
          s.row(
            o.orderNumber,
            fmtIssued(o.orderDate),
            o.customerName,
            companyName(o.companyId),
            l.name,
            l.quantity,
            l.category,
            shortDay(o.deliveryDate),
            o.status,
            i === 0 ? o.totalAmount : null,
            i === 0 ? o.subsidyAmount : null,
            i === 0 ? o.discountAmount : null
          )
        );
    },
  };

  /** [menu label, file name, sheets] for each choice in the Export sheet. */
  const WORKBOOKS: [string, string, (keyof typeof sheets)[]][] = [
    ['📊 Everything (one workbook)', 'All_Reports', ['summary', 'daily', 'companies', 'dishes', 'mix', 'adoption', 'customers', 'demand', 'timing', 'quality', 'orders']],
    ['Sales', 'Sales', ['summary', 'daily', 'companies']],
    ['Menu', 'Menu', ['dishes', 'mix']],
    ['Customers', 'Customers', ['adoption', 'customers']],
    ['Kitchen & quality', 'Kitchen', ['demand', 'timing', 'quality']],
    ['All orders (line by line)', 'All_Orders', ['orders']],
  ];

  const openExport = async () => {
    const choice = await alerts.actionSheet(`Download as Excel\n${filterDescription}`, 'Cancel', ...WORKBOOKS.map(w => w[0]));
    const book = WORKBOOKS.find(w => w[0] === choice);
    if (!book) return;
    try {
      const x = new XlsxWriter();
      for (const key of book[2]) sheets[key](x);
      await shareXlsx(`${book[1]}_${start}_to_${end}`, x, book[1].replace(/_/g, ' '));
    } catch (err) {
      await alerts.show('Export Failed', (err as Error)?.message ?? 'The workbook could not be created.', 'OK');
    }
  };

  // ===================== Rendering =====================

  /** "▲ 12% vs previous" line under a KPI, coloured by direction. */
  const delta = (current: number, prev: number) => {
    const c = change(current, prev);
    if (c === null) return { text: 'new vs previous period', color: colors.mutedText };
    if (c === 0) return { text: 'no change vs previous', color: colors.mutedText };
    return { text: `${c > 0 ? '▲' : '▼'} ${Math.abs(c)}% vs previous`, color: c > 0 ? colors.success : colors.error };
  };

  /** KPI card: label, big value, optional change line and help text. */
  const kpi = (label: string, value: string, d?: { text: string; color: string }, help?: string) => (
    <Card radius={12} padding={14} style={styles.kpi}>
      <Text style={[styles.kpiLabel, { color: colors.mutedText }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.kpiValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      {d && (
        <Text style={[styles.kpiDelta, { color: d.color }]} numberOfLines={1}>
          {d.text}
        </Text>
      )}
      {!!help && (
        <Text style={[styles.kpiDelta, { color: colors.mutedText }]} numberOfLines={2}>
          {help}
        </Text>
      )}
    </Card>
  );

  /** Titled card that wraps each chart / list. */
  const section = (title: string, subtitle: string | null, children: React.ReactNode) => (
    <Card radius={14} padding={16} border={colors.surfaceBorder}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      {children}
    </Card>
  );

  const barList = (rows: React.ComponentProps<typeof BarList>['rows'], color = colors.primary, max?: number, emptyText?: string) => (
    <BarList rows={rows} color={color} trackColor={colors.chipBg} textColor={colors.text} mutedColor={colors.mutedText} max={max} emptyText={emptyText} />
  );

  const insight = (text: string) => <Text style={[styles.insight, { color: colors.textSecondary }]}>💡 {text}</Text>;

  // ── Tab contents ──

  const salesTab = (
    <>
      <View style={styles.kpis}>
        {kpi('Revenue', rand(now.revenue), delta(now.revenue, before.revenue))}
        {kpi('Orders', String(now.orders), delta(now.orders, before.orders))}
        {kpi('Meals', String(now.meals), delta(now.meals, before.meals), `${now.mealsPerOrder} per order`)}
        {kpi('Avg order value', rand(now.aov), delta(now.aov, before.aov))}
      </View>

      {section(
        'Where the revenue comes from',
        'Revenue = what customers paid + meal subsidies billed to their companies.',
        <>
          {barList(
            [
              { label: 'Paid by customers', value: now.customerPaid, display: rand(now.customerPaid), sub: `incl. ${rand(now.deliveryFees)} delivery fees` },
              { label: 'Subsidies billed to companies', value: now.subsidies, display: rand(now.subsidies) },
            ],
            colors.primary,
            now.revenue || 1
          )}
          <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Discounts given away</Text>
            <Text style={[styles.statValue, { color: colors.error }]}>{rand(now.discounts)}</Text>
          </View>
          {now.cancelled > 0 && (
            <View style={styles.statRow}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Cancelled orders (left out)</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{now.cancelled}</Text>
            </View>
          )}
        </>
      )}

      {section(
        'Revenue over time',
        `By delivery day · ${rangeText}`,
        <>
          <BarChart bars={bars} labelColor={colors.mutedText} height={190} />
          {bestDay && bestDay.value > 0 && insight(`Best ${bars.length > 14 ? 'week' : 'day'}: ${bestDay.label}, ${rand(bestDay.value)}.`)}
        </>
      )}

      {section(
        'Revenue by company',
        'Which accounts carry the business',
        barList(revenueByCompany.map(r => ({ label: r.name, value: r.value, display: rand(r.value), sub: `${r.count} ${r.count === 1 ? 'order' : 'orders'} · ${r.detail}` })))
      )}
    </>
  );

  const quadrantColor: Record<string, string> = { Stars: colors.success, Workhorses: colors.primary, Puzzles: '#B45309', Dogs: colors.error };

  const menuTab = (
    <>
      {section(
        'Menu engineering',
        `Popular = ${matrix.popularityLine}+ meals · premium = above the ${rand(matrix.priceLine)} average price`,
        dishes.length === 0 ? (
          <Text style={[styles.sectionSub, { color: colors.mutedText }]}>No sales in this range.</Text>
        ) : (
          <View style={styles.quadGrid}>
            {QUADRANTS.map(qd => {
              const list = dishes.filter(d => matrix.quadrant[d.name] === qd.key);
              return (
                <View key={qd.key} style={[styles.quad, { backgroundColor: colors.chipBg, borderLeftColor: quadrantColor[qd.key] }]}>
                  <Text style={[styles.quadTitle, { color: colors.text }]}>
                    {qd.emoji} {qd.key} <Text style={{ color: colors.mutedText }}>({list.length})</Text>
                  </Text>
                  <Text style={[styles.quadHint, { color: colors.textSecondary }]}>{qd.hint}</Text>
                  {list.slice(0, 3).map(d => (
                    <Text key={d.name} style={[styles.quadItem, { color: colors.text }]} numberOfLines={1}>
                      • {d.name}
                    </Text>
                  ))}
                  {list.length > 3 && <Text style={[styles.quadHint, { color: colors.mutedText }]}>+{list.length - 3} more in the export</Text>}
                </View>
              );
            })}
          </View>
        )
      )}

      {section(
        'Category mix',
        'Share of food revenue',
        barList(
          mix.map(r => ({
            label: r.name,
            value: r.value,
            display: `${mixTotal ? Math.round((r.value / mixTotal) * 100) : 0}%`,
            sub: `${r.count} meals · ${rand(r.value)}`,
          }))
        )
      )}

      {section(
        'Top 10 best sellers',
        'By meals sold',
        barList(
          topPerformers.map(d => ({ label: d.name, value: d.units, display: `${d.units} sold`, sub: `${rand(d.revenue)}${d.avgRating != null ? ` · ★ ${d.avgRating} (${d.ratings} ${d.ratings === 1 ? 'rating' : 'ratings'})` : ''}` })),
          colors.success,
          undefined,
          'No sales in this range.'
        )
      )}

      {section(
        'Bottom 10',
        'Not ordered at all first, then the slowest sellers',
        barList(
          bottomPerformers.map(d => ({
            label: d.name,
            value: d.units,
            display: d.units === 0 ? 'none' : `${d.units} sold`,
            sub: d.units === 0 ? 'Not ordered in this range' : rand(d.revenue),
          })),
          colors.error,
          Math.max(...dishes.map(d => d.units), 1),
          'Nothing to show for this range.'
        )
      )}
    </>
  );

  const customersTab = (
    <>
      <View style={styles.kpis}>
        {kpi('Active customers', String(customers.active), delta(customers.active, customersBefore.active))}
        {kpi('New customers', String(customers.newCustomers), undefined, `${customers.returning} returning`)}
        {kpi('Repeat rate', pct(customers.repeatRate), undefined, 'ordered 2+ times in the period')}
        {kpi('Revenue / customer', rand(customers.revenuePerCustomer), undefined, `${customers.ordersPerCustomer} orders each`)}
      </View>

      {section(
        'Company adoption',
        'Share of each company’s registered staff who ordered — the health of a corporate account',
        <>
          {barList(
            adoption.map(r => ({ label: r.company, value: r.rate, display: pct(r.rate), sub: `${r.ordering} of ${r.registered} staff · ${rand(r.revenue)}` })),
            colors.brandGold,
            100
          )}
          {lowAdoption.length > 0 &&
            insight(`Under 30% at ${lowAdoption.map(r => r.company).join(', ')} — worth a reminder broadcast or a tasting.`)}
        </>
      )}

      {section(
        'Top customers',
        'By revenue in the period',
        barList(top.map(r => ({ label: r.name, value: r.value, display: rand(r.value), sub: `${r.detail} · ${r.count} ${r.count === 1 ? 'order' : 'orders'}` })))
      )}
    </>
  );

  const kitchenTab = (
    <>
      {section(
        'Next 7 days — committed demand',
        'Already ordered, by delivery day (ignores the date filter)',
        barList(
          demand.map(d => ({ label: fmtDayLabel(d.date), value: d.meals, display: `${d.meals} meals`, sub: d.topDishes })),
          colors.primary,
          undefined,
          'Nothing ordered for the next 7 days yet.'
        )
      )}

      {section(
        'When orders come in',
        'Orders by the hour they were placed',
        <>
          <BarChart bars={hours.map(h => ({ label: h.label, value: h.orders, color: colors.brandGold }))} labelColor={colors.mutedText} height={170} />
          {busiestHour && busiestHour.orders > 0 && insight(`Busiest window: ${busiestHour.label}h — a good time to send reminder broadcasts.`)}
        </>
      )}

      {section(
        'How far ahead people order',
        `Average lead time ${lead.avg} days (minimum is 2 business days)`,
        barList(
          lead.buckets.map(b => ({ label: b.name, value: b.count, display: leadTotal ? pct(Math.round((b.count / leadTotal) * 100)) : '0%' })),
          colors.brandGold
        )
      )}

      {section(
        'Demand by weekday',
        'Meals per delivery day of the week',
        <BarChart bars={weekdays.map(w => ({ label: w.day, value: w.meals, color: colors.primary }))} labelColor={colors.mutedText} height={160} />
      )}

      {section(
        'Ratings',
        q.avgRating == null ? 'No ratings in this range' : `★ ${q.avgRating} average · ${q.coverage}% of delivered orders rated`,
        <>
          {barList(
            q.distribution.map(d => ({ label: '★'.repeat(d.stars), value: d.count, display: String(d.count) })),
            colors.primary
          )}
          {lowestRated.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />
              <Text style={[styles.subHeading, { color: colors.text }]}>Lowest-rated dishes ({MIN_RATINGS}+ ratings)</Text>
              {lowestRated.map(d => (
                <View key={d.name} style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                    {d.name}
                  </Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    ★ {d.avgRating} <Text style={{ color: colors.mutedText }}>({d.ratings})</Text>
                  </Text>
                </View>
              ))}
            </>
          )}
        </>
      )}

      {section(
        'Disputes',
        `${q.disputeRate}% of orders in this range were disputed · ${openDisputes} open overall (listed first)`,
        disputed.length === 0 ? (
          <Text style={[styles.sectionSub, { color: colors.mutedText }]}>No disputes logged.</Text>
        ) : (
          <View style={styles.stack10}>
            {disputed.map(order => (
              <View key={order.id} style={[styles.dispute, { borderColor: colors.surfaceBorder }]}>
                <View style={styles.statRow}>
                  <Text style={[styles.ticket, { color: colors.text }]}>{order.disputeTicketRef}</Text>
                  <View style={styles.disputeChip}>
                    <Text style={styles.disputeText}>{order.disputeStatus}</Text>
                  </View>
                </View>
                <Text style={[styles.small, { color: colors.textSecondary }]}>{order.itemName}</Text>
                <Text style={[styles.reason, { color: colors.text }]}>{order.disputeReason}</Text>
                <Text style={[styles.small, { color: colors.textSecondary }]}>Reported by {order.customerName}</Text>
                <Btn title="Update Status" onPress={() => resolveDispute(order)} fontSize={11} height={34} paddingH={14} style={styles.selfStart} />
              </View>
            ))}
          </View>
        )
      )}
    </>
  );

  return (
    <Page>
      <AdminNavStrip activeRoute="adminreports" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.filters}>
          <View style={styles.pair}>
            <LabeledPicker label="Date range" title="Select Range" options={TIMEFRAMES} selected={timeframe} onSelect={setTimeframe} />
            <LabeledPicker
              label="Company"
              title="Filter Company"
              options={[ALL_COMPANIES, ...companies.map(c => c.name)]}
              selected={companyFilter}
              onSelect={setCompanyFilter}
            />
          </View>
          {timeframe === 'Custom Range' && (
            <View style={styles.pair}>
              <Pressable style={styles.flex} onPress={() => pickDate('From', customStart, setCustomStart)}>
                <Text style={[styles.dateLabel, { color: colors.brandGold }]}>From</Text>
                <Text style={[styles.dateValue, { color: colors.text, borderBottomColor: colors.placeholder }]}>{fmtDate(fromIso(customStart))}</Text>
              </Pressable>
              <Pressable style={styles.flex} onPress={() => pickDate('To', customEnd, setCustomEnd)}>
                <Text style={[styles.dateLabel, { color: colors.brandGold }]}>To</Text>
                <Text style={[styles.dateValue, { color: colors.text, borderBottomColor: colors.placeholder }]}>{fmtDate(fromIso(customEnd))}</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.pair}>
            <Picker title="Filter Category" options={categories} selected={categoryFilter} onSelect={setCategoryFilter} style={styles.flex} />
            <Btn title="⬇  Export" onPress={openExport} bold fontSize={13} height={40} radius={20} paddingH={16} />
          </View>
          <Text style={[styles.periodNote, { color: colors.mutedText }]}>
            {rangeText} · compared with {fmtDate(fromIso(prevStart))} – {fmtDate(fromIso(prevEnd))}
          </Text>
        </View>

        <View style={[styles.tabs, { backgroundColor: colors.chipBg }]}>
          {TABS.map(t => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              aria-selected={tab === t}
              style={[styles.tab, tab === t && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.tabText, { color: tab === t ? colors.onPrimary : colors.mutedText }]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'Sales' ? salesTab : tab === 'Menu' ? menuTab : tab === 'Customers' ? customersTab : kitchenTab}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  filters: { gap: 10 },
  pair: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  dateLabel: { fontSize: 11, fontWeight: '700' },
  dateValue: { fontSize: 14, borderBottomWidth: 1, paddingVertical: 8 },
  periodNote: { fontSize: 11 },
  tabs: { flexDirection: 'row', borderRadius: 22, padding: 4, height: 44 },
  tab: { flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 12, fontWeight: '700' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  kpi: { width: '48.5%', gap: 3 },
  kpiLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValue: { fontSize: 21, fontWeight: '700' },
  kpiDelta: { fontSize: 11, fontWeight: '600' },
  sectionHead: { gap: 3, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionSub: { fontSize: 12 },
  subHeading: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  insight: { fontSize: 12, marginTop: 10 },
  divider: { height: 1, marginVertical: 12 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 3 },
  statLabel: { flex: 1, fontSize: 13 },
  statValue: { fontSize: 13, fontWeight: '700' },
  quadGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  quad: { width: '48.5%', borderRadius: 12, borderLeftWidth: 4, padding: 10, gap: 3 },
  quadTitle: { fontSize: 13, fontWeight: '700' },
  quadHint: { fontSize: 10, marginBottom: 2 },
  quadItem: { fontSize: 12 },
  stack10: { gap: 10 },
  dispute: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 5 },
  ticket: { flex: 1, fontSize: 13, fontWeight: '700' },
  disputeChip: { backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  disputeText: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  small: { fontSize: 12 },
  reason: { fontSize: 13 },
  selfStart: { alignSelf: 'flex-start' },
});

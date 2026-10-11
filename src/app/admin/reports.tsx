/**
 * AdminReportsPage.xaml + AdminReportsViewModel — "Reports & Analytics".
 *
 * Everything follows the range / company / category filters: the metric
 * cards, the two charts, Top 10 / Bottom 10, the collapsible "More Reports"
 * (by company, category, delivery day, top customers, subsidy & discount
 * costs) and every Excel download (one report, or all in one workbook,
 * each with a Summary sheet first).
 *
 * MAUI orders are one dish each; here an order can hold several lines, so
 * the per-dish reports count order lines (units = line quantity).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { BarChart, ChartDatum, DonutChart } from '../../components/Charts';
import { Btn, Card, Page, Picker } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { getCompanies } from '../../services/directory';
import { getAllOrders, updateDisputeStatus } from '../../services/orders';
import { getStaticProducts } from '../../services/catalog';
import { fmtDate, fmtShortWeekday, fmtWeekday, fromIso, toIso } from '../../services/scheduling';
import { fmtIssued, shareXlsx, XlsxWriter } from '../../services/export';
import { hasDispute } from '../../models';
import type { Company, DisputeStatus, Order } from '../../models';

const PALETTE = ['#AF1718', '#DA5D23', '#F7F2E8', '#C9DE87', '#121212', '#B6DFF8'];
const TIMEFRAMES = ['Today', 'This Week', 'This Month', 'Custom Range'];
const ALL_COMPANIES = 'All Companies';
const ALL_CATEGORIES = 'All Categories';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface SalesItemSummary {
  itemName: string;
  unitsSold: number;
  totalRevenue: number;
  swatchColor: string;
}

/** "name · count · amount" row used by the extra reports. */
interface NameValueRow {
  name: string;
  count: number;
  amount: number;
  detail: string;
}

const REPORTS = [
  'Top Performers',
  'Bottom Performers',
  'Revenue by Company',
  'Revenue by Category',
  'Orders by Delivery Day',
  'Top Customers',
  'Company Benefit Costs',
  'All Orders',
  'Disputes',
] as const;
type Report = (typeof REPORTS)[number];

const EXPORT_BUTTONS: [string, Report][] = [
  ['Top 10', 'Top Performers'],
  ['Bottom 10', 'Bottom Performers'],
  ['By Company', 'Revenue by Company'],
  ['By Category', 'Revenue by Category'],
  ['By Delivery Day', 'Orders by Delivery Day'],
  ['Top Customers', 'Top Customers'],
  ['Subsidy Costs', 'Company Benefit Costs'],
  ['All Orders', 'All Orders'],
  ['Disputes', 'Disputes'],
];

function resolveRange(timeframe: string, customStart: string, customEnd: string): [string, string] {
  const today = new Date();
  const iso = toIso(today);
  switch (timeframe) {
    case 'Today':
      return [iso, iso];
    case 'This Month':
      return [toIso(new Date(today.getFullYear(), today.getMonth(), 1)), toIso(new Date(today.getFullYear(), today.getMonth() + 1, 0))];
    case 'Custom Range':
      return customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart];
    default: {
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
      return [toIso(monday), toIso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6))];
    }
  }
}

/** "ddd dd MMM" / "ddd dd MMM yyyy" */
function fmtShortDay(iso: string, withYear = false): string {
  const d = fromIso(iso);
  return `${fmtShortWeekday(iso)} ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

const sumBy = <T,>(items: T[], f: (t: T) => number) => items.reduce((s, t) => s + f(t), 0);

function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return [...map.entries()];
}

export default function AdminReportsScreen() {
  const { colors } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [menuItemNames, setMenuItemNames] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState('This Week');
  const [companyFilter, setCompanyFilter] = useState(ALL_COMPANIES);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [customStart, setCustomStart] = useState(() => toIso(new Date(Date.now() - 7 * 86400000)));
  const [customEnd, setCustomEnd] = useState(() => toIso(new Date()));
  const [extraExpanded, setExtraExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getAllOrders(), getCompanies()])
        .then(([loadedOrders, loadedCompanies]) => {
          setOrders(loadedOrders);
          setCompanies(loadedCompanies);
        })
        .catch(err => alerts.show('Could Not Load', (err as Error)?.message ?? 'Check your connection and try again.', 'OK'));
      // Menu names so "worst performers" can include dishes that never sold at all.
      getStaticProducts()
        .then(products => setMenuItemNames([...new Set(products.map(p => p.name).filter(n => n.trim()))]))
        .catch(() => setMenuItemNames([]));
    }, [])
  );

  const categories = useMemo(
    () => [ALL_CATEGORIES, ...[...new Set(orders.flatMap(o => o.lines.map(l => l.category)).filter(Boolean))].sort()],
    [orders]
  );

  const [start, end] = resolveRange(timeframe, customStart, customEnd);
  const companyName = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);
  const companyOf = useCallback((o: Order) => companyName.get(o.companyId) ?? 'Unassigned', [companyName]);

  const filtered = useMemo(
    () =>
      orders.filter(
        o =>
          o.deliveryDate >= start &&
          o.deliveryDate <= end &&
          (companyFilter === ALL_COMPANIES || companyName.get(o.companyId) === companyFilter) &&
          (categoryFilter === ALL_CATEGORIES || o.lines.some(l => l.category === categoryFilter))
      ),
    [orders, start, end, companyFilter, categoryFilter, companyName]
  );

  /** Order lines in range (category filter applies per line). */
  const lines = useMemo(
    () => filtered.flatMap(o => o.lines.filter(l => categoryFilter === ALL_CATEGORIES || l.category === categoryFilter).map(line => ({ order: o, line }))),
    [filtered, categoryFilter]
  );

  const totalRevenue = sumBy(filtered, o => o.totalAmount);
  const totalOrders = filtered.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const grouped: SalesItemSummary[] = useMemo(
    () =>
      groupBy(lines, x => x.line.name)
        .map(([itemName, xs]) => ({
          itemName,
          unitsSold: sumBy(xs, x => x.line.quantity),
          totalRevenue: sumBy(xs, x => x.line.unitPrice * x.line.quantity),
          swatchColor: '',
        }))
        .sort((a, b) => b.unitsSold - a.unitsSold || b.totalRevenue - a.totalRevenue)
        .map((s, i) => ({ ...s, swatchColor: PALETTE[i % PALETTE.length] })),
    [lines]
  );
  const topSellingItem = grouped[0]?.itemName ?? '—';

  const topFive = grouped.slice(0, 5);
  const otherRevenue = sumBy(grouped.slice(5), s => s.totalRevenue);
  const slices: ChartDatum[] = [
    ...topFive.map(s => ({ label: s.itemName, value: s.totalRevenue, color: s.swatchColor })),
    ...(otherRevenue > 0 ? [{ label: 'Other', value: otherRevenue, color: 'gray' }] : []),
  ];

  const bars: ChartDatum[] = useMemo(() => {
    const dayCount = Math.round((fromIso(end).getTime() - fromIso(start).getTime()) / 86400000) + 1;
    if (dayCount <= 14) {
      const out: ChartDatum[] = [];
      for (let d = fromIso(start); toIso(d) <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        const iso = toIso(d);
        out.push({ label: fmtShortWeekday(iso), value: sumBy(filtered.filter(o => o.deliveryDate === iso), o => o.totalAmount), color: PALETTE[0] });
      }
      return out;
    }
    const weeks = new Map<number, number>();
    for (const o of filtered) {
      const week = Math.floor(fromIso(o.deliveryDate).getTime() / (7 * 86400000));
      weeks.set(week, (weeks.get(week) ?? 0) + o.totalAmount);
    }
    return [...weeks.keys()].sort((a, b) => a - b).map((k, i) => ({ label: `Wk ${i + 1}`, value: weeks.get(k)!, color: PALETTE[0] }));
  }, [filtered, start, end]);

  // ----- Top 10 / bottom 10 (units per dish) -----
  const topPerformers = grouped.slice(0, 10);
  const bottomPerformers: SalesItemSummary[] = useMemo(() => {
    const sold = new Set(grouped.map(g => g.itemName));
    const neverSold = menuItemNames.filter(n => !sold.has(n)).map(n => ({ itemName: n, unitsSold: 0, totalRevenue: 0, swatchColor: '' }));
    // With a small menu the two lists would overlap; a best seller is never also listed as a worst one.
    const best = new Set(grouped.slice(0, 10).map(g => g.itemName));
    const lowest = [...grouped].filter(g => !best.has(g.itemName)).sort((a, b) => a.unitsSold - b.unitsSold || a.totalRevenue - b.totalRevenue);
    return [...neverSold, ...lowest].slice(0, 10);
  }, [grouped, menuItemNames]);

  // ----- More Reports -----
  const revenueByCompany: NameValueRow[] = useMemo(
    () =>
      groupBy(filtered, companyOf)
        .map(([name, os]) => ({ name, count: os.length, amount: sumBy(os, o => o.totalAmount), detail: '' }))
        .sort((a, b) => b.amount - a.amount),
    [filtered, companyOf]
  );
  const revenueByCategory: NameValueRow[] = useMemo(
    () =>
      groupBy(lines, x => x.line.category || 'Uncategorised')
        .map(([name, xs]) => ({
          name,
          count: new Set(xs.map(x => x.order.id)).size,
          amount: sumBy(xs, x => x.line.unitPrice * x.line.quantity),
          detail: '',
        }))
        .sort((a, b) => b.amount - a.amount),
    [lines]
  );
  const ordersByDeliveryDay: NameValueRow[] = useMemo(
    () =>
      groupBy(filtered, o => o.deliveryDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, os]) => ({
          name: fmtShortDay(date),
          count: sumBy(os, o => sumBy(o.lines, l => l.quantity)),
          amount: sumBy(os, o => o.totalAmount),
          detail: fmtWeekday(date),
        })),
    [filtered]
  );
  const topCustomers: NameValueRow[] = useMemo(
    () =>
      groupBy(filtered, o => o.customerName.trim() || 'Unknown')
        .map(([name, os]) => ({ name, count: os.length, amount: sumBy(os, o => o.totalAmount), detail: companyName.get(os[0].companyId) ?? '' }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10),
    [filtered, companyName]
  );
  const companyBenefitCosts: NameValueRow[] = useMemo(
    () =>
      groupBy(filtered, companyOf)
        .map(([name, os]) => {
          const subsidy = sumBy(os, o => o.subsidyAmount);
          const discount = sumBy(os, o => o.discountAmount);
          return { name, count: os.length, amount: subsidy + discount, detail: `subsidy R${subsidy.toFixed(2)} · discount R${discount.toFixed(2)}` };
        })
        .sort((a, b) => b.amount - a.amount),
    [filtered, companyOf]
  );

  const disputed = useMemo(
    () => orders.filter(hasDispute).sort((a, b) => (b.disputeReportedAt ?? '').localeCompare(a.disputeReportedAt ?? '')),
    [orders]
  );

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

  const pickDate = async (label: string, current: string, set: (iso: string) => void) => {
    const value = await alerts.prompt(label, 'Enter a date (yyyy-mm-dd):', { initialValue: current });
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) set(value.trim());
  };

  // ===================== Excel downloads =====================

  const filterDescription = () => {
    const range = start === end ? fmtShortDay(start, true) : `${fmtDate(fromIso(start))} – ${fmtDate(fromIso(end))}`;
    return `${timeframe} (${range}) · ${companyFilter}`;
  };
  const fileStamp = () => `${start}_to_${end}`;
  const generated = () => fmtIssued(new Date().toISOString());

  const fillSheet = (xlsx: XlsxWriter, report: Report) => {
    switch (report) {
      case 'Top Performers': {
        const t = xlsx.addSheet('Top 10 Performers').widths(40, 12, 14);
        t.header('Dish', 'Units Sold', 'Revenue (R)');
        for (const r of topPerformers) t.row(r.itemName, r.unitsSold, r.totalRevenue);
        break;
      }
      case 'Bottom Performers': {
        const b = xlsx.addSheet('Bottom 10 Performers').widths(40, 12, 14);
        b.header('Dish', 'Units Sold', 'Revenue (R)');
        for (const r of bottomPerformers) b.row(r.itemName, r.unitsSold, r.totalRevenue);
        break;
      }
      case 'Revenue by Company': {
        const c = xlsx.addSheet('Revenue by Company').widths(32, 12, 14);
        c.header('Company', 'Orders', 'Revenue (R)');
        for (const r of revenueByCompany) c.row(r.name, r.count, r.amount);
        c.blank();
        c.row('Total', sumBy(revenueByCompany, r => r.count), sumBy(revenueByCompany, r => r.amount));
        break;
      }
      case 'Revenue by Category': {
        const k = xlsx.addSheet('Revenue by Category').widths(32, 12, 14);
        k.header('Category', 'Orders', 'Revenue (R)');
        for (const r of revenueByCategory) k.row(r.name, r.count, r.amount);
        break;
      }
      case 'Orders by Delivery Day': {
        const d = xlsx.addSheet('Orders by Delivery Day').widths(16, 14, 10, 14);
        d.header('Delivery Date', 'Weekday', 'Meals', 'Revenue (R)');
        for (const r of ordersByDeliveryDay) d.row(r.name, r.detail, r.count, r.amount);
        break;
      }
      case 'Top Customers': {
        const u = xlsx.addSheet('Top Customers').widths(30, 28, 10, 14);
        u.header('Customer', 'Company', 'Orders', 'Spend (R)');
        for (const r of topCustomers) u.row(r.name, r.detail, r.count, r.amount);
        break;
      }
      case 'Company Benefit Costs': {
        const s = xlsx.addSheet('Subsidy & Discount Costs').widths(30, 10, 16, 40);
        s.header('Company', 'Orders', 'Total Cost (R)', 'Breakdown');
        for (const r of companyBenefitCosts) s.row(r.name, r.count, r.amount, r.detail);
        break;
      }
      case 'All Orders': {
        // One row per dish; the order's money sits on its first row so columns still sum correctly.
        const o = xlsx.addSheet('All Orders').widths(14, 18, 24, 28, 36, 8, 22, 14, 14, 12, 12, 12);
        o.header('Order #', 'Ordered', 'Customer', 'Company', 'Dish', 'Qty', 'Category', 'Delivery', 'Status', 'Total (R)', 'Subsidy (R)', 'Discount (R)');
        for (const x of [...filtered].sort((a, b) => a.orderDate.localeCompare(b.orderDate))) {
          x.lines.forEach((line, i) => {
            o.row(
              x.orderNumber,
              fmtIssued(x.orderDate),
              x.customerName,
              companyName.get(x.companyId) ?? '',
              line.name,
              line.quantity,
              line.category,
              fmtShortDay(x.deliveryDate, true),
              x.status,
              i === 0 ? x.totalAmount : null,
              i === 0 ? x.subsidyAmount : null,
              i === 0 ? x.discountAmount : null
            );
          });
        }
        break;
      }
      case 'Disputes': {
        const p = xlsx.addSheet('Disputes').widths(14, 14, 24, 36, 40, 16, 18);
        p.header('Ticket', 'Order #', 'Customer', 'Item', 'Reason', 'Status', 'Reported');
        for (const x of disputed)
          p.row(x.disputeTicketRef, x.orderNumber, x.customerName, x.itemName, x.disputeReason, x.disputeStatus, x.disputeReportedAt ? fmtDate(x.disputeReportedAt) : '');
        break;
      }
    }
  };

  const exportReport = async (report: Report) => {
    try {
      const xlsx = new XlsxWriter();
      const summary = xlsx.addSheet('Summary').widths(28, 40);
      summary.header('Report', report);
      summary.row('Filters', filterDescription());
      summary.row('Generated', generated());
      summary.row('Orders in range', totalOrders);
      summary.row('Revenue in range (R)', totalRevenue);
      fillSheet(xlsx, report);
      await shareXlsx(`${report.replace(/ /g, '_')}_${fileStamp()}`, xlsx, report);
    } catch (err) {
      await alerts.show('Export Failed', (err as Error)?.message ?? 'The workbook could not be created.', 'OK');
    }
  };

  const exportAll = async () => {
    try {
      const xlsx = new XlsxWriter();
      const summary = xlsx.addSheet('Summary').widths(28, 40);
      summary.header('Your Kitchen Co. — Reports', '');
      summary.row('Filters', filterDescription());
      summary.row('Generated', generated());
      summary.row('Orders in range', totalOrders);
      summary.row('Revenue in range (R)', totalRevenue);
      summary.row('Average order value (R)', averageOrderValue);
      summary.row('Top seller', topSellingItem);
      for (const r of REPORTS) fillSheet(xlsx, r);
      await shareXlsx(`All_Reports_${fileStamp()}`, xlsx, 'All Reports');
    } catch (err) {
      await alerts.show('Export Failed', (err as Error)?.message ?? 'The workbook could not be created.', 'OK');
    }
  };

  // ===================== Rendering =====================

  const metric = (label: string, value: string, valueColor = colors.text, small = false) => (
    <Card radius={12} style={styles.metric}>
      <Text style={[styles.metricLabel, { color: colors.mutedText }]}>{label}</Text>
      <Text style={[small ? styles.metricValueSmall : styles.metricValue, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
    </Card>
  );

  const performerList = (items: SalesItemSummary[], revenueColor: string, emptyText: string) =>
    items.length === 0 ? (
      <Text style={[styles.small, { color: colors.textSecondary }]}>{emptyText}</Text>
    ) : (
      <View style={styles.stack8}>
        {items.map(s => (
          <Card key={s.itemName} radius={10} padding={12}>
            <View style={styles.performerRow}>
              <Text style={[styles.performerName, { color: colors.text }]} numberOfLines={1}>
                {s.itemName}
              </Text>
              <Text style={[styles.performerUnits, { color: colors.mutedText }]}>{s.unitsSold} sold</Text>
              <Text style={[styles.performerRevenue, { color: revenueColor }]}>R{s.totalRevenue.toFixed(2)}</Text>
            </View>
          </Card>
        ))}
      </View>
    );

  const nameValueList = (title: string, rows: NameValueRow[], countNoun: string | null) => (
    <View style={styles.stack4}>
      <Text style={[styles.subHeading, { color: colors.text }]}>{title}</Text>
      {rows.map(r => (
        <View key={r.name} style={styles.nvRow}>
          <View style={styles.flex}>
            <Text style={[styles.nvName, { color: colors.text }]}>{r.name}</Text>
            {!!r.detail && countNoun !== 'meals' && <Text style={[styles.nvDetail, { color: colors.mutedText }]}>{r.detail}</Text>}
          </View>
          {countNoun && <Text style={[styles.nvCount, { color: colors.mutedText }]}>{`${r.count} ${countNoun}`}</Text>}
          <Text style={[styles.nvAmount, { color: colors.brandGold }]}>R{r.amount.toFixed(2)}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <Page>
      <AdminNavStrip activeRoute="adminreports" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.filters}>
          <View style={styles.pair}>
            <Picker title="Select Range" options={TIMEFRAMES} selected={timeframe} onSelect={setTimeframe} style={styles.flex} />
            <Picker title="Filter Company" options={[ALL_COMPANIES, ...companies.map(c => c.name)]} selected={companyFilter} onSelect={setCompanyFilter} style={styles.flex} />
          </View>
          <Picker title="Filter Category" options={categories} selected={categoryFilter} onSelect={setCategoryFilter} />
          {timeframe === 'Custom Range' && (
            <View style={styles.pair}>
              <Pressable style={styles.flex} onPress={() => pickDate('From', customStart, setCustomStart)}>
                <Text style={[styles.dateLabel, { color: colors.mutedText }]}>From</Text>
                <Text style={[styles.dateValue, { color: colors.text, borderBottomColor: colors.placeholder }]}>{fmtDate(fromIso(customStart))}</Text>
              </Pressable>
              <Pressable style={styles.flex} onPress={() => pickDate('To', customEnd, setCustomEnd)}>
                <Text style={[styles.dateLabel, { color: colors.mutedText }]}>To</Text>
                <Text style={[styles.dateValue, { color: colors.text, borderBottomColor: colors.placeholder }]}>{fmtDate(fromIso(customEnd))}</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.metrics}>
          {metric('Total Sales', `R${totalRevenue.toFixed(2)}`, colors.brandGold)}
          {metric('Orders Completed', String(totalOrders))}
          {metric('Avg. Order Value', `R${averageOrderValue.toFixed(2)}`)}
          {metric('Top Item', topSellingItem, colors.text, true)}
        </View>

        <Text style={[styles.heading, { color: colors.text }]}>Revenue Over Time</Text>
        <Card radius={12} padding={12}>
          <BarChart bars={bars} labelColor="gray" />
        </Card>

        <Text style={[styles.heading, { color: colors.text }]}>Revenue Share by Item</Text>
        <Card radius={12} padding={12}>
          <View style={styles.donutRow}>
            <View style={styles.donut}>
              <DonutChart slices={slices} holeColor={colors.cardBg} />
            </View>
            <View style={styles.legend}>
              {topFive.map(s => (
                <View key={s.itemName} style={styles.legendRow}>
                  <View style={[styles.swatch, { backgroundColor: s.swatchColor }]} />
                  <Text style={[styles.legendText, { color: colors.text }]} numberOfLines={1}>
                    {s.itemName}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        <Card radius={12} padding={14} border={colors.surfaceBorder}>
          <View style={styles.stack10}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Download as Excel</Text>
            <Text style={[styles.tiny, { color: colors.textSecondary }]}>
              Each report opens the share sheet as a .xlsx (Save to Files, Drive, email, print). Filters above apply.
            </Text>
            <Btn title="📊 Export All Reports (one workbook)" onPress={exportAll} bold fontSize={13} height={42} radius={8} />
            <View style={styles.exportButtons}>
              {EXPORT_BUTTONS.map(([label, report]) => (
                <Btn key={report} title={label} onPress={() => exportReport(report)} variant="neutral" fontSize={11} height={30} paddingH={10} />
              ))}
            </View>
          </View>
        </Card>

        <Text style={[styles.heading, { color: colors.text }]}>Top 10 Best Performers</Text>
        {performerList(topPerformers, colors.success, 'No sales in this range.')}

        <Text style={[styles.heading, { color: colors.text }]}>Bottom 10 Worst Performers</Text>
        {performerList(bottomPerformers, colors.error, 'Nothing to show for this range.')}

        <Card radius={12} padding={0} border={colors.surfaceBorder}>
          <Pressable onPress={() => setExtraExpanded(v => !v)} accessibilityRole="button" aria-expanded={extraExpanded} style={styles.moreHeader}>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>More Reports</Text>
              <Text style={[styles.tiny, { color: colors.textSecondary }]}>
                Revenue by company · by category · demand by delivery day · top customers · subsidy & discount costs
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>{extraExpanded ? '▾' : '▸'}</Text>
          </Pressable>
          {extraExpanded && (
            <View style={styles.moreBody}>
              {nameValueList('Revenue by Company', revenueByCompany, 'orders')}
              {nameValueList('Revenue by Category', revenueByCategory, 'orders')}
              {nameValueList('Demand by Delivery Day', ordersByDeliveryDay, 'meals')}
              {nameValueList('Top Customers', topCustomers, 'orders')}
              {nameValueList('Subsidy & Discount Costs per Company', companyBenefitCosts, null)}
            </View>
          )}
        </Card>

        {disputed.length > 0 && <Text style={[styles.heading, { color: colors.text }]}>Disputed Orders</Text>}
        {disputed.map(order => (
          <Card key={order.id} radius={10} padding={14} border={colors.surfaceBorder}>
            <View style={styles.stack6}>
              <View style={styles.performerRow}>
                <Text style={[styles.ticket, { color: colors.text }]}>{order.disputeTicketRef}</Text>
                <View style={styles.disputeChip}>
                  <Text style={styles.disputeText}>{order.disputeStatus}</Text>
                </View>
              </View>
              <Text style={[styles.small, { color: colors.textSecondary }]}>{order.itemName}</Text>
              <Text style={[styles.reason, { color: colors.text }]}>{order.disputeReason}</Text>
              <Text style={[styles.reporter, { color: colors.textSecondary }]}>Reported by {order.customerName}</Text>
              <Btn title="Update Status" onPress={() => resolveDispute(order)} fontSize={11} height={34} paddingH={14} style={styles.selfStart} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 20 },
  filters: { gap: 10 },
  pair: { flexDirection: 'row', gap: 12 },
  dateLabel: { fontSize: 11 },
  dateValue: { fontSize: 14, borderBottomWidth: 1, paddingVertical: 8 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { width: '47%', flexGrow: 1, gap: 4 },
  metricLabel: { fontSize: 11, fontWeight: '700' },
  metricValue: { fontSize: 20, fontWeight: '700' },
  metricValueSmall: { fontSize: 15, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '700' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  subHeading: { fontSize: 14, fontWeight: '700' },
  tiny: { fontSize: 11 },
  stack4: { gap: 0 },
  stack6: { gap: 6 },
  stack8: { gap: 8 },
  stack10: { gap: 10 },
  exportButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  donutRow: { flexDirection: 'row', alignItems: 'center' },
  donut: { flex: 1, alignItems: 'center' },
  legend: { flex: 1, justifyContent: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, maxWidth: 130 },
  performerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  performerName: { flex: 1, fontSize: 13, fontWeight: '700' },
  performerUnits: { fontSize: 12 },
  performerRevenue: { fontSize: 13, fontWeight: '700' },
  moreHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  chevron: { fontSize: 18 },
  moreBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 14 },
  nvRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  nvName: { fontSize: 13 },
  nvDetail: { fontSize: 10 },
  nvCount: { fontSize: 12 },
  nvAmount: { fontSize: 13, fontWeight: '700' },
  ticket: { flex: 1, fontSize: 13, fontWeight: '700' },
  disputeChip: { backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  disputeText: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  small: { fontSize: 12 },
  reason: { fontSize: 13 },
  reporter: { fontSize: 11 },
  selfStart: { alignSelf: 'flex-start' },
});

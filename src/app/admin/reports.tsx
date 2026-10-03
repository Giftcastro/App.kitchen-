/** AdminReportsPage.xaml + AdminReportsViewModel — "Reports & Analytics". */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { BarChart, ChartDatum, DonutChart } from '../../components/Charts';
import { Btn, Card, Page, Picker } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { getCompanies } from '../../services/directory';
import { getAllOrders, updateDisputeStatus } from '../../services/orders';
import { fmtDate, fmtShortWeekday, fromIso, toIso } from '../../services/scheduling';
import { hasDispute } from '../../models';
import type { Company, DisputeStatus, Order } from '../../models';
import { fixed } from '../../utils/theme';

const PALETTE = ['#AF1718', '#DA5D23', '#F7F2E8', '#C9DE87', '#121212', '#B6DFF8'];
const TIMEFRAMES = ['Today', 'This Week', 'This Month', 'Custom Range'];
const ALL_COMPANIES = 'All Companies';
const ALL_CATEGORIES = 'All Categories';

interface SalesItemSummary {
  itemName: string;
  unitsSold: number;
  totalRevenue: number;
  swatchColor: string;
}

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

export default function AdminReportsScreen() {
  const { colors, isDark } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [timeframe, setTimeframe] = useState('This Week');
  const [companyFilter, setCompanyFilter] = useState(ALL_COMPANIES);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [customStart, setCustomStart] = useState(() => toIso(new Date(Date.now() - 7 * 86400000)));
  const [customEnd, setCustomEnd] = useState(() => toIso(new Date()));

  useFocusEffect(
    useCallback(() => {
      Promise.all([getAllOrders(), getCompanies()])
        .then(([loadedOrders, loadedCompanies]) => {
          setOrders(loadedOrders);
          setCompanies(loadedCompanies);
        })
        .catch(err => alerts.show('Could Not Load', (err as Error)?.message ?? 'Check your connection and try again.', 'OK'));
    }, [])
  );

  const categories = useMemo(
    () => [ALL_CATEGORIES, ...[...new Set(orders.flatMap(o => o.lines.map(l => l.category)).filter(Boolean))].sort()],
    [orders]
  );

  const [start, end] = resolveRange(timeframe, customStart, customEnd);
  const companyName = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);

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

  const totalRevenue = filtered.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrders = filtered.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const grouped: SalesItemSummary[] = useMemo(() => {
    const byItem = new Map<string, { units: number; revenue: number }>();
    for (const o of filtered) {
      for (const line of o.lines) {
        if (categoryFilter !== ALL_CATEGORIES && line.category !== categoryFilter) continue;
        const entry = byItem.get(line.name) ?? { units: 0, revenue: 0 };
        entry.units += line.quantity;
        entry.revenue += line.unitPrice * line.quantity;
        byItem.set(line.name, entry);
      }
    }
    return [...byItem.entries()]
      .map(([itemName, e], i) => ({ itemName, unitsSold: e.units, totalRevenue: e.revenue, swatchColor: PALETTE[i % PALETTE.length] }))
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .map((s, i) => ({ ...s, swatchColor: PALETTE[i % PALETTE.length] }));
  }, [filtered, categoryFilter]);

  const topFive = grouped.slice(0, 5);
  const otherRevenue = grouped.slice(5).reduce((sum, s) => sum + s.totalRevenue, 0);
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
        out.push({ label: fmtShortWeekday(iso), value: filtered.filter(o => o.deliveryDate === iso).reduce((s, o) => s + o.totalAmount, 0), color: PALETTE[0] });
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

  const exportReport = async () => {
    const out = [
      'YOUR KITCHEN CO. — SALES REPORT',
      `Range: ${timeframe} (${fmtDate(fromIso(start))} – ${fmtDate(fromIso(end))})`,
      `Company: ${companyFilter}    Category: ${categoryFilter}`,
      '',
      `Total Sales: R${totalRevenue.toFixed(2)}`,
      `Orders Completed: ${totalOrders}`,
      `Avg. Order Value: R${averageOrderValue.toFixed(2)}`,
      `Top Item: ${grouped[0]?.itemName ?? '—'}`,
      '',
      'TOP MENU PERFORMERS',
      ...grouped.slice(0, 10).map(s => `  ${s.itemName} — ${s.unitsSold} sold — R${s.totalRevenue.toFixed(2)}`),
    ];
    await Share.share({ message: out.join('\n'), title: 'Sales Report' });
    await alerts.show('Report Exported', `Sales report for '${timeframe}' (${companyFilter}) has been compiled and saved.`, 'OK');
  };

  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const metric = (label: string, value: string, valueColor = colors.text, small = false) => (
    <Card radius={12} bg={cardBg} style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[small ? styles.metricValueSmall : styles.metricValue, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
    </Card>
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
                <Text style={styles.dateLabel}>From</Text>
                <Text style={[styles.dateValue, { color: colors.text, borderBottomColor: colors.placeholder }]}>{fmtDate(fromIso(customStart))}</Text>
              </Pressable>
              <Pressable style={styles.flex} onPress={() => pickDate('To', customEnd, setCustomEnd)}>
                <Text style={styles.dateLabel}>To</Text>
                <Text style={[styles.dateValue, { color: colors.text, borderBottomColor: colors.placeholder }]}>{fmtDate(fromIso(customEnd))}</Text>
              </Pressable>
            </View>
          )}
          <Btn title="Export Report" onPress={exportReport} bold radius={8} height={42} />
        </View>

        <View style={styles.metrics}>
          {metric('Total Sales', `R${totalRevenue.toFixed(2)}`, colors.primary)}
          {metric('Orders Completed', String(totalOrders))}
          {metric('Avg. Order Value', `R${averageOrderValue.toFixed(2)}`)}
          {metric('Top Item', grouped[0]?.itemName ?? '—', colors.text, true)}
        </View>

        <Text style={[styles.heading, { color: colors.text }]}>Revenue Over Time</Text>
        <Card radius={12} padding={12} bg={cardBg}>
          <BarChart bars={bars} labelColor="gray" />
        </Card>

        <Text style={[styles.heading, { color: colors.text }]}>Revenue Share by Item</Text>
        <Card radius={12} padding={12} bg={cardBg}>
          <View style={styles.donutRow}>
            <View style={styles.donut}>
              <DonutChart slices={slices} holeColor={cardBg} />
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

        <Text style={[styles.heading, { color: colors.text }]}>Top Menu Performers</Text>
        {topFive.map(s => (
          <Card key={s.itemName} radius={10} padding={14} bg={cardBg}>
            <View style={styles.performerRow}>
              <Text style={[styles.performerName, { color: colors.text }]}>{s.itemName}</Text>
              <Text style={styles.performerUnits}>{s.unitsSold} sold</Text>
              <Text style={[styles.performerRevenue, { color: colors.primary }]}>R{s.totalRevenue.toFixed(2)}</Text>
            </View>
          </Card>
        ))}

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
  dateLabel: { fontSize: 11, color: '#888888' },
  dateValue: { fontSize: 14, borderBottomWidth: 1, paddingVertical: 8 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { width: '47%', flexGrow: 1, gap: 4 },
  metricLabel: { fontSize: 11, color: '#888888', fontWeight: '700' },
  metricValue: { fontSize: 20, fontWeight: '700' },
  metricValueSmall: { fontSize: 15, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '700' },
  donutRow: { flexDirection: 'row', alignItems: 'center' },
  donut: { flex: 1, alignItems: 'center' },
  legend: { flex: 1, justifyContent: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, maxWidth: 130 },
  performerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  performerName: { flex: 1, fontSize: 14, fontWeight: '700' },
  performerUnits: { fontSize: 12, color: '#888888' },
  performerRevenue: { fontSize: 14, fontWeight: '700' },
  stack6: { gap: 6 },
  ticket: { flex: 1, fontSize: 13, fontWeight: '700' },
  disputeChip: { backgroundColor: fixed.amberBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  disputeText: { fontSize: 10, fontWeight: '700', color: fixed.amber },
  small: { fontSize: 12 },
  reason: { fontSize: 13 },
  reporter: { fontSize: 11 },
  selfStart: { alignSelf: 'flex-start' },
});

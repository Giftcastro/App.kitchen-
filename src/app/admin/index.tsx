/** AdminDashboardPage.xaml + AdminDashboardViewModel — "Kitchen Operations Hub". */
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { Btn, Card, Page, LabeledPicker } from '../../components/ui';
import { useApp } from '../../state/AppState';
import {
  ALL_COMPANIES,
  ALL_DATES,
  AdminOrderRow,
  companyFilterOptions,
  dateFilterOptions,
  filterRows,
  loadActiveOrderRows,
  updateRowsStatus,
} from '../../services/adminOrders';
import { getAllOrders } from '../../services/orders';
import { todayIso } from '../../services/scheduling';
import { rand } from '../../services/analytics';
import type { Company, Order } from '../../models';

/** Month names for the "Month to Date (October)" card. */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function AdminDashboardScreen() {
  const { colors } = useApp();
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [companyFilter, setCompanyFilter] = useState(ALL_COMPANIES);
  const [dateFilter, setDateFilter] = useState(ALL_DATES);
  const [isBusy, setIsBusy] = useState(false);

  /** Loads active orders (the queue) and all orders (revenue cards); stale filters fall back to "All". */
  const refresh = useCallback(async () => {
    setIsBusy(true);
    try {
      const [{ rows: loaded, companies: loadedCompanies }, orders] = await Promise.all([loadActiveOrderRows(), getAllOrders()]);
      setRows(loaded);
      setCompanies(loadedCompanies);
      setAllOrders(orders);
      const companyOptions = companyFilterOptions(loadedCompanies, loaded);
      const dateOptions = dateFilterOptions(loaded);
      setCompanyFilter(prev => (companyOptions.includes(prev) ? prev : ALL_COMPANIES));
      setDateFilter(prev => (dateOptions.includes(prev) ? prev : ALL_DATES));
    } catch (err) {
      await alerts.show('Could Not Load', (err as Error)?.message ?? 'Check your connection and try again.', 'OK');
    } finally {
      setIsBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // ── KPI figures ──
  const upcoming = useMemo(() => filterRows(rows, companyFilter, dateFilter), [rows, companyFilter, dateFilter]);
  const today = todayIso();
  const todaysRevenue = rows.filter(r => r.order.deliveryDate === today).reduce((sum, r) => sum + r.order.totalAmount, 0);
  // totalAmount already includes the delivery fee here, so it's summed as-is.
  const totalRevenue = allOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthToDate = allOrders.filter(o => new Date(o.orderDate).getTime() >= monthStart).reduce((sum, o) => sum + o.totalAmount, 0);

  /** Quick-status button handler for one order. */
  const setStatus = async (row: AdminOrderRow, status: string) => {
    try {
      await updateRowsStatus([row], status);
      await refresh();
    } catch (err) {
      await alerts.show('Not Updated', (err as Error)?.message ?? 'Could not update this order.', 'OK');
    }
  };

  /** Sets one status on every order matching the filters (pick status, then confirm). */
  const bulkUpdate = async () => {
    if (upcoming.length === 0) {
      await alerts.show('Nothing to Update', 'No orders match the current filters.', 'OK');
      return;
    }
    const action = await alerts.actionSheet(
      `Update status for all ${upcoming.length} filtered order(s)?`,
      'Cancel',
      'Preparing',
      'Out for Delivery',
      'Delivered'
    );
    if (!action) return;
    const confirmed = await alerts.confirm(
      'Confirm Bulk Update',
      `Mark all ${upcoming.length} order(s) for ${companyFilter} on ${dateFilter} as "${action}"?`,
      'Update All',
      'Cancel'
    );
    if (!confirmed) return;
    const count = upcoming.length;
    try {
      await updateRowsStatus(upcoming, action);
      await refresh();
      await alerts.show('Updated', `${count} order(s) marked as "${action}".`, 'OK');
    } catch (err) {
      await alerts.show('Not Updated', (err as Error)?.message ?? 'Could not update these orders.', 'OK');
    }
  };

  /** MAUI's quick-status buttons; the order's current status shows ✓ and can't be re-sent. */
  const statusButton = (row: AdminOrderRow, status: string, bg: string) => {
    const current = row.order.status === status;
    return (
      <Btn
        title={current ? `✓ ${status}` : status}
        onPress={current ? undefined : () => setStatus(row, status)}
        bg={bg}
        color="#FFFFFF"
        bold={current}
        fontSize={status === 'Out for Delivery' ? 10 : 11}
        height={36}
        radius={8}
        paddingH={4}
        style={[styles.flex, current && styles.currentStatus]}
      />
    );
  };

  /** One revenue / count card in the 2x2 KPI grid. */
  const kpi = (emoji: string, label: string, value: string) => (
    <Card radius={16} border={colors.surfaceBorder} shadow="card" style={styles.kpi}>
      <View style={styles.kpiLabelRow}>
        <Text style={{ fontSize: 16 }}>{emoji}</Text>
        <Text style={[styles.kpiLabel, { color: colors.textSecondary }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={[styles.kpiValue, { color: colors.text }]}>{value}</Text>
    </Card>
  );

  return (
    <Page>
      <AdminNavStrip activeRoute="admindashboard" />
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isBusy} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        <View style={styles.kpiGrid}>
          {kpi('💰', "Today's Deliveries Revenue", `R${todaysRevenue.toFixed(2)}`)}
          {kpi('🔥', 'Active Orders', String(rows.length))}
          {kpi('💰', 'Total Revenue (all time)', rand(totalRevenue))}
          {kpi('📈', `Month to Date (${MONTHS[now.getMonth()]})`, rand(monthToDate))}
        </View>

        <View style={styles.queueHeader}>
          <Text style={[styles.heading, { color: colors.text }]}>Upcoming Deliveries</Text>
          <Btn title="Refresh" onPress={refresh} variant="ghost" color={colors.text} fontSize={12} height={32} paddingH={10} />
        </View>

        <View style={styles.filters}>
          <LabeledPicker label="Company" title="Filter Company" options={companyFilterOptions(companies, rows)} selected={companyFilter} onSelect={setCompanyFilter} />
          <LabeledPicker label="Delivery date" title="Filter Date" options={dateFilterOptions(rows)} selected={dateFilter} onSelect={setDateFilter} />
        </View>

        <Btn title={`📤  Bulk Update Status (${upcoming.length} ${upcoming.length === 1 ? 'order' : 'orders'})`} onPress={bulkUpdate} bold fontSize={13} height={40} radius={8} />

        {upcoming.length === 0 ? (
          <Text style={styles.empty}>No upcoming orders match these filters.</Text>
        ) : (
          upcoming.map(row => (
            <Card key={row.order.id} radius={16} border={colors.surfaceBorder}>
              <View style={styles.rowGap}>
                <View style={styles.orderHeader}>
                  <View style={styles.flex}>
                    <Text style={[styles.orderNo, { color: colors.text }]}>Order #{row.order.orderNumber}</Text>
                    <Text style={[styles.customer, { color: colors.textSecondary }]}>{row.order.customerName}</Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: colors.chipBg }]}>
                    <Text style={[styles.statusText, { color: colors.text }]}>{row.order.status}</Text>
                  </View>
                </View>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {row.companyName} — {row.locationName} — {row.deliveryDateLabel}
                </Text>
                <Text style={[styles.item, { color: colors.textSecondary }]}>{row.order.itemName}</Text>
                <View style={styles.statusButtons}>
                  {statusButton(row, 'Preparing', '#1E88E5')}
                  {statusButton(row, 'Out for Delivery', '#FB8C00')}
                  {statusButton(row, 'Delivered', '#43A047')}
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, gap: 16 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi: { width: '47%', flexGrow: 1, gap: 4 },
  // Emoji above the label so long labels ("Today's Deliveries Revenue") get the card's full width.
  kpiLabelRow: { gap: 4 },
  kpiLabel: { fontSize: 12, flexShrink: 1 },
  kpiValue: { fontSize: 20, fontWeight: '700' },
  queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 18, fontWeight: '700' },
  filters: { flexDirection: 'row', gap: 12 },
  empty: { fontSize: 14, color: 'gray', textAlign: 'center', padding: 30 },
  rowGap: { gap: 8 },
  orderHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  orderNo: { fontSize: 15, fontWeight: '700' },
  customer: { fontSize: 12 },
  statusChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 11 },
  item: { fontSize: 13 },
  statusButtons: { flexDirection: 'row', gap: 8 },
  currentStatus: { opacity: 0.55 },
});

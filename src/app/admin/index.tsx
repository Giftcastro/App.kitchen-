/** AdminDashboardPage.xaml + AdminDashboardViewModel — "Kitchen Operations Hub". */
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { Btn, Card, Page, Picker, HScroll } from '../../components/ui';
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
import type { Company, Order } from '../../models';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** C#'s {0:N2}: thousands separators, two decimals. */
const n2 = (value: number) => value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export default function AdminDashboardScreen() {
  const { colors } = useApp();
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [companyFilter, setCompanyFilter] = useState(ALL_COMPANIES);
  const [dateFilter, setDateFilter] = useState(ALL_DATES);
  const [isBusy, setIsBusy] = useState(false);

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

  const upcoming = useMemo(() => filterRows(rows, companyFilter, dateFilter), [rows, companyFilter, dateFilter]);
  const today = todayIso();
  const todaysRevenue = rows.filter(r => r.order.deliveryDate === today).reduce((sum, r) => sum + r.order.totalAmount, 0);
  // totalAmount already includes the delivery fee here, so it's summed as-is.
  const totalRevenue = allOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthToDate = allOrders.filter(o => new Date(o.orderDate).getTime() >= monthStart).reduce((sum, o) => sum + o.totalAmount, 0);

  const setStatus = async (row: AdminOrderRow, status: string) => {
    try {
      await updateRowsStatus([row], status);
      await refresh();
    } catch (err) {
      await alerts.show('Not Updated', (err as Error)?.message ?? 'Could not update this order.', 'OK');
    }
  };

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

  const kpi = (emoji: string, label: string, value: string) => (
    <Card radius={16} border={colors.surfaceBorder} shadow="card" style={styles.kpi}>
      <View style={styles.kpiLabelRow}>
        <Text style={{ fontSize: 16 }}>{emoji}</Text>
        <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>{label}</Text>
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
          {kpi('💰', 'Total Revenue (all time)', `R${n2(totalRevenue)}`)}
          {kpi('📈', `Month to Date (${MONTHS[now.getMonth()]})`, `R${n2(monthToDate)}`)}
        </View>

        <View style={styles.queueHeader}>
          <Text style={[styles.heading, { color: colors.text }]}>Upcoming Deliveries</Text>
          <Btn title="Refresh" onPress={refresh} variant="ghost" color={colors.text} fontSize={12} height={32} paddingH={10} />
        </View>

        <HScroll contentContainerStyle={styles.filters}>
          <Text style={[styles.filterLabel, { color: colors.brandGold }]}>Company:</Text>
          <Picker title="Filter Company" options={companyFilterOptions(companies, rows)} selected={companyFilter} onSelect={setCompanyFilter} width={170} />
          <Text style={[styles.filterLabel, styles.filterGap, { color: colors.brandGold }]}>Date:</Text>
          <Picker title="Filter Date" options={dateFilterOptions(rows)} selected={dateFilter} onSelect={setDateFilter} width={160} />
        </HScroll>

        <Btn title={`📤  Bulk Update Status (${upcoming.length} orders)`} onPress={bulkUpdate} bold fontSize={13} height={40} radius={8} />

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
                  <Btn title="Preparing" onPress={() => setStatus(row, 'Preparing')} bg="#1E88E5" color="#FFFFFF" fontSize={11} height={36} radius={8} paddingH={4} style={styles.flex} />
                  <Btn title="Out for Delivery" onPress={() => setStatus(row, 'Out for Delivery')} bg="#FB8C00" color="#FFFFFF" fontSize={10} height={36} radius={8} paddingH={4} style={styles.flex} />
                  <Btn title="Delivered" onPress={() => setStatus(row, 'Delivered')} bg="#43A047" color="#FFFFFF" fontSize={11} height={36} radius={8} paddingH={4} style={styles.flex} />
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
  kpiLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpiLabel: { fontSize: 12, flexShrink: 1 },
  kpiValue: { fontSize: 20, fontWeight: '700' },
  queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 18, fontWeight: '700' },
  filters: { gap: 8, alignItems: 'center' },
  filterLabel: { fontSize: 12, fontWeight: '700' },
  filterGap: { marginLeft: 10 },
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
});

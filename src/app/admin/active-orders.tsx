/** AdminActiveOrdersPage.xaml + AdminActiveOrdersViewModel. */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { Btn, Card, EmptyState, Page, Picker, Stars } from '../../components/ui';
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
import { fmtGenerated } from '../../services/scheduling';
import { fixed } from '../../utils/theme';
import type { Company } from '../../models';

interface PrepSummaryItem {
  dishName: string;
  totalQuantity: number;
}

const STATUSES = ['Received', 'Preparing', 'Out for Delivery', 'Delivered'];

export default function AdminActiveOrdersScreen() {
  const { colors, isDark } = useApp();
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyFilter, setCompanyFilter] = useState(ALL_COMPANIES);
  const [dateFilter, setDateFilter] = useState(ALL_DATES);
  const [isPrepViewActive, setIsPrepViewActive] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async () => {
    setIsBusy(true);
    try {
      const { rows: loaded, companies: loadedCompanies } = await loadActiveOrderRows();
      loaded.sort(
        (a, b) =>
          a.order.deliveryDate.localeCompare(b.order.deliveryDate) ||
          a.companyName.localeCompare(b.companyName) ||
          a.locationName.localeCompare(b.locationName)
      );
      setRows(loaded);
      setCompanies(loadedCompanies);
      const dateOptions = dateFilterOptions(loaded);
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

  const orders = useMemo(() => filterRows(rows, companyFilter, dateFilter), [rows, companyFilter, dateFilter]);

  // Bulk kitchen prep list: the same filtered orders, totalled per dish.
  const prepSummary: PrepSummaryItem[] = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of orders) for (const line of row.order.lines) totals.set(line.name, (totals.get(line.name) ?? 0) + line.quantity);
    return [...totals.entries()].map(([dishName, totalQuantity]) => ({ dishName, totalQuantity })).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [orders]);

  const updateStatus = async (row: AdminOrderRow) => {
    const action = await alerts.actionSheet(`Update Status for Order #${row.order.orderNumber}`, 'Cancel', ...STATUSES);
    if (!action) return;
    try {
      await updateRowsStatus([row], action);
      await refresh();
    } catch (err) {
      await alerts.show('Not Updated', (err as Error)?.message ?? 'Could not update this order.', 'OK');
    }
  };

  const markAllFiltered = async () => {
    if (orders.length === 0) {
      await alerts.show('No Orders', 'There are no orders matching the current filters.', 'OK');
      return;
    }
    const action = await alerts.actionSheet(`Mark all ${orders.length} filtered order(s) as...`, 'Cancel', ...STATUSES);
    if (!action) return;
    const confirmed = await alerts.confirm(
      'Confirm Bulk Update',
      `Set all ${orders.length} order(s) for ${companyFilter} / ${dateFilter} to "${action}"?`,
      'Confirm',
      'Cancel'
    );
    if (!confirmed) return;
    const count = orders.length;
    setIsBusy(true);
    try {
      await updateRowsStatus(orders, action);
      await refresh();
      await alerts.show('Updated', `${count} order(s) marked as ${action}.`, 'OK');
    } catch (err) {
      setIsBusy(false);
      await alerts.show('Not Updated', (err as Error)?.message ?? 'Could not update these orders.', 'OK');
    }
  };

  const printOrderSheet = async () => {
    if (orders.length === 0) {
      await alerts.show('Nothing to Print', 'There are no orders matching the current filters.', 'OK');
      return;
    }
    const groups = new Map<string, AdminOrderRow[]>();
    for (const row of orders) {
      const key = `${row.companyName} — ${row.locationName}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const out = [
      'YOUR KITCHEN CO. — ORDER SHEET',
      `Company: ${companyFilter}    Date: ${dateFilter}`,
      `Generated: ${fmtGenerated()}`,
      '-'.repeat(42),
    ];
    for (const key of [...groups.keys()].sort()) {
      out.push('', key);
      for (const row of groups.get(key)!.sort((a, b) => a.order.deliveryDate.localeCompare(b.order.deliveryDate))) {
        out.push(
          `  [${row.deliveryDateLabel}] #${row.order.orderNumber} — ${row.order.customerName}: ${row.order.itemName} (R${row.order.totalAmount.toFixed(2)}) — ${row.order.status}`
        );
        if (row.order.allergyNotes) out.push(`      ⚠️ ALLERGY: ${row.order.allergyNotes}`);
      }
    }
    out.push('', '-'.repeat(42), `Total orders: ${orders.length}`);
    await Share.share({ message: out.join('\n'), title: 'Order Sheet' });
  };

  const printPrepSheet = async () => {
    if (prepSummary.length === 0) {
      await alerts.show('Nothing to Print', 'There are no orders matching the current filters.', 'OK');
      return;
    }
    const out = [
      'YOUR KITCHEN CO. — KITCHEN PREP SHEET',
      `Company: ${companyFilter}    Date: ${dateFilter}`,
      `Generated: ${fmtGenerated()}`,
      '-'.repeat(42),
      '',
      ...prepSummary.map(p => `  ${String(p.totalQuantity).padStart(3)}x  ${p.dishName}`),
      '',
      '-'.repeat(42),
      `Total meals: ${prepSummary.reduce((sum, p) => sum + p.totalQuantity, 0)}   Distinct dishes: ${prepSummary.length}`,
    ];
    await Share.share({ message: out.join('\n'), title: 'Kitchen Prep Sheet' });
  };

  const viewToggle = (label: string, prep: boolean) => {
    const active = isPrepViewActive === prep;
    return (
      <Btn
        title={label}
        onPress={() => setIsPrepViewActive(prep)}
        bold
        fontSize={13}
        height={40}
        radius={8}
        bg={active ? colors.primary : colors.cardBg}
        color={active ? colors.onPrimary : colors.text}
        borderColor={active ? 'transparent' : colors.surfaceBorder}
        style={styles.flex}
      />
    );
  };

  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';

  return (
    <Page>
      <AdminNavStrip activeRoute="adminactiveorders" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersWrap} contentContainerStyle={styles.filters}>
        <Text style={[styles.filterLabel, { color: colors.primary }]}>Company:</Text>
        <Picker title="Filter Company" options={companyFilterOptions(companies, rows)} selected={companyFilter} onSelect={setCompanyFilter} width={180} />
        <Text style={[styles.filterLabel, styles.filterGap, { color: colors.primary }]}>Date:</Text>
        <Picker title="Filter Date" options={dateFilterOptions(rows)} selected={dateFilter} onSelect={setDateFilter} width={170} />
      </ScrollView>

      <View style={styles.controls}>
        <View style={styles.toggleRow}>
          {viewToggle('📋  Orders View', false)}
          {viewToggle('🍳  Prep Summary', true)}
        </View>
        <Btn
          title={isPrepViewActive ? '🖨️  Print Prep Sheet' : '🖨️  Print Order Sheet'}
          onPress={isPrepViewActive ? printPrepSheet : printOrderSheet}
          bold
          fontSize={13}
          height={40}
          radius={8}
        />
        <Btn title="✅  Mark All Filtered As..." onPress={markAllFiltered} variant="outline" bold fontSize={13} height={40} radius={8} />
      </View>

      {isPrepViewActive ? (
        <FlatList
          data={prepSummary}
          keyExtractor={p => p.dishName}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isBusy} onRefresh={refresh} tintColor="#121212" />}
          ListHeaderComponent={
            <Text style={[styles.prepHeader, { color: colors.textSecondary }]}>
              Total quantity needed per dish, across all matching orders — for bulk kitchen prep, not individual plating.
            </Text>
          }
          ListEmptyComponent={<EmptyState emoji="🍳" message="No dishes to prep for these filters." />}
          renderItem={({ item }) => (
            <Card radius={12} padding={14} border={colors.surfaceBorder} style={styles.prepCard}>
              <View style={styles.prepRow}>
                <View style={[styles.qtyCircle, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.qtyText, { color: colors.onPrimary }]}>{item.totalQuantity}</Text>
                </View>
                <Text style={[styles.dish, { color: colors.text }]}>{item.dishName}</Text>
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={r => r.order.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isBusy} onRefresh={refresh} tintColor="#121212" />}
          ListEmptyComponent={<EmptyState emoji="📋" message="No active orders match these filters." />}
          renderItem={({ item: row }) => (
            <Card radius={12} bg={cardBg} style={styles.orderCard}>
              <View style={styles.orderRow}>
                <View style={styles.orderInfo}>
                  <Text style={[styles.company, { color: colors.text }]}>{row.companyName}</Text>
                  <Text style={styles.location}>{row.locationName}</Text>
                  <Text style={[styles.item, { color: colors.text }]}>{row.order.itemName}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>{row.deliveryDateLabel}</Text>
                    <Text style={styles.meta}>Order #{row.order.orderNumber}</Text>
                    <Text style={[styles.meta, styles.bold, { color: colors.primary }]}>R{row.order.totalAmount.toFixed(2)}</Text>
                  </View>
                  {row.order.rating > 0 && <Stars rating={row.order.rating} size={13} color={colors.primary} />}
                  {!!row.order.allergyNotes && (
                    <View style={styles.allergyChip}>
                      <Text style={styles.allergyText}>⚠️ {row.order.allergyNotes}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.orderRight}>
                  <View style={[styles.statusChip, { backgroundColor: fixed.badgeBg }]}>
                    <Text style={[styles.statusText, { color: colors.primary }]}>{row.order.status}</Text>
                  </View>
                  <Btn title="Update" onPress={() => updateStatus(row)} variant="neutral" fontSize={12} height={36} paddingH={12} />
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  filtersWrap: { flexGrow: 0 },
  filters: { gap: 8, alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  filterLabel: { fontSize: 12, fontWeight: '700' },
  filterGap: { marginLeft: 10 },
  controls: { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 },
  prepHeader: { fontSize: 12, marginBottom: 10 },
  prepCard: { marginBottom: 8 },
  prepRow: { flexDirection: 'row', alignItems: 'center' },
  qtyCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 16, fontWeight: '700' },
  dish: { flex: 1, fontSize: 15, fontWeight: '700', marginLeft: 14 },
  orderCard: { marginBottom: 12 },
  orderRow: { flexDirection: 'row', gap: 10 },
  orderInfo: { flex: 1, gap: 4 },
  orderRight: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  company: { fontSize: 15, fontWeight: '700' },
  location: { fontSize: 12, color: '#888888' },
  item: { fontSize: 13 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  meta: { fontSize: 11, color: '#AAAAAA' },
  statusChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  allergyChip: { alignSelf: 'flex-start', backgroundColor: fixed.amberBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  allergyText: { fontSize: 11, fontWeight: '700', color: fixed.amber },
});

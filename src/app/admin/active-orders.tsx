/**
 * AdminActiveOrdersPage.xaml + AdminActiveOrdersViewModel. Downloads work
 * on the orders behind the current Company + Date filters (services/
 * kitchenExports); PDF / Excel go to the share sheet, or download on web.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { Btn, Card, EmptyState, Page, Picker, Stars, HScroll } from '../../components/ui';
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
import { buildPrepSummary, KitchenExports } from '../../services/kitchenExports';
import type { Company } from '../../models';

const STATUSES = ['Received', 'Preparing', 'Out for Delivery', 'Delivered'];

export default function AdminActiveOrdersScreen() {
  const { colors } = useApp();
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
  const prepSummary = useMemo(() => buildPrepSummary(orders), [orders]);

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

  /** Runs one download / print for the filtered orders, with MAUI's empty-filter guard. */
  const exportWith = async (run: (exports: KitchenExports) => Promise<void>, emptyTitle = 'Nothing to Export') => {
    if (orders.length === 0) {
      await alerts.show(emptyTitle, 'There are no orders matching the current filters.', 'OK');
      return;
    }
    try {
      await run(new KitchenExports(orders, companyFilter, dateFilter));
    } catch (err) {
      await alerts.show('Export Failed', (err as Error)?.message ?? 'The file could not be created.', 'OK');
    }
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

  return (
    <Page>
      <AdminNavStrip activeRoute="adminactiveorders" />
      <HScroll style={styles.filtersWrap} contentContainerStyle={styles.filters}>
        <Text style={[styles.filterLabel, { color: colors.brandGold }]}>Company:</Text>
        <Picker title="Filter Company" options={companyFilterOptions(companies, rows)} selected={companyFilter} onSelect={setCompanyFilter} width={180} />
        <Text style={[styles.filterLabel, styles.filterGap, { color: colors.brandGold }]}>Date:</Text>
        <Picker title="Filter Date" options={dateFilterOptions(rows)} selected={dateFilter} onSelect={setDateFilter} width={170} />
      </HScroll>

      <View style={styles.controls}>
        <View style={styles.toggleRow}>
          {viewToggle('📋  Orders View', false)}
          {viewToggle('🍳  Prep Summary', true)}
        </View>
        <View style={styles.toggleRow}>
          <Btn title="📄 Production Sheet (PDF)" onPress={() => exportWith(e => e.productionSheetPdf())} bold fontSize={12} height={40} radius={8} paddingH={6} style={styles.flex} />
          <Btn title="📊 Production Sheet (Excel)" onPress={() => exportWith(e => e.productionSheetExcel())} bold fontSize={12} height={40} radius={8} paddingH={6} style={styles.flex} />
        </View>
        <View style={styles.toggleRow}>
          <Btn
            title="🏷️ Delivery Notes (PDF)"
            onPress={() => exportWith(e => e.deliveryNotesPdf())}
            bg={colors.brandGold}
            color={colors.onBrandGold}
            bold
            fontSize={12}
            height={40}
            radius={8}
            paddingH={6}
            style={styles.flex}
          />
          <Btn
            title="🧾 Invoices (PDF)"
            onPress={() => exportWith(e => e.invoicesPdf())}
            bg={colors.brandGold}
            color={colors.onBrandGold}
            bold
            fontSize={12}
            height={40}
            radius={8}
            paddingH={6}
            style={styles.flex}
          />
          <Btn
            title="🖨️"
            onPress={() => exportWith(e => (isPrepViewActive ? e.printPrepSheet() : e.printOrderSheet()), 'Nothing to Print')}
            variant="neutral"
            fontSize={14}
            height={40}
            radius={8}
            paddingH={0}
            style={styles.printBtn}
          />
        </View>
      </View>

      {isPrepViewActive ? (
        <FlatList
          data={prepSummary}
          keyExtractor={p => p.dishName}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isBusy} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
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
          refreshControl={<RefreshControl refreshing={isBusy} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState emoji="📋" message="No active orders match these filters." />}
          renderItem={({ item: row }) => (
            <Card radius={12} style={styles.orderCard}>
              <View style={styles.orderRow}>
                <View style={styles.orderInfo}>
                  <Text style={[styles.company, { color: colors.text }]}>{row.companyName}</Text>
                  <Text style={[styles.location, { color: colors.mutedText }]}>{row.locationName}</Text>
                  <Text style={[styles.item, { color: colors.text }]}>{row.order.itemName}</Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.meta, { color: colors.mutedText }]}>{row.deliveryDateLabel}</Text>
                    <Text style={[styles.meta, { color: colors.mutedText }]}>Order #{row.order.orderNumber}</Text>
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
                  <View style={[styles.statusChip, { backgroundColor: colors.subtleFillStrong }]}>
                    <Text style={[styles.statusText, { color: colors.brandGold }]}>{row.order.status}</Text>
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
  printBtn: { width: 44 },
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
  location: { fontSize: 12 },
  item: { fontSize: 13 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  meta: { fontSize: 11 },
  statusChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  allergyChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  allergyText: { fontSize: 11, fontWeight: '700', color: '#B45309' },
});

/**
 * ActiveOrdersPage.xaml — the Orders tab. Active Orders and Order History
 * share one page, switched by a 50/50 segmented toggle (same control as the
 * Menu's Main/Cycling switch).
 *
 * Active: grouped per delivery date ("Today" / "Tomorrow" / "Thursday, 02
 * Oct", with "N orders · R x"), each order a collapsible card whose
 * expanded state carries the 4-stage tracker, delivery details, notes and
 * any allergy note. The next order opens on first load; open cards stay
 * open across a refresh (ActiveOrdersViewModel / ActiveOrderItem).
 */
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text } from '../../../components/AppText';
import { alerts } from '../../../components/Alerts';
import { Btn, EmptyState, Page, Stars } from '../../../components/ui';
import { useApp } from '../../../state/AppState';
import { setNavParam } from '../../../state/navParams';
import { getActiveOrdersForUser, getOrderHistoryForUser, rateOrder, reportDispute } from '../../../services/orders';
import { getStaticProducts } from '../../../services/catalog';
import { fmtDate, fmtDayLabel, fromIso, getNextAvailableDeliveryDate, todayIso, toIso } from '../../../services/scheduling';
import { canReorder, hasDispute, orderStage } from '../../../models';
import type { Order } from '../../../models';

type TabKey = 'Active' | 'History';

const STAGES: [string, string][] = [
  ['Order Received', 'Confirmed and booked into the kitchen schedule.'],
  ['Kitchen Preparing', 'Being prepared fresh on the morning of delivery.'],
  ['Out for Delivery', 'En route in insulated carriers to your location.'],
  ['Delivered', 'Arrives at your delivery location, ready to enjoy.'],
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "dddd, dd MMMM yyyy" */
function fmtFullDate(iso: string): string {
  const d = fromIso(iso);
  return `${DAYS[d.getDay()]}, ${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "dd MMM yyyy, HH:mm" */
function fmtPlacedOn(ts: string): string {
  const d = new Date(ts);
  return `${fmtDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** OrderDateGroup.DateLabel */
function groupLabel(iso: string): string {
  const today = todayIso();
  const tomorrow = fromIso(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === today) return 'Today';
  if (iso === toIso(tomorrow)) return 'Tomorrow';
  return fmtDayLabel(iso);
}

/** StageNodeColorConverter */
function stageColors(current: number, stage: number, isDark: boolean) {
  if (current > stage) return { bg: isDark ? '#34D399' : '#059669', fg: '#FFFFFF' };
  if (current === stage) return { bg: isDark ? '#F7F2E8' : '#121212', fg: isDark ? '#121212' : '#FFFFFF' };
  return { bg: isDark ? '#2E2E32' : '#E5DFD3', fg: isDark ? '#A1A1AA' : '#4E4E4E' };
}

interface DateGroup {
  date: string;
  label: string;
  summary: string;
  data: Order[];
}

export default function OrdersScreen() {
  const { colors, isDark, user, addCartItem } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('Active');
  const [groups, setGroups] = useState<DateGroup[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Order[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsBusy(true);
    try {
      const [active, past] = await Promise.all([getActiveOrdersForUser(user.id), getOrderHistoryForUser(user.id)]);
      const byDate = new Map<string, Order[]>();
      for (const o of active) byDate.set(o.deliveryDate, [...(byDate.get(o.deliveryDate) ?? []), o]);
      const next = [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, orders]) => ({
          date,
          label: groupLabel(date),
          summary: `${orders.length} ${orders.length === 1 ? 'order' : 'orders'} · R${orders.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)}`,
          data: orders,
        }));
      setGroups(next);
      // Keep open cards open across a refresh; on first load open the very next order.
      setExpanded(prev => {
        const kept = new Set([...prev].filter(id => active.some(o => o.id === id)));
        if (kept.size === 0 && next[0]?.data[0]) kept.add(next[0].data[0].id);
        return kept;
      });
      setHistory(past);
    } catch {
      // Keep whatever was showing; pull to refresh retries.
    } finally {
      setIsBusy(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const patchHistory = (id: string, patch: Partial<Order>) => setHistory(list => list.map(o => (o.id === id ? { ...o, ...patch } : o)));

  const rateStar = async (order: Order, position: number) => {
    // Tapping the current rating again clears it.
    const newRating = order.rating === position ? 0 : position;
    const previous = order.rating;
    patchHistory(order.id, { rating: newRating });
    try {
      await rateOrder(order.id, newRating);
    } catch (err) {
      patchHistory(order.id, { rating: previous });
      await alerts.show('Rating Not Saved', (err as Error)?.message ?? 'Could not save your rating.', 'OK');
      return;
    }
    if (newRating > 0) {
      const feedback = await alerts.prompt('Add a comment? (optional)', `You rated ${order.itemName} ${newRating} star${newRating === 1 ? '' : 's'}.`, {
        initialValue: order.ratingFeedback,
      });
      if (feedback !== null && feedback !== order.ratingFeedback) {
        patchHistory(order.id, { ratingFeedback: feedback });
        rateOrder(order.id, newRating, feedback).catch(() => {});
      }
    }
  };

  const reportIssue = async (order: Order) => {
    if (hasDispute(order)) {
      await alerts.show('Already Reported', `This order already has an open ticket: ${order.disputeTicketRef} (${order.disputeStatus}).`, 'OK');
      return;
    }
    const reason = await alerts.prompt('Report an Issue', `What went wrong with "${order.itemName}"? (e.g. missing item, wrong order, quality issue)`);
    if (!reason?.trim()) return;
    try {
      const ticketRef = await reportDispute(order.id, reason);
      patchHistory(order.id, { disputeReason: reason, disputeTicketRef: ticketRef, disputeStatus: 'Investigating' });
      await alerts.show('Issue Reported', `Support ticket ${ticketRef} has been opened. We'll follow up shortly.`, 'OK');
    } catch (err) {
      await alerts.show('Not Reported', (err as Error)?.message ?? 'Could not log this ticket.', 'OK');
    }
  };

  const viewInvoice = (order: Order) => {
    if (!order.taxInvoiceNumber) return;
    setNavParam('Order', order);
    router.push('/orders/tax-invoice');
  };

  const reorder = async (order: Order) => {
    if (!canReorder(order)) return;
    const products = (await getStaticProducts().catch(() => [])).filter(p => p.isAvailable);
    const staticLines = order.lines.filter(l => !l.isCycle);
    const found = staticLines.map(line => products.find(p => p.name.toLowerCase() === line.name.toLowerCase()));
    const missing = staticLines.find((_, i) => !found[i]);
    if (missing || found.length === 0) {
      const name = missing?.name ?? order.itemName;
      await alerts.show(
        'No Longer Available',
        `"${name}" isn't on the current menu anymore, so it can't be reordered directly — take a look at what's available today instead.`,
        'OK'
      );
      return;
    }
    const deliveryDate = getNextAvailableDeliveryDate();
    found.forEach((product, i) => {
      if (!product) return;
      addCartItem({
        key: `${product.id}:${Date.now()}:${i}`,
        product,
        selectedOptions: [],
        specialRequests: '',
        allergyNotes: '',
        deliveryDate,
        menuType: 'static',
        quantity: 1,
        unitPrice: product.basePrice,
      });
    });
    await alerts.show(
      'Added to Basket',
      `${found.map(p => p!.name).join(', ')} ${found.length === 1 ? 'has' : 'have'} been added to your basket for ${fmtDayLabel(deliveryDate)}.`,
      'Great'
    );
  };

  const cardStyle = { borderColor: colors.surfaceBorder, backgroundColor: colors.cardBg };
  const statusChip = (status: string) => (
    <View style={[styles.statusChip, { backgroundColor: colors.chipBg }]}>
      <Text style={[styles.statusText, { color: colors.text }]}>{status}</Text>
    </View>
  );

  const detailRow = (label: string, value: string) => (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );

  const renderActive = ({ item }: { item: Order }) => {
    const open = expanded.has(item.id);
    const current = orderStage(item);
    return (
      <View style={[styles.activeCard, cardStyle]}>
        <Pressable onPress={() => toggle(item.id)} accessibilityRole="button" aria-expanded={open} style={styles.activeHeader}>
          <View style={[styles.iconTile, { backgroundColor: colors.chipBg }]}>
            <Text style={{ fontSize: 20 }}>🔥</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
              {item.itemName}
            </Text>
            <Text style={[styles.small, { color: colors.textSecondary }]}>Order #{item.orderNumber}</Text>
          </View>
          {statusChip(item.status)}
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>{open ? '▾' : '▸'}</Text>
        </Pressable>

        {open && (
          <View style={styles.details}>
            <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />
            <Text style={[styles.caption, { color: colors.textSecondary }]}>DELIVERY PROGRESS</Text>
            <View>
              {STAGES.map(([title, body], index) => {
                const stage = index + 1;
                const node = stageColors(current, stage, isDark);
                const last = stage === STAGES.length;
                return (
                  <View key={title} style={[styles.stageRow, index > 0 && styles.stageRowJoined]}>
                    <View style={styles.stageRail}>
                      <View style={[styles.node, { backgroundColor: node.bg }]}>
                        <Text style={[styles.nodeText, { color: node.fg }]}>{stage}</Text>
                      </View>
                      {!last && <View style={[styles.connector, { backgroundColor: node.bg }]} />}
                    </View>
                    <View style={[styles.stageBody, !last && styles.stageBodySpaced]}>
                      <Text style={[styles.stageTitle, { color: colors.text }]}>{title}</Text>
                      <Text style={[styles.stageDesc, { color: colors.textSecondary }]}>{body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />
            <View style={styles.stack8}>
              {detailRow('Delivery date', fmtFullDate(item.deliveryDate))}
              {detailRow('Location', item.deliveryFloor.trim() ? `Deliver to: ${item.deliveryFloor}` : 'Delivery details on file')}
              {detailRow('Placed on', fmtPlacedOn(item.orderDate))}
              {detailRow('Order total', `R${item.totalAmount.toFixed(2)}`)}
              {!!item.summaryText.trim() && detailRow('Notes', item.summaryText)}
            </View>
            {!!item.allergyNotes.trim() && (
              <View style={styles.allergyBox}>
                <Text style={styles.allergyText}>
                  <Text style={[styles.allergyText, styles.bold]}>Allergy note: </Text>
                  {item.allergyNotes}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderHistory = ({ item }: { item: Order }) => (
    <View style={[styles.historyCard, cardStyle]}>
      <View style={styles.orderRow}>
        <View style={[styles.iconTile, { backgroundColor: colors.chipBg }]}>
          <Text style={{ fontSize: 20 }}>📦</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
            {item.itemName}
          </Text>
          <View style={styles.dateRow}>
            <Text style={{ fontSize: 11 }}>🗓️</Text>
            <Text style={[styles.small, { color: colors.textSecondary }]}>{fmtDate(item.orderDate)}</Text>
          </View>
        </View>
        <View style={styles.historyRight}>
          {statusChip(item.status)}
          <Text style={[styles.total, { color: colors.text }]}>R{item.totalAmount.toFixed(2)}</Text>
        </View>
      </View>
      <View style={styles.actionsRow}>
        <Stars rating={item.rating} size={20} color={colors.primary} onPressStar={position => rateStar(item, position)} />
        {canReorder(item) && <Btn title="Reorder" onPress={() => reorder(item)} fontSize={11} bold height={30} paddingH={12} style={styles.reorder} />}
        <Btn title="Invoice" onPress={() => viewInvoice(item)} variant="outline" fontSize={11} bold height={30} paddingH={12} style={styles.invoice} />
      </View>
      <View style={styles.disputeRow}>
        {hasDispute(item) ? (
          <View style={styles.disputeChip}>
            <Text style={styles.disputeText}>
              {item.disputeTicketRef}: {item.disputeStatus}
            </Text>
          </View>
        ) : (
          <Btn title="Report an Issue" onPress={() => reportIssue(item)} variant="outline" color={colors.textSecondary} fontSize={11} height={28} paddingH={10} />
        )}
      </View>
    </View>
  );

  const toggleButton = (key: TabKey, label: string) => {
    const selected = tab === key;
    return (
      <Pressable
        key={key}
        onPress={() => setTab(key)}
        accessibilityRole="tab"
        aria-selected={selected}
        style={({ pressed }) => [styles.toggleBtn, selected && { backgroundColor: colors.primary }, pressed && styles.pressed]}
      >
        <Text style={[styles.toggleText, { color: selected ? colors.onPrimary : colors.mutedText }]}>{label}</Text>
      </Pressable>
    );
  };

  const refreshControl = <RefreshControl refreshing={isBusy} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />;

  return (
    <Page>
      <View style={[styles.toggle, { backgroundColor: colors.chipBg }]}>
        {toggleButton('Active', 'Active Orders')}
        {toggleButton('History', 'Order History')}
      </View>

      {tab === 'Active' ? (
        <SectionList
          sections={groups}
          keyExtractor={o => o.id}
          renderItem={renderActive}
          renderSectionHeader={({ section }) => (
            <View style={styles.groupHeader}>
              <Text style={[styles.groupLabel, { color: colors.text }]}>{section.label}</Text>
              <Text style={[styles.groupSummary, { color: colors.textSecondary }]}>{section.summary}</Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[styles.list, groups.length === 0 && styles.listEmpty]}
          refreshControl={refreshControl}
          ListEmptyComponent={
            isBusy ? null : (
              <EmptyState
                badge
                emoji="🍳"
                title="No Active Orders"
                message="Your live kitchen orders will appear here in real-time as soon as you place them."
              />
            )
          }
        />
      ) : (
        <FlatList
          data={history}
          keyExtractor={o => o.id}
          renderItem={renderHistory}
          contentContainerStyle={[styles.list, history.length === 0 && styles.listEmpty]}
          refreshControl={refreshControl}
          ListEmptyComponent={
            isBusy ? null : (
              <EmptyState
                badge
                emoji="📜"
                title="No Order History"
                message="Your past orders and receipt details will be archived here for easy reordering."
              />
            )
          }
        />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  toggle: { marginHorizontal: 16, marginTop: 12, marginBottom: 8, borderRadius: 24, padding: 4, height: 48, flexDirection: 'row' },
  toggleBtn: { flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontSize: 13, fontWeight: '700' },
  list: { paddingBottom: 12 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  groupHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 14, marginBottom: 8 },
  groupLabel: { fontSize: 15, fontWeight: '700' },
  groupSummary: { fontSize: 12, fontWeight: '700' },
  caption: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  activeCard: {
    borderWidth: 1,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  chevron: { fontSize: 18 },
  details: { paddingHorizontal: 14, paddingBottom: 16, gap: 16 },
  divider: { height: 1 },
  stack8: { gap: 8 },
  detailRow: { flexDirection: 'row' },
  detailLabel: { width: 110, fontSize: 12, fontWeight: '700' },
  detailValue: { flex: 1, fontSize: 12 },
  allergyBox: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(245,158,11,0.10)' },
  allergyText: { fontSize: 12, color: '#B45309' },
  stageRow: { flexDirection: 'row' },
  // Pulls each stage up into the previous one's 18pt tail so the connector reads as one line.
  stageRowJoined: { marginTop: -16 },
  stageRail: { width: 36, alignItems: 'flex-start' },
  node: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nodeText: { fontSize: 12, fontWeight: '700' },
  connector: { width: 2, flex: 1, marginVertical: 4, marginLeft: 13 },
  stageBody: { flex: 1, gap: 2, marginLeft: 12 },
  stageBodySpaced: { marginBottom: 18 },
  stageTitle: { fontSize: 14, fontWeight: '700' },
  stageDesc: { fontSize: 12 },
  historyCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.035,
    shadowRadius: 5,
    elevation: 1,
  },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconTile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 15, fontWeight: '700' },
  small: { fontSize: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  statusChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  historyRight: { alignItems: 'flex-end', gap: 6 },
  total: { fontSize: 13, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginLeft: 58, marginTop: 10 },
  reorder: { marginLeft: 10 },
  invoice: { marginLeft: 8 },
  disputeRow: { flexDirection: 'row', marginLeft: 58, marginTop: 8 },
  disputeChip: { backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  disputeText: { fontSize: 10, fontWeight: '700', color: '#B45309' },
});

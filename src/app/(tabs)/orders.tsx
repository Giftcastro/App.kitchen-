/**
 * The Orders tab — AppShell's two ShellContents (ActiveOrdersPage and
 * OrderHistoryPage) under one tab, switched by a top tab strip as Shell
 * renders them.
 */
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { Btn, Card, EmptyState, Page, Stars } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { setNavParam } from '../../state/navParams';
import { getActiveOrdersForUser, getOrderHistoryForUser, rateOrder, reportDispute } from '../../services/orders';
import { getStaticProducts } from '../../services/catalog';
import { fmtDate, fmtDayLabel, getNextAvailableDeliveryDate } from '../../services/scheduling';
import { canReorder, hasDispute, orderStage } from '../../models';
import type { Order } from '../../models';
import { fixed } from '../../utils/theme';

type TabKey = 'active' | 'history';

const STAGES: [string, string][] = [
  ['Order Received', 'Your order has been confirmed and booked into the kitchen schedule.'],
  ['Kitchen Preparing', 'Our culinary team is preparing your meal fresh this morning.'],
  ['Out for Delivery', 'Your order is en route in insulated carriers to your delivery location.'],
  ['Delivered', 'Arrives securely at your delivery location, ready to enjoy.'],
];

/** StageNodeColorConverter */
function stageColors(current: number, stage: number, isDark: boolean) {
  if (current > stage) return { bg: isDark ? '#34D399' : '#059669', fg: '#FFFFFF' };
  if (current === stage) return { bg: isDark ? '#F7F2E8' : '#121212', fg: isDark ? '#121212' : '#FFFFFF' };
  return { bg: isDark ? '#2E2E32' : '#E5DFD3', fg: isDark ? '#A1A1AA' : '#4E4E4E' };
}

export default function OrdersScreen() {
  const { colors, isDark, user, addCartItem } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('active');
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsBusy(true);
    try {
      const [active, past] = await Promise.all([getActiveOrdersForUser(user.id), getOrderHistoryForUser(user.id)]);
      setActiveOrders(active);
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
    router.push('/tax-invoice');
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

  const cardStyle = { borderColor: isDark ? '#252525' : '#E0E0E0', backgroundColor: isDark ? colors.cardBg : '#FFFFFF' };
  const statusChip = (status: string) => (
    <View style={[styles.statusChip, { backgroundColor: colors.tan }]}>
      <Text style={[styles.statusText, { color: isDark ? colors.text : fixed.nearBlack }]}>{status}</Text>
    </View>
  );

  const nextOrder = activeOrders[0];
  const tracker = nextOrder ? (
    <Card radius={20} border={colors.surfaceBorder} style={styles.tracker}>
      <View style={styles.trackerHeader}>
        <View style={styles.flex}>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>DELIVERY PROGRESS</Text>
          <Text style={[styles.trackerDate, { color: colors.primary }]}>{fmtDayLabel(nextOrder.deliveryDate)}</Text>
        </View>
        <View style={[styles.orderBadge, { borderColor: colors.primary }]}>
          <Text style={[styles.orderBadgeText, { color: colors.primary }]}>Order #{nextOrder.orderNumber}</Text>
        </View>
      </View>
      {STAGES.map(([title, body], index) => {
        const stage = index + 1;
        const node = stageColors(orderStage(nextOrder), stage, isDark);
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
    </Card>
  ) : null;

  const renderActive = ({ item }: { item: Order }) => (
    <View style={[styles.orderCard, cardStyle]}>
      <View style={styles.orderRow}>
        <View style={[styles.iconTile, { backgroundColor: colors.tan }]}>
          <Text style={{ fontSize: 20 }}>🔥</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
            {item.itemName}
          </Text>
          <Text style={[styles.small, { color: colors.textSecondary }]}>Order #{item.orderId}</Text>
        </View>
        {statusChip(item.status)}
      </View>
    </View>
  );

  const renderHistory = ({ item }: { item: Order }) => (
    <View style={[styles.orderCard, styles.historyCard, cardStyle]}>
      <View style={styles.orderRow}>
        <View style={[styles.iconTile, { backgroundColor: colors.tileBg }]}>
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

  const tabButton = (key: TabKey, label: string) => (
    <Pressable key={key} onPress={() => setTab(key)} style={styles.topTab} accessibilityRole="tab" aria-selected={tab === key}>
      <Text style={[styles.topTabText, { color: tab === key ? colors.text : colors.textSecondary, fontWeight: tab === key ? '700' : '400' }]}>{label}</Text>
      <View style={[styles.topTabLine, { backgroundColor: tab === key ? colors.primary : 'transparent' }]} />
    </Pressable>
  );

  return (
    <Page bg={colors.cream}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.pageBg, borderBottomColor: colors.surfaceBorder }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{tab === 'active' ? 'Active Orders' : 'Order History'}</Text>
        <View style={styles.topTabs}>
          {tabButton('active', 'Active')}
          {tabButton('history', 'History')}
        </View>
      </View>

      {tab === 'active' ? (
        <FlatList
          data={activeOrders}
          keyExtractor={o => o.id}
          renderItem={renderActive}
          ListHeaderComponent={tracker}
          contentContainerStyle={[styles.list, activeOrders.length === 0 && styles.listEmpty]}
          refreshControl={<RefreshControl refreshing={isBusy} onRefresh={refresh} tintColor="#121212" />}
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
          refreshControl={<RefreshControl refreshing={isBusy} onRefresh={refresh} tintColor="#121212" />}
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
  header: { borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  topTabs: { flexDirection: 'row' },
  topTab: { flex: 1, alignItems: 'center', paddingTop: 8 },
  topTabText: { fontSize: 14, paddingBottom: 8 },
  topTabLine: { height: 2.5, alignSelf: 'stretch' },
  list: { paddingHorizontal: 16, paddingVertical: 12 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  tracker: { marginBottom: 16, gap: 16 },
  trackerHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  caption: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  trackerDate: { fontSize: 15, fontWeight: '700' },
  orderBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  orderBadgeText: { fontSize: 10, fontWeight: '700' },
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
  orderCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  historyCard: { paddingVertical: 14 },
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
  disputeChip: { backgroundColor: fixed.amberBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  disputeText: { fontSize: 10, fontWeight: '700', color: fixed.amber },
});

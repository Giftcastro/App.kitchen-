/**
 * Orders — active orders (live batch-dispatch timeline) on top, Order
 * History below. Combines what used to be two separate tabs (client
 * request, Sep 2026): the Orders tab's live tracker and the History tab's
 * past-order list. `/tracker` is gone; Profile's "Track Order" and "Order
 * History" links both now point here.
 *
 * "Active" is a status check (pending/preparing/on_the_way), not "whichever
 * order happens to be first in the array" — the old History screen assumed
 * index 0 was always the current order and excluded it by position, which
 * silently mis-sorted the moment orders weren't in that exact order.
 */
import React, { useState, useMemo } from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity, Modal, ScrollView, RefreshControl, TextProps } from 'react-native';
import { Text as BrandText } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKitchen, CartItem, Order } from '../../context/KitchenCoContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Skeleton } from '../../components/Skeleton';
import { useSimulatedLoad } from '../../utils/useSimulatedLoad';
import { ThemeColors } from '../../utils/theme';
import { legacyTypography } from '../../utils/legacyTypography';

// This screen keeps the pre-KitchenCo prototype's RobotoCondensed body type
// instead of the app-wide Montserrat (see legacyTypography.ts) — every
// existing Text usage below picks this up automatically since none set
// their own fontFamily already; the order-id/total headline styles
// (screenSectionTitle, orderId, orderTotal) override back to GotchaGothic,
// matching how the old DeliveryTrackerScreen split the two fonts.
const Text: React.FC<TextProps> = ({ style, ...rest }) => (
  <BrandText style={[{ fontFamily: legacyTypography.body }, style]} {...rest} />
);

/** Weekly (cycle) menu items are id-prefixed "cycle-<week>-<day>-..." — see
 * handleAddCycleItem in (tabs)/index.tsx. That menu only ever shows *today's*
 * meals and rotates admin-side, so an id like "cycle-Week 1-Monday-..." from
 * an old order has no guaranteed relationship to what's actually being cooked
 * today — reordering it verbatim would silently charge a stale price for a
 * dish that may not exist on the current menu at all.
 */
const isCycleMenuItemId = (id: string) => id.startsWith('cycle-');

/**
 * When the day's batch lands in the building. Deliveries are one scheduled
 * drop per site, not a rolling ETA, so this is a fixed published time rather
 * than anything computed per order.
 */
const BATCH_DROP_LABEL = '12:00 PM SAST';

/**
 * The timeline, in order. `status` is the order status that marks this stage
 * reached; `timing` is when it happens in the day, not a live timestamp —
 * orders aren't persisted with per-status transition times yet, so promising
 * an exact clock reading per step would be inventing data.
 */
const TIMELINE_STEPS: {
  status: string;
  title: string;
  icon: string;
  timing: string;
  description: string;
}[] = [
  {
    status: 'pending',
    title: 'Payment Verified',
    icon: 'shield-checkmark',
    timing: 'On checkout',
    description: 'PayFast confirmed your transaction and the meals were booked into the kitchen batch.',
  },
  {
    status: 'preparing',
    // 'flame', not 'restaurant': Ionicons' restaurant glyph is a crossed fork
    // and knife, which at this marker's size reads as an ✕ rather than as food.
    title: 'Kitchen Prepping',
    icon: 'flame',
    timing: 'Morning of delivery',
    description: 'The culinary team is preparing your meals fresh for the day’s drop.',
  },
  {
    status: 'on_the_way',
    title: 'Out for Batch Drop',
    icon: 'cube',
    timing: 'From 11:00',
    description: 'Insulated thermal carriers are dispatched to your building.',
  },
  {
    status: 'delivered',
    title: 'Delivered to Pantry',
    icon: 'checkmark-circle',
    timing: `Arrives ${BATCH_DROP_LABEL}`,
    description: 'Your batch is placed in the designated floor pantry staging area.',
  },
];

export default function TabActivityScreen() {
  const { orders, addToCart, theme, isDark } = useKitchen();
  // A touch of the pre-KitchenCo prototype's warm cream backdrop instead of
  // stark white — light mode only, matching how that palette never carried
  // the warmth into dark mode either. Scoped to this screen's own canvas;
  // cards/surfaces stay on the current theme's colors untouched.
  const screenBackground = isDark ? theme.background : '#F7F2E8';
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { isLoading, refreshing, refresh } = useSimulatedLoad();
  const router = useRouter();
  // In-app modal instead of Alert.alert — Alert is a documented no-op on
  // React Native Web with no polyfill in this project, so it would render
  // nothing there. A real Modal works identically on every platform.
  const [showCantReorder, setShowCantReorder] = useState(false);

  // yyyy-mm-dd for the device's current date — compared against each order's
  // own scheduled delivery date (not when it was placed) to tell a genuinely
  // in-progress order from one that's merely paid-for and waiting its turn.
  const todayISO = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // An order can bundle items pre-scheduled for different delivery dates
  // (multi-day Main Menu ordering); the first dated item stands in for the
  // whole order here, matching the single drop-day label already shown on
  // its card. No dated items at all (an immediate, undated order) is treated
  // as due today — there's no future date to queue it against.
  const getOrderDueISO = (order: Order): string | null =>
    order.items.find((i: CartItem) => i.deliveryDate)?.deliveryDate ?? null;

  const isNonTerminal = (o: Order) => o.status === 'pending' || o.status === 'preparing' || o.status === 'on_the_way';

  // Only an order the kitchen is actually working today gets the full
  // batch-dispatch timeline — one scheduled days or weeks out hasn't started
  // yet, so showing "Kitchen Prepping"/"Out for Batch Drop" as upcoming
  // steps would misrepresent it as already in today's pipeline. Those sit in
  // the queue below instead, with just their payment status shown.
  const activeOrders = useMemo(
    () => orders.filter(o => {
      const due = getOrderDueISO(o);
      return isNonTerminal(o) && (due === null || due === todayISO);
    }),
    [orders, todayISO]
  );
  const queuedOrders = useMemo(
    () => orders.filter(o => {
      const due = getOrderDueISO(o);
      return isNonTerminal(o) && due !== null && due !== todayISO;
    }),
    [orders, todayISO]
  );
  const pastOrders = useMemo(
    () => orders.filter(o => o.status === 'delivered' || o.status === 'cancelled'),
    [orders]
  );

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Order-status colours, drawn from the theme's semantic tokens so they stay
  // legible in both modes and spend colour only where it carries meaning.
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return theme.warning;
      case 'preparing': return theme.textSecondary;
      case 'on_the_way': return theme.info;
      case 'delivered': return theme.success;
      case 'cancelled': return theme.error;
      default: return theme.textTertiary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'Received';
      case 'preparing': return 'Preparing';
      case 'on_the_way': return 'Out for delivery';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const handleReorder = (order: Order) => {
    const hasWeeklyMenuItems = order.items.some(orderItem => isCycleMenuItemId(orderItem.id));
    if (hasWeeklyMenuItems) {
      setShowCantReorder(true);
      return;
    }
    order.items.forEach(orderItem => {
      addToCart({
        id: orderItem.id,
        name: orderItem.name,
        price: orderItem.price,
        category: orderItem.category,
        quantity: orderItem.quantity,
        image: orderItem.image,
        selectedSize: orderItem.selectedSize,
        notes: orderItem.notes,
      });
    });
    router.push('/');
  };

  // Brief shimmer shown for the useSimulatedLoad() initial-load window — a
  // stand-in for the real fetch this screen will eventually make.
  const renderActivitySkeleton = () => (
    <View style={styles.list}>
      <Skeleton theme={theme} style={{ height: 96, borderRadius: 20, marginBottom: 20 }} />
      <Skeleton theme={theme} style={{ height: 220, borderRadius: 24, marginBottom: 28 }} />
      {[0, 1].map(i => (
        <Skeleton key={`activity-skel-${i}`} theme={theme} style={{ height: 160, borderRadius: 20, marginBottom: 12 }} />
      ))}
    </View>
  );

  // The live batch-dispatch timeline card — one per active order, most
  // recent first. Unchanged in substance from the old standalone Orders tab.
  const renderActiveOrderCard = (order: Order) => {
    const currentStatusIndex = TIMELINE_STEPS.findIndex(s => s.status === order.status);
    const isDelivered = order.status === 'delivered';
    // An unrecognised status (older demo data, a status the kitchen adds
    // later) must not silently render every stage as still-to-come — treat
    // it as the first stage reached, which is true of any order that exists.
    const reachedIndex = currentStatusIndex === -1 ? 0 : currentStatusIndex;
    const itemCount = order.items.reduce((sum: number, i: CartItem) => sum + i.quantity, 0);
    const address = order.deliveryAddress;
    const destination = address ? [address.label, address.street].filter(Boolean).join(' · ') : null;
    const dropDayLabel = order.items.find((i: CartItem) => i.deliveryDateLabel)?.deliveryDateLabel ?? order.date;

    return (
      <View key={order.id} style={styles.activeOrderBlock}>
        <View style={styles.orderCard}>
          <View style={styles.orderCardTop}>
            <View style={styles.orderCardLeft}>
              <Text style={styles.orderCaption}>ACTIVE ORDER</Text>
              <Text style={styles.orderId}>{order.id}</Text>
            </View>
            <Text style={styles.orderTotal}>R {order.total.toFixed(2)}</Text>
          </View>
          <View style={styles.paymentBadge}>
            <Ionicons name="shield-checkmark" size={13} color={theme.success} />
            <Text style={styles.paymentBadgeText}>Payment Verified</Text>
          </View>
        </View>

        <View style={styles.timelineCard}>
          <View style={styles.timelineHeader}>
            <View style={styles.timelineHeaderLeft}>
              <Text style={styles.cardSectionTitle}>Batch Dispatch Progress</Text>
              <Text style={styles.timelineDate}>{dropDayLabel}</Text>
            </View>
            <View style={styles.dropPill}>
              <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
              <Text style={styles.dropPillText}>{BATCH_DROP_LABEL}</Text>
            </View>
          </View>

          {TIMELINE_STEPS.map((step, index) => {
            const isDone = index < reachedIndex;
            const isCurrent = index === reachedIndex;
            const isPending = index > reachedIndex;
            const isLast = index === TIMELINE_STEPS.length - 1;

            return (
              <View key={step.status} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View
                    style={[
                      styles.marker,
                      isDone && styles.markerDone,
                      isCurrent && styles.markerCurrent,
                      isPending && styles.markerPending,
                    ]}
                  >
                    <Ionicons
                      name={(isDone ? 'checkmark' : step.icon) as any}
                      size={14}
                      color={isPending ? theme.textTertiary : theme.onAccent}
                    />
                  </View>
                  {!isLast && (
                    <View style={[styles.connector, index < reachedIndex && styles.connectorDone]} />
                  )}
                </View>

                <View style={[styles.timelineBody, isLast && styles.timelineBodyLast]}>
                  <View style={styles.timelineTitleRow}>
                    <Text style={[styles.stepTitle, isPending && styles.stepTitlePending]} numberOfLines={1}>
                      {step.title}
                    </Text>
                    <Text style={styles.stepTiming} numberOfLines={1}>
                      {isDone ? 'Completed' : step.timing}
                    </Text>
                  </View>
                  <Text style={[styles.stepDescription, isPending && styles.stepDescriptionPending]}>
                    {step.description}
                  </Text>
                </View>
              </View>
            );
          })}

          {destination && (
            <View style={styles.destinationRow}>
              <Ionicons name="location" size={14} color={theme.textSecondary} />
              <Text style={styles.destinationText} numberOfLines={2}>
                {isDelivered ? 'Delivered to' : 'Delivering to'} {destination}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.cardSectionTitle}>Meals in this batch</Text>
          <Text style={styles.sectionCount}>{itemCount} {itemCount === 1 ? 'meal' : 'meals'}</Text>
        </View>

        <View style={styles.itemsContainer}>
          {order.items.map((item: CartItem, idx: number) => (
            <View key={item.id || idx} style={styles.itemCard}>
              <View style={styles.itemIconWrap}>
                <Text style={styles.itemEmoji}>🍽️</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.selectedSize && <Text style={styles.itemMeta}>{item.selectedSize}</Text>}
                {item.category && !item.selectedSize && <Text style={styles.itemMeta}>{item.category}</Text>}
                {item.addOns && item.addOns.length > 0 && (
                  <Text style={styles.itemMeta}>+ {item.addOns.map(a => a.name).join(', ')}</Text>
                )}
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
                <Text style={styles.itemPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>R {order.totalPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            {order.deliveryFee ? (
              <Text style={styles.summaryValue}>R {order.deliveryFee.toFixed(2)}</Text>
            ) : (
              <Text style={[styles.summaryValue, styles.summaryFree]}>Free</Text>
            )}
          </View>
          {order.discountAmount ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={[styles.summaryValue, styles.summaryFree]}>- R {order.discountAmount.toFixed(2)}</Text>
            </View>
          ) : null}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>R {order.total.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    );
  };

  // A paid order scheduled for a date the kitchen hasn't reached yet — same
  // item/summary layout as an active order, but with the batch-dispatch
  // timeline swapped for a single "queued, payment verified" notice instead
  // of implying it's already somewhere in today's prep-to-drop pipeline.
  const renderQueuedOrderCard = (order: Order) => {
    const itemCount = order.items.reduce((sum: number, i: CartItem) => sum + i.quantity, 0);
    const address = order.deliveryAddress;
    const destination = address ? [address.label, address.street].filter(Boolean).join(' · ') : null;
    const dropDayLabel = order.items.find((i: CartItem) => i.deliveryDateLabel)?.deliveryDateLabel ?? order.date;

    return (
      <View key={order.id} style={styles.activeOrderBlock}>
        <View style={styles.orderCard}>
          <View style={styles.orderCardTop}>
            <View style={styles.orderCardLeft}>
              <Text style={styles.orderCaption}>QUEUED ORDER</Text>
              <Text style={styles.orderId}>{order.id}</Text>
            </View>
            <Text style={styles.orderTotal}>R {order.total.toFixed(2)}</Text>
          </View>
          <View style={styles.paymentBadge}>
            <Ionicons name="shield-checkmark" size={13} color={theme.success} />
            <Text style={styles.paymentBadgeText}>Payment Verified</Text>
          </View>
          <View style={styles.queuedDateRow}>
            <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} />
            <Text style={styles.queuedDateText}>Scheduled for {dropDayLabel}</Text>
          </View>
          {destination && (
            <View style={styles.destinationRow}>
              <Ionicons name="location" size={14} color={theme.textSecondary} />
              <Text style={styles.destinationText} numberOfLines={2}>
                Delivering to {destination}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.cardSectionTitle}>Meals in this order</Text>
          <Text style={styles.sectionCount}>{itemCount} {itemCount === 1 ? 'meal' : 'meals'}</Text>
        </View>

        <View style={styles.itemsContainer}>
          {order.items.map((item: CartItem, idx: number) => (
            <View key={item.id || idx} style={styles.itemCard}>
              <View style={styles.itemIconWrap}>
                <Text style={styles.itemEmoji}>🍽️</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.selectedSize && <Text style={styles.itemMeta}>{item.selectedSize}</Text>}
                {item.category && !item.selectedSize && <Text style={styles.itemMeta}>{item.category}</Text>}
                {item.addOns && item.addOns.length > 0 && (
                  <Text style={styles.itemMeta}>+ {item.addOns.map(a => a.name).join(', ')}</Text>
                )}
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
                <Text style={styles.itemPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>R {order.totalPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            {order.deliveryFee ? (
              <Text style={styles.summaryValue}>R {order.deliveryFee.toFixed(2)}</Text>
            ) : (
              <Text style={[styles.summaryValue, styles.summaryFree]}>Free</Text>
            )}
          </View>
          {order.discountAmount ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={[styles.summaryValue, styles.summaryFree]}>- R {order.discountAmount.toFixed(2)}</Text>
            </View>
          ) : null}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>R {order.total.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    );
  };

  // The compact past-order card — unchanged from the old standalone History tab.
  const renderPastOrderCard = (item: Order) => {
    const statusColor = getStatusColor(item.status);
    const hasWeeklyMenuItems = item.items.some(orderItem => isCycleMenuItemId(orderItem.id));
    const itemCountTotal = item.items.reduce((sum, dish) => sum + dish.quantity, 0);
    const reorderLabel = hasWeeklyMenuItems
      ? `Reorder unavailable for order ${item.id}, includes Weekly Menu items`
      : `Reorder ${itemCountTotal} item${itemCountTotal !== 1 ? 's' : ''} from order ${item.id}`;

    return (
      <View key={item.id} style={styles.pastOrderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderIdContainer}>
            <Text style={styles.orderId}>{item.id}</Text>
            <Text style={styles.orderDate}>{formatDate(item.timestamp)}</Text>
          </View>
          <View style={styles.orderTotalContainer}>
            <Text style={styles.orderTotal}>R {item.total.toFixed(2)}</Text>
            <View style={styles.itemCount}>
              <Text style={styles.itemCountText}>{itemCountTotal} items</Text>
            </View>
          </View>
        </View>

        <View style={styles.itemsPreview}>
          {item.items.slice(0, 3).map((dish, idx) => (
            <View key={dish.id || idx} style={styles.itemChip}>
              <Text style={styles.itemChipText}>{dish.quantity}x {dish.name}</Text>
            </View>
          ))}
          {item.items.length > 3 && (
            <View style={styles.moreChip}>
              <Text style={styles.moreChipText}>+{item.items.length - 3} more</Text>
            </View>
          )}
        </View>

        {item.deliveryAddress && (
          <View style={styles.addressSection}>
            <View style={styles.addressIconWrap}>
              <Text style={styles.addressIcon}>📍</Text>
            </View>
            <View style={styles.addressDetails}>
              <Text style={styles.addressLabel}>{item.deliveryAddress.label}</Text>
              <Text style={styles.addressText}>{item.deliveryAddress.street}, {item.deliveryAddress.suburb}</Text>
              <Text style={styles.addressText}>{item.deliveryAddress.city}, {item.deliveryAddress.code}</Text>
            </View>
          </View>
        )}

        <View style={styles.orderFooter}>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{getStatusLabel(item.status)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.reorderBtn, hasWeeklyMenuItems && styles.reorderBtnDisabled]}
            onPress={() => handleReorder(item)}
            activeOpacity={hasWeeklyMenuItems ? 1 : 0.7}
            accessibilityRole="button"
            accessibilityLabel={reorderLabel}
            accessibilityState={{ disabled: hasWeeklyMenuItems }}
          >
            <Text style={[styles.reorderBtnText, hasWeeklyMenuItems && styles.reorderBtnTextDisabled]}>
              Reorder
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: screenBackground }]}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={screenBackground} />

      {isLoading ? (
        <ScrollView contentContainerStyle={styles.list}>{renderActivitySkeleton()}</ScrollView>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySubtitle}>
            Start ordering delicious meals and they'll appear here
          </Text>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => router.push('/')}
            accessibilityRole="button"
            accessibilityLabel="Browse Menu"
          >
            <Text style={styles.menuBtnText}>Browse Menu</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.text} colors={[theme.text]} />}
        >
          {activeOrders.length > 0 && (
            <>
              <Text style={styles.screenSectionTitle}>Active Orders</Text>
              <Text style={styles.screenSectionSub}>Batch drop at {BATCH_DROP_LABEL}</Text>
              {activeOrders.map(renderActiveOrderCard)}
            </>
          )}

          {queuedOrders.length > 0 && (
            <>
              <Text style={[styles.screenSectionTitle, activeOrders.length > 0 && styles.screenSectionTitleSpaced]}>
                Order Queue
              </Text>
              <Text style={styles.screenSectionSub}>Paid and waiting for their scheduled delivery day</Text>
              {queuedOrders.map(renderQueuedOrderCard)}
            </>
          )}

          {pastOrders.length > 0 && (
            <>
              <Text style={[styles.screenSectionTitle, (activeOrders.length > 0 || queuedOrders.length > 0) && styles.screenSectionTitleSpaced]}>
                Order History
              </Text>
              {pastOrders.map(renderPastOrderCard)}
            </>
          )}
        </ScrollView>
      )}

      <Modal
        visible={showCantReorder}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCantReorder(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.explainCard}>
            <Text style={styles.explainIcon}>📅</Text>
            <Text style={styles.explainTitle}>Can't reorder directly</Text>
            <Text style={styles.explainText}>
              This order includes items from the Weekly Menu, which changes every day.
              Visit Today's Menu to order today's equivalent instead.
            </Text>
            <TouchableOpacity
              style={styles.explainBtn}
              onPress={() => setShowCantReorder(false)}
              accessibilityRole="button"
              accessibilityLabel="Got it, dismiss"
            >
              <Text style={styles.explainBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  menuBtn: { backgroundColor: theme.accent, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  menuBtnText: { color: theme.onAccent, fontWeight: '800', fontSize: 15 },

  list: { padding: 16, paddingBottom: 20 },

  screenSectionTitle: { fontFamily: legacyTypography.heading, fontSize: 20, fontWeight: '800', color: theme.text, letterSpacing: -0.4 },
  screenSectionTitleSpaced: { marginTop: 8 },
  screenSectionSub: { fontSize: 12, color: theme.textSecondary, marginTop: 3, marginBottom: 18 },

  activeOrderBlock: { marginBottom: 8 },

  // Active order strip
  orderCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  orderCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderCardLeft: { flex: 1, paddingRight: 12 },
  orderCaption: { fontSize: 10, fontWeight: '800', color: theme.textTertiary, letterSpacing: 1.1 },
  orderId: { fontFamily: legacyTypography.heading, fontSize: 14, fontWeight: '800', color: theme.text, marginTop: 4, letterSpacing: -0.2 },
  orderTotal: { fontFamily: legacyTypography.heading, fontSize: 17, fontWeight: '900', color: theme.text, letterSpacing: -0.4 },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  paymentBadgeText: { fontSize: 11, fontWeight: '700', color: theme.success },
  queuedDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  queuedDateText: { fontSize: 11, fontWeight: '600', color: theme.textSecondary },

  // Timeline
  timelineCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  timelineHeaderLeft: { flex: 1, paddingRight: 10 },
  timelineDate: { fontSize: 13, fontWeight: '700', color: theme.text, marginTop: 4 },
  dropPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dropPillText: { fontSize: 10, fontWeight: '700', color: theme.textSecondary },

  timelineRow: { flexDirection: 'row' },
  timelineRail: { width: 26, alignItems: 'center' },
  marker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  markerDone: { backgroundColor: theme.accent, borderColor: theme.accent },
  markerCurrent: { backgroundColor: theme.accent, borderColor: theme.accent },
  markerPending: { backgroundColor: theme.surface, borderColor: theme.border },
  connector: { flex: 1, width: 2, backgroundColor: theme.border, marginVertical: 4 },
  connectorDone: { backgroundColor: theme.accent },

  timelineBody: { flex: 1, paddingLeft: 14, paddingBottom: 22 },
  timelineBodyLast: { paddingBottom: 0 },
  timelineTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  stepTitle: { flexShrink: 1, fontSize: 14, fontWeight: '800', color: theme.text, letterSpacing: -0.2 },
  stepTitlePending: { color: theme.textTertiary },
  stepTiming: { fontSize: 10, fontWeight: '600', color: theme.textTertiary },
  stepDescription: { fontSize: 12, color: theme.textSecondary, lineHeight: 17, marginTop: 4 },
  stepDescriptionPending: { color: theme.textTertiary },

  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  destinationText: { flex: 1, fontSize: 12, color: theme.textSecondary, fontWeight: '600' },

  // Section Headers (inside an active order's card stack)
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  cardSectionTitle: { fontSize: 13, fontWeight: '800', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCount: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },

  // Items (active order)
  itemsContainer: { marginBottom: 20 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  itemIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surfaceSecondary, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1, borderColor: theme.border },
  itemEmoji: { fontSize: 20 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 3 },
  itemMeta: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  itemRight: { alignItems: 'flex-end' },
  itemQty: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
  itemPrice: { fontSize: 14, fontWeight: '800', color: theme.text, marginTop: 2 },

  // Summary (active order)
  summaryCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
  summaryValue: { fontSize: 14, color: theme.text, fontWeight: '600', letterSpacing: -0.2 },
  summaryFree: { color: theme.success, fontWeight: '700' },
  summaryDivider: { height: 1, backgroundColor: theme.border, marginVertical: 14 },
  summaryTotalLabel: { fontSize: 15, fontWeight: '800', color: theme.text, letterSpacing: -0.3 },
  summaryTotalValue: { fontSize: 18, fontWeight: '900', color: theme.text, letterSpacing: -0.4 },

  // Past order card
  pastOrderCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  orderIdContainer: { flex: 1 },
  orderDate: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  orderTotalContainer: { alignItems: 'flex-end' },
  itemCount: { backgroundColor: theme.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
  itemCountText: { fontSize: 11, color: theme.textSecondary, fontWeight: '600' },

  itemsPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  itemChip: {
    backgroundColor: theme.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border
  },
  itemChipText: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  moreChip: {
    backgroundColor: theme.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  moreChipText: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },

  // Address Section
  addressSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  addressIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  addressIcon: { fontSize: 18 },
  addressDetails: { flex: 1 },
  addressLabel: { fontSize: 13, fontWeight: '800', color: theme.text, marginBottom: 3 },
  addressText: { fontSize: 12, color: theme.textSecondary, fontWeight: '500', lineHeight: 16 },

  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.success, marginRight: 6 },
  statusText: { fontSize: 12, color: theme.text, fontWeight: '700', textTransform: 'capitalize' },
  reorderBtn: { backgroundColor: theme.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  reorderBtnText: { color: theme.onAccent, fontSize: 13, fontWeight: '800' },
  reorderBtnDisabled: { backgroundColor: theme.border, shadowOpacity: 0, elevation: 0 },
  reorderBtnTextDisabled: { color: theme.textSecondary },

  modalOverlay: { flex: 1, backgroundColor: theme.modalOverlay, justifyContent: 'center', alignItems: 'center' },
  explainCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 32,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  explainIcon: { fontSize: 36, marginBottom: 12 },
  explainTitle: { fontSize: 18, fontWeight: '900', color: theme.text, marginBottom: 8, textAlign: 'center' },
  explainText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  explainBtn: { backgroundColor: theme.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, alignSelf: 'stretch', alignItems: 'center' },
  explainBtnText: { color: theme.onAccent, fontSize: 15, fontWeight: '800' },
});

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
import { View, StyleSheet, StatusBar, TouchableOpacity, Modal, ScrollView, RefreshControl, TextProps, TextInputProps } from 'react-native';
import { Text as BrandText, TextInput as BrandTextInput } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKitchen, CartItem, Order } from '../../context/KitchenCoContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Skeleton } from '../../components/Skeleton';
import { RatingBar } from '../../components/RatingBar';
import { TaxInvoiceModal } from '../../components/TaxInvoiceModal';
import { DisputeModal } from '../../components/DisputeModal';
import { presentOrder } from '../../utils/orderPresentation';
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

/** Same treatment for the rating feedback field, so it matches the body type
 *  around it rather than falling back to the app-wide Montserrat. */
const TextInput: React.FC<TextInputProps> = ({ style, ...rest }) => (
  <BrandTextInput style={[{ fontFamily: legacyTypography.body }, style]} {...rest} />
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

export default function TabOrdersScreen() {
  const { orders, addToCart, theme, isDark, user, submitOrderRating, reportOrderNonDelivery } = useKitchen();
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


  // Order-status colours, drawn from the theme's semantic tokens so they stay
  // legible in both modes and spend colour only where it carries meaning.
  // Post-delivery actions on a history card, ported from JoTsav/kicthenCoV1
  // main's OrderHistoryScreen: a tax invoice sheet, a star rating with
  // optional feedback, and a non-delivery escalation.
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [disputeOrder, setDisputeOrder] = useState<Order | null>(null);
  const [draftRatings, setDraftRatings] = useState<Record<string, number>>({});
  const [draftFeedbacks, setDraftFeedbacks] = useState<Record<string, string>>({});

  const handleRatingSubmit = (orderId: string) => {
    const stars = draftRatings[orderId] || 0;
    if (stars === 0) return;
    submitOrderRating(orderId, stars, draftFeedbacks[orderId]);
    setDraftRatings(prev => { const next = { ...prev }; delete next[orderId]; return next; });
    setDraftFeedbacks(prev => { const next = { ...prev }; delete next[orderId]; return next; });
  };

  /**
   * Status pill config, his shape mapped onto our status vocabulary. A logged
   * dispute wins over the order's own status: `dispute` is per-order, whereas
   * `status` is shared across a company+day batch (see reportOrderNonDelivery
   * in KitchenCoContext), so the batch status cannot represent one employee's
   * missing meal.
   */
  const getStatusBadge = (order: Order) => {
    if (order.dispute) {
      return { label: 'Unfulfilled / Disputed', color: theme.error, icon: 'alert-circle-outline' as const };
    }
    switch (order.status.toLowerCase()) {
      case 'pending': return { label: 'Paid / Scheduled', color: theme.warning, icon: 'calendar-outline' as const };
      case 'preparing': return { label: 'Kitchen Prepping', color: theme.textSecondary, icon: 'restaurant-outline' as const };
      case 'on_the_way': return { label: 'Out for Batch Drop', color: theme.info, icon: 'car-outline' as const };
      case 'delivered': return { label: 'Delivered', color: theme.success, icon: 'checkmark-circle-outline' as const };
      case 'cancelled': return { label: 'Cancelled', color: theme.error, icon: 'close-circle-outline' as const };
      default: return { label: getStatusLabel(order.status), color: theme.textTertiary, icon: 'time-outline' as const };
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
  /**
   * Order history card, ported from JoTsav/kicthenCoV1 main's
   * OrderHistoryScreen: reference + date/slot line, status pill, location
   * strip, priced line items, allergy tag, total paid, tax invoice, and the
   * post-delivery rating / report-issue block. His per-order display fields
   * come from presentOrder() since our Order does not store them.
   */
  const renderPastOrderCard = (item: Order) => {
    const view = presentOrder(item);
    const badge = getStatusBadge(item);
    const isDelivered = item.status === 'delivered';
    const isDisputed = Boolean(item.dispute);
    // While support is still tracing a missing meal, don't ask the customer to
    // rate it — they have just told us it never arrived. The reference build
    // got this for free because its dispute flipped status to 'unfulfilled';
    // ours can't (status is batch-shared, see reportOrderNonDelivery), so the
    // rating block is gated explicitly. Once the ticket is resolved or
    // refunded the prompt returns, since by then there is something to rate.
    const disputeOpen = item.dispute?.status === 'investigating';
    const hasRating = Boolean(item.rating);
    const activeStar = draftRatings[item.id] ?? item.rating?.rating ?? 0;
    const allergyNote = item.items.find(i => i.notes)?.notes;

    const hasWeeklyMenuItems = item.items.some(orderItem => isCycleMenuItemId(orderItem.id));
    const itemCountTotal = item.items.reduce((sum, dish) => sum + dish.quantity, 0);
    const reorderLabel = hasWeeklyMenuItems
      ? `Reorder unavailable for order ${item.id}, includes Weekly Menu items`
      : `Reorder ${itemCountTotal} item${itemCountTotal !== 1 ? 's' : ''} from order ${item.id}`;

    return (
      <View key={item.id} style={[styles.historyCard, isDisputed && styles.historyCardDisputed]}>
        {/* Header row: reference + scheduled drop, status pill */}
        <View style={styles.cardHeader}>
          <View style={styles.orderRefCol}>
            <Text style={styles.orderRefText}>{view.orderNumber}</Text>
            <Text style={styles.deliveryDateBadge}>
              {view.deliveryDateFormatted} • {view.deliverySlot}
            </Text>
          </View>
          <View style={[styles.statusPill, { borderColor: badge.color }]}>
            <Ionicons name={badge.icon} size={12} color={badge.color} />
            <Text style={[styles.statusPillText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Drop-off location */}
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={theme.textSecondary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {view.companyLocation} • {view.deliveryFloor}
          </Text>
        </View>

        {/* Priced line items */}
        <View style={styles.itemsSummary}>
          {item.items.map((dish, idx) => (
            <View key={dish.id || idx} style={styles.itemRow}>
              <Text style={styles.itemText} numberOfLines={2}>
                {dish.quantity}x {dish.name}{dish.selectedSize ? ` (${dish.selectedSize})` : ''}
                {dish.addOns && dish.addOns.length > 0 ? ` (+${dish.addOns.map(a => a.name).join(', ')})` : ''}
              </Text>
              <Text style={styles.itemPriceText}>R {(dish.price * dish.quantity).toFixed(2)}</Text>
            </View>
          ))}
          {allergyNote ? (
            <View style={styles.allergyNoteTag}>
              <Ionicons name="alert-circle" size={12} color={theme.warning} />
              <Text style={styles.allergyNoteText}>[Note: {allergyNote}]</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardDivider} />

        {/* Total paid */}
        <View style={styles.financeRow}>
          <View>
            <Text style={styles.financeLabel}>Total Paid</Text>
            <Text style={styles.financeAmount}>R {view.totalPaid.toFixed(2)}</Text>
          </View>
        </View>

        {/* Invoice + reorder. Reorder is ours, not his — it is existing working
            functionality, so it sits beside the invoice button in his button
            style rather than being dropped. */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSelectedInvoiceOrder(item)}
            style={styles.cardActionBtn}
            accessibilityRole="button"
            accessibilityLabel={`Tax invoice for order ${item.id}`}
          >
            <Ionicons name="document-text-outline" size={15} color={theme.text} />
            <Text style={styles.cardActionText}>Tax Invoice (PDF)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cardActionBtn, hasWeeklyMenuItems && styles.cardActionBtnDisabled]}
            onPress={() => handleReorder(item)}
            activeOpacity={hasWeeklyMenuItems ? 1 : 0.8}
            accessibilityRole="button"
            accessibilityLabel={reorderLabel}
            accessibilityState={{ disabled: hasWeeklyMenuItems }}
          >
            <Ionicons name="repeat" size={15} color={hasWeeklyMenuItems ? theme.textTertiary : theme.text} />
            <Text style={[styles.cardActionText, hasWeeklyMenuItems && styles.cardActionTextDisabled]}>
              Reorder
            </Text>
          </TouchableOpacity>
        </View>

        {/* Logged non-delivery ticket */}
        {isDisputed && item.dispute && (
          <View style={styles.disputeBanner}>
            <Ionicons name="warning" size={16} color={theme.error} />
            <View style={styles.disputeTextCol}>
              <Text style={styles.disputeTitle}>
                Non-Delivery Ticket: {item.dispute.supportTicketRef}
              </Text>
              <Text style={styles.disputeStatus}>
                Status: Kitchen Support Desk is reviewing the batch manifest.
              </Text>
            </View>
          </View>
        )}

        {/* Post-delivery block — only once the meal has actually landed. An
            open ticket suppresses the *prompt* (don't ask someone to rate a
            meal they just reported missing) but never hides a rating they had
            already submitted: that is their data, not a question. */}
        {isDelivered && (hasRating || !disputeOpen) && (
          <View style={styles.ratingSection}>
            {hasRating ? (
              <View style={styles.ratedContainer}>
                <View style={styles.ratedHeader}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                  <Text style={styles.ratedTitle}>Your Rating ({item.rating?.rating} / 5 Stars)</Text>
                </View>
                <RatingBar rating={item.rating!.rating} readOnly size={20} />
                {item.rating?.feedback ? (
                  <Text style={styles.ratedFeedback}>"{item.rating.feedback}"</Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.unratedContainer}>
                <Text style={styles.ratingPromptTitle}>
                  How was your meal drop on {view.deliveryDateFormatted}?
                </Text>
                <RatingBar
                  rating={activeStar}
                  onRatingChange={(newStar) => setDraftRatings(prev => ({ ...prev, [item.id]: newStar }))}
                  size={26}
                />

                {activeStar > 0 && (
                  <TextInput
                    style={styles.feedbackInput}
                    placeholder="Optional culinary feedback for Chef..."
                    placeholderTextColor={theme.textTertiary}
                    value={draftFeedbacks[item.id] || ''}
                    onChangeText={(txt) => setDraftFeedbacks(prev => ({ ...prev, [item.id]: txt }))}
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                    accessibilityLabel="Feedback for the chef"
                  />
                )}

                {activeStar > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleRatingSubmit(item.id)}
                    style={styles.submitRatingBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Submit rating"
                  >
                    <Text style={styles.submitRatingBtnText}>Submit Rating</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {!isDisputed && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setDisputeOrder(item)}
                style={styles.escalateButton}
                accessibilityRole="button"
                accessibilityLabel={`Report an issue with order ${item.id}`}
              >
                <Ionicons name="alert-circle-outline" size={14} color={theme.error} />
                <Text style={styles.escalateButtonText}>Food Not Delivered / Report Issue</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      // This screen renders its own header bar (headerShown is false for the
      // Orders tab), so unlike Menu/Profile it owns the top inset. The tab bar
      // still owns the bottom one.
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: screenBackground }]}
    >
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={screenBackground} />

      {/* Header bar, ported from his OrderHistoryScreen: stacked title +
          subtitle on the left, circular jump-to-menu button on the right. */}
      <View style={styles.headerBar}>
        <View style={styles.headerTextCol}>
          {/* His header bar verbatim, but titled for what this page actually
              holds. His Orders screen is history-only (live tracking is a
              separate DeliveryTrackerScreen in his app); ours keeps the batch
              tracker on this same tab, so his literal "Order History &
              Invoices" would name only the bottom half of the page. */}
          <Text style={styles.headerBarTitle}>Orders &amp; Invoices</Text>
          <Text style={styles.headerBarSubtitle}>Live batch tracking, past orders and tax records</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/')}
          style={styles.headerMenuBtn}
          accessibilityRole="button"
          accessibilityLabel="Browse the menu"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="restaurant-outline" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ScrollView contentContainerStyle={styles.list}>{renderActivitySkeleton()}</ScrollView>
      ) : orders.length === 0 ? (
        <View style={styles.emptyOuter}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="clipboard-outline" size={48} color={theme.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No Past Orders Yet</Text>
            <Text style={styles.emptySubtitle}>
              Scheduled orders for your upcoming corporate lunches will appear here.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.browseBtn}
              onPress={() => router.push('/')}
              accessibilityRole="button"
              accessibilityLabel="Browse Menu"
            >
              <Text style={styles.browseBtnText}>Browse the Menu →</Text>
            </TouchableOpacity>
          </View>
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

      <TaxInvoiceModal
        visible={Boolean(selectedInvoiceOrder)}
        order={selectedInvoiceOrder}
        onClose={() => setSelectedInvoiceOrder(null)}
      />

      <DisputeModal
        visible={Boolean(disputeOrder)}
        order={disputeOrder}
        userEmail={user?.email || ''}
        userName={user?.name || 'Customer'}
        onClose={() => setDisputeOrder(null)}
        onConfirmDispute={reportOrderNonDelivery}
      />

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

  // --- Ported from JoTsav/kicthenCoV1 main's OrderHistoryScreen -------------
  // His values, with colours mapped onto our black-and-white palette: he
  // paints amounts and section headings in theme.primary (a blue), which here
  // is theme.text — colour stays reserved for status (see src/utils/theme.ts).
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTextCol: { flex: 1, paddingRight: 12 },
  headerBarTitle: { fontFamily: legacyTypography.heading, fontSize: 20, fontWeight: '800', color: theme.text, letterSpacing: -0.4 },
  headerBarSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, color: theme.textSecondary },
  headerMenuBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
  },

  historyCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    marginBottom: 16,
    gap: 10,
  },
  historyCardDisputed: { borderColor: theme.error },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  orderRefCol: { flex: 1, paddingRight: 8 },
  orderRefText: { fontFamily: legacyTypography.heading, fontSize: 15, fontWeight: '800', color: theme.text },
  deliveryDateBadge: { fontSize: 12, fontWeight: '600', marginTop: 2, color: theme.textSecondary },
  // Outlined rather than his tinted fill: our palette has no per-status
  // surface tokens, and an outline keeps the status colour readable in both
  // light and dark without inventing eight new tints.
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, flexShrink: 1,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: theme.surfaceSecondary,
  },
  locationText: { fontSize: 11, fontWeight: '600', flex: 1, color: theme.textSecondary },

  itemsSummary: { gap: 4, marginVertical: 2 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  itemText: { fontSize: 13, fontWeight: '600', color: theme.text, flex: 1 },
  itemPriceText: { fontSize: 12, fontWeight: '500', color: theme.textSecondary },
  allergyNoteTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    marginTop: 2, alignSelf: 'flex-start', backgroundColor: theme.surfaceSecondary,
  },
  allergyNoteText: { fontSize: 10, fontWeight: '600', fontStyle: 'italic', color: theme.warning },

  cardDivider: { height: 1, backgroundColor: theme.border },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  financeLabel: { fontSize: 11, fontWeight: '500', color: theme.textSecondary },
  financeAmount: { fontFamily: legacyTypography.heading, fontSize: 17, fontWeight: '800', color: theme.text },

  cardActionsRow: { flexDirection: 'row', gap: 8 },
  cardActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 12, minHeight: 44, borderRadius: 10,
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceSecondary,
  },
  cardActionBtnDisabled: { opacity: 0.5 },
  cardActionText: { fontSize: 12, fontWeight: '700', color: theme.text },
  cardActionTextDisabled: { color: theme.textTertiary },

  disputeBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 10, borderRadius: 10, borderWidth: 1,
    borderColor: theme.error, backgroundColor: theme.surfaceSecondary,
  },
  disputeTextCol: { flex: 1 },
  disputeTitle: { fontSize: 12, fontWeight: '700', color: theme.error },
  disputeStatus: { fontSize: 11, marginTop: 2, color: theme.textSecondary },

  ratingSection: {
    borderRadius: 14, padding: 12, borderWidth: 1, gap: 8, marginTop: 4,
    borderColor: theme.border, backgroundColor: theme.surfaceSecondary,
  },
  ratedContainer: { alignItems: 'center', gap: 6, paddingVertical: 4 },
  ratedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratedTitle: { fontSize: 13, fontWeight: '700', color: theme.text },
  ratedFeedback: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', color: theme.textSecondary },
  unratedContainer: { alignItems: 'center', gap: 8 },
  ratingPromptTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center', color: theme.text },
  feedbackInput: {
    width: '100%', borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 12, minHeight: 50,
    backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text,
  },
  submitRatingBtn: {
    paddingHorizontal: 20, minHeight: 44, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent,
  },
  submitRatingBtnText: { fontSize: 12, fontWeight: '700', color: theme.onAccent },
  escalateButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, borderRadius: 8, borderWidth: 1, marginTop: 4, borderColor: theme.error,
  },
  escalateButtonText: { fontSize: 12, fontWeight: '700', color: theme.error },

  emptyOuter: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  emptyCard: {
    borderRadius: 20, padding: 32, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 10,
    borderColor: theme.border, backgroundColor: theme.surface,
  },
  emptyIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    backgroundColor: theme.surfaceSecondary,
  },
  browseBtn: {
    paddingHorizontal: 20, minHeight: 44, borderRadius: 12, marginTop: 10,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent,
  },
  browseBtnText: { fontSize: 14, fontWeight: '800', color: theme.onAccent },

  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },

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


  // Address Section


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

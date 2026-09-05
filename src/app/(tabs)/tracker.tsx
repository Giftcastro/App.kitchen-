import React, { useMemo } from 'react';
import { StyleSheet, View, ScrollView, StatusBar, RefreshControl } from 'react-native';
import { Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKitchen, CartItem } from '../../context/KitchenCoContext';
import { Ionicons } from '@expo/vector-icons';
import { Skeleton } from '../../components/Skeleton';
import { useSimulatedLoad } from '../../utils/useSimulatedLoad';
import { ThemeColors } from '../../utils/theme';

export default function TrackerScreen() {
  const { orders, theme } = useKitchen();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { isLoading, refreshing, refresh } = useSimulatedLoad();
  // Find the most recent active order (pending, preparing, or on_the_way) or fallback to most recent
  const currentOrder = orders.find(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'on_the_way') || orders[0] || null;

  // Brief shimmer shown for the useSimulatedLoad() initial-load window — a
  // stand-in for the real fetch this screen will eventually make.
  const renderTrackerSkeleton = () => (
    <>
      <Skeleton theme={theme} style={{ width: 140, height: 12, borderRadius: 6, marginBottom: 12, marginTop: 4 }} />
      <Skeleton theme={theme} style={{ height: 180, borderRadius: 24, marginBottom: 28 }} />
      <Skeleton theme={theme} style={{ width: 120, height: 14, borderRadius: 6, marginBottom: 12 }} />
      <Skeleton theme={theme} style={{ height: 72, borderRadius: 16, marginBottom: 10 }} />
      <Skeleton theme={theme} style={{ height: 72, borderRadius: 16, marginBottom: 10 }} />
      <Skeleton theme={theme} style={{ height: 140, borderRadius: 20 }} />
    </>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {renderTrackerSkeleton()}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!currentOrder) {
    return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
                <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.text} colors={[theme.text]} />
          }
        >
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="receipt-outline" size={48} color={theme.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No active order</Text>
            <Text style={styles.emptySubtitle}>
              When you place an order, you can track its preparation and delivery status here in real-time
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Status flow: pending -> preparing -> on_the_way -> delivered
  const statusFlow = ['pending', 'preparing', 'on_the_way', 'delivered'];
  const currentStatusIndex = statusFlow.indexOf(currentOrder.status);
  const isDelivered = currentOrder.status === 'delivered';

  const getTrackerHeader = () => {
    switch (currentOrder.status) {
      case 'pending':
        return { icon: 'time-outline', title: 'Received', sub: 'Waiting for the kitchen to accept...' };
      case 'preparing':
        return { icon: 'restaurant', title: 'In the Kitchen', sub: 'Estimated 15-20 mins' };
      case 'on_the_way':
        return { icon: 'bicycle', title: 'Out for delivery', sub: 'Your driver is en route' };
      case 'delivered':
        return { icon: 'checkmark-circle', title: 'Delivered', sub: 'Enjoy your meal!' };
      default:
        return { icon: 'restaurant', title: 'In the Kitchen', sub: 'Estimated 15-20 mins' };
    }
  };

  const trackerHeader = getTrackerHeader();

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStatusIndex) return 'completed';
    if (stepIndex === currentStatusIndex) return 'active';
    return 'inactive';
  };

  const getStepIcon = (stepIndex: number) => {
    const s = getStepStatus(stepIndex);
    if (s === 'completed') return 'checkmark';
    if (s === 'active') {
      switch (stepIndex) {
        case 0: return 'time';
        case 1: return 'restaurant';
        case 2: return 'bicycle';
        case 3: return 'checkmark-circle';
        default: return 'ellipse';
      }
    }
    return 'ellipse-outline';
  };

  const getProgressWidth = (): number => {
    if (currentStatusIndex <= 0) return 0;
    return ((currentStatusIndex) / (statusFlow.length - 1)) * 100;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
            <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.text} colors={[theme.text]} />
        }
      >
        <Text style={styles.orderIdCaption}>ORDER · {currentOrder.id}</Text>

        {/* Modern Order Tracker Card */}
        <View style={styles.trackerCard}>
          <View style={styles.trackerHeader}>
            <View style={[styles.trackerIconWrap, isDelivered && styles.trackerIconWrapDelivered]}>
              <Ionicons name={trackerHeader.icon as any} size={24} color={theme.text} />
            </View>
            <View style={styles.trackerHeaderText}>
              <Text style={styles.trackerTitle}>{trackerHeader.title}</Text>
              <Text style={styles.trackerSub}>{trackerHeader.sub}</Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${getProgressWidth()}%` as any }, isDelivered && styles.progressFillDelivered]} />
            </View>
          </View>

          <View style={styles.stepsContainer}>
            {statusFlow.map((status, index) => {
              const stepStatus = getStepStatus(index);
              const isCompleted = stepStatus === 'completed';
              const isActive = stepStatus === 'active';
              const isInactive = stepStatus === 'inactive';
              return (
                <View key={status} style={[styles.step, (isCompleted || isActive) && styles.stepCompleted]}>
                  <View style={[styles.stepIconWrap, isActive && styles.stepActiveWrap, isCompleted && styles.stepCompletedWrap, isDelivered && index === statusFlow.length - 1 && styles.stepDeliveredWrap]}>
                    <Ionicons
                      name={getStepIcon(index) as any}
                      size={16}
                      color={isInactive ? theme.textSecondary : theme.text}
                    />
                  </View>
                                    <Text style={[styles.stepLabel, isInactive && styles.stepLabelInactive]} numberOfLines={1}>
                    {status === 'pending'
                      ? 'Received'
                      : status === 'preparing'
                        ? 'Preparing'
                        : status === 'on_the_way'
                          ? 'Out for delivery'
                          : 'Delivered'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Items Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Items</Text>
          <Text style={styles.sectionCount}>{currentOrder.items.length} items</Text>
        </View>

        <View style={styles.itemsContainer}>
          {currentOrder.items.map((item: CartItem, idx: number) => (
            <View key={item.id || idx} style={styles.itemCard}>
              <View style={styles.itemIconWrap}>
                <Text style={styles.itemEmoji}>🍽️</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.selectedSize && (
                  <Text style={styles.itemMeta}>{item.selectedSize}</Text>
                )}
                {item.category && !item.selectedSize && (
                  <Text style={styles.itemMeta}>{item.category}</Text>
                )}
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

        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>R {currentOrder.totalPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            {currentOrder.deliveryFee ? (
              <Text style={styles.summaryValue}>R {currentOrder.deliveryFee.toFixed(2)}</Text>
            ) : (
              <Text style={[styles.summaryValue, styles.summaryFree]}>Free</Text>
            )}
          </View>
          {currentOrder.discountAmount ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={[styles.summaryValue, styles.summaryFree]}>- R {currentOrder.discountAmount.toFixed(2)}</Text>
            </View>
          ) : null}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>R {currentOrder.total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollContent: { padding: 16, paddingBottom: 32 },

  // Delivered/active/completed step colors are semantic order-status hues
  // (same distinct-per-status scheme as activity.tsx's getStatusColor) —
  // left literal in both light and dark mode.
  trackerIconWrapDelivered: { backgroundColor: '#EAF7EE', borderColor: '#22C55E' },
  progressFillDelivered: { backgroundColor: '#22C55E' },
  stepActiveWrap: { backgroundColor: '#5AC8FA' },
  stepCompletedWrap: { backgroundColor: '#22C55E' },
  stepDeliveredWrap: { backgroundColor: '#22C55E' },

  emptyCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    marginTop: 40,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  emptyIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 16, marginBottom: 8, letterSpacing: -0.3 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Tracker Card
  trackerCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 24,
    padding: 24,
    marginBottom: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  trackerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  trackerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  trackerHeaderText: { flex: 1 },
  trackerTitle: { fontSize: 18, fontWeight: '900', color: theme.text, marginBottom: 3, letterSpacing: -0.3 },
  trackerSub: { fontSize: 13, color: theme.textSecondary, fontWeight: '500' },

  progressContainer: { marginBottom: 28 },
  progressBar: { height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { width: '60%', height: '100%', backgroundColor: theme.accent, borderRadius: 4 },

  stepsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { alignItems: 'center', flex: 1 },
  stepCompleted: { opacity: 1 },
  stepIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
    orderIdCaption: { fontSize: 11, fontWeight: '800', color: theme.textSecondary, letterSpacing: 1.2, marginBottom: 12, marginTop: 4 },
  stepLabel: { fontSize: 11, fontWeight: '700', color: theme.text, textAlign: 'center' },
  stepLabelInactive: { color: theme.textSecondary },

  // Section Headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCount: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },

  // Items
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

  // Summary
  summaryCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    padding: 20,
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
});

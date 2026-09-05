import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, StatusBar, TouchableOpacity, Modal, RefreshControl } from 'react-native';
import { Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKitchen } from '../../context/KitchenCoContext';
import { useRouter } from 'expo-router';
import { Skeleton } from '../../components/Skeleton';
import { useSimulatedLoad } from '../../utils/useSimulatedLoad';
import { ThemeColors } from '../../utils/theme';

/** Weekly (cycle) menu items are id-prefixed "cycle-<week>-<day>-..." — see
 * handleAddCycleItem in (tabs)/index.tsx. That menu only ever shows *today's*
 * meals and rotates admin-side, so an id like "cycle-Week 1-Monday-..." from
 * an old order has no guaranteed relationship to what's actually being cooked
 * today — reordering it verbatim would silently charge a stale price for a
 * dish that may not exist on the current menu at all.
 */
const isCycleMenuItemId = (id: string) => id.startsWith('cycle-');

export default function TabActivityScreen() {
  const { orders, addToCart, theme } = useKitchen();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { isLoading, refreshing, refresh } = useSimulatedLoad();
  const router = useRouter();
  // In-app modal instead of Alert.alert — Alert is a documented no-op on
  // React Native Web with no polyfill in this project, so it would render
  // nothing there. A real Modal works identically on every platform.
  const [showCantReorder, setShowCantReorder] = useState(false);

  const pastOrders = orders.slice(1); // Exclude current/latest order

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

  // Order-status colors are semantic content colors (a distinct hue per
  // status), not theme chrome — they stay literal in both light and dark mode.
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return '#FF9500';
      case 'preparing': return '#5AC8FA';
      case 'on_the_way': return '#22C55E';
      case 'delivered': return '#00C853';
      case 'cancelled': return '#FF3B30';
      default: return '#8E8E93';
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

  // Brief shimmer shown for the useSimulatedLoad() initial-load window — a
  // stand-in for the real fetch this screen will eventually make.
  const renderActivitySkeleton = () => (
    <View style={styles.list}>
      {[0, 1, 2].map(i => (
        <Skeleton key={`activity-skel-${i}`} theme={theme} style={{ height: 160, borderRadius: 20, marginBottom: 12 }} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />

      {isLoading ? (
        renderActivitySkeleton()
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
        <FlatList
          data={pastOrders.length > 0 ? pastOrders : orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.text} colors={[theme.text]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={styles.emptyTitle}>No past orders yet</Text>
              <Text style={styles.emptySubtitle}>
                Your current order is active. Check back after completion
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusColor = getStatusColor(item.status);
            return (
              <TouchableOpacity style={styles.orderCard} activeOpacity={0.7}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderIdContainer}>
                    <Text style={styles.orderId}>{item.id}</Text>
                    <Text style={styles.orderDate}>{formatDate(item.timestamp)}</Text>
                  </View>
                  <View style={styles.orderTotalContainer}>
                    <Text style={styles.orderTotal}>R {item.total.toFixed(2)}</Text>
                    <View style={styles.itemCount}>
                      <Text style={styles.itemCountText}>
                        {item.items.reduce((sum, dish) => sum + dish.quantity, 0)} items
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.itemsPreview}>
                  {item.items.slice(0, 3).map((dish, idx) => (
                    <View key={dish.id || idx} style={styles.itemChip}>
                      <Text style={styles.itemChipText}>
                        {dish.quantity}x {dish.name}
                      </Text>
                    </View>
                  ))}
                  {item.items.length > 3 && (
                    <View style={styles.moreChip}>
                      <Text style={styles.moreChipText}>+{item.items.length - 3} more</Text>
                    </View>
                  )}
                </View>

                {/* Delivery Address */}
                {item.deliveryAddress && (
                  <View style={styles.addressSection}>
                    <View style={styles.addressIconWrap}>
                      <Text style={styles.addressIcon}>📍</Text>
                    </View>
                    <View style={styles.addressDetails}>
                      <Text style={styles.addressLabel}>{item.deliveryAddress.label}</Text>
                      <Text style={styles.addressText}>
                        {item.deliveryAddress.street}, {item.deliveryAddress.suburb}
                      </Text>
                      <Text style={styles.addressText}>
                        {item.deliveryAddress.city}, {item.deliveryAddress.code}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.orderFooter}>
                  <View style={[styles.statusBadge, { borderColor: statusColor }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{getStatusLabel(item.status)}</Text>
                  </View>
                  {(() => {
                    // An order that touched the Weekly Menu can't be safely
                    // reordered as a single action — that menu changes daily,
                    // so a stale cycle- id from this order may not match
                    // anything on today's actual menu, at today's actual price.
                    // Rather than silently reordering only part of the order,
                    // grey the whole action out and explain why on tap.
                    const hasWeeklyMenuItems = item.items.some(orderItem =>
                      isCycleMenuItemId(orderItem.id)
                    );

                    const handlePress = () => {
                      if (hasWeeklyMenuItems) {
                        setShowCantReorder(true);
                        return;
                      }
                      item.items.forEach(orderItem => {
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

                    const itemCountTotal = item.items.reduce((sum, dish) => sum + dish.quantity, 0);
                    const reorderLabel = hasWeeklyMenuItems
                      ? `Reorder unavailable for order ${item.id}, includes Weekly Menu items`
                      : `Reorder ${itemCountTotal} item${itemCountTotal !== 1 ? 's' : ''} from order ${item.id}`;

                    return (
                      <TouchableOpacity
                        style={[styles.reorderBtn, hasWeeklyMenuItems && styles.reorderBtnDisabled]}
                        onPress={handlePress}
                        activeOpacity={hasWeeklyMenuItems ? 1 : 0.7}
                        accessibilityRole="button"
                        accessibilityLabel={reorderLabel}
                        accessibilityState={{ disabled: hasWeeklyMenuItems }}
                      >
                        <Text style={[styles.reorderBtnText, hasWeeklyMenuItems && styles.reorderBtnTextDisabled]}>
                          Reorder
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              </TouchableOpacity>
            );
          }}
        />
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
  header: { padding: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', color: theme.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  menuBtn: { backgroundColor: theme.accent, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  menuBtnText: { color: theme.onAccent, fontWeight: '800', fontSize: 15 },

  list: { padding: 16, paddingBottom: 20 },

  orderCard: {
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
  orderId: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 4, letterSpacing: -0.3 },
  orderDate: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  orderTotalContainer: { alignItems: 'flex-end' },
  orderTotal: { fontSize: 18, fontWeight: '900', color: theme.text, marginBottom: 4, letterSpacing: -0.3 },
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
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00C853', marginRight: 6 },
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

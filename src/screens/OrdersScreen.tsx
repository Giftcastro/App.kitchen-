import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme';
import { useCart } from '../context/CartContext';
import { OrderHistoryItem, CartItem } from '../types';
import { TaxInvoiceModal } from '../components/TaxInvoiceModal';
import { generateWeekdayOptions } from '../utils/sastTime';
import { getCategoryHeroImage } from '../data/mockData';

interface OrdersScreenProps {
  onNavigateToMenu?: () => void;
}

const STAGES: [string, string][] = [
  ['Order Received', 'Confirmed and entered into central kitchen schedule.'],
  ['Kitchen Preparing', 'Being prepared fresh on morning of delivery.'],
  ['Out for Delivery', 'En route in thermal temperature-locked crates.'],
  ['Delivered', 'Arrived at your designated company drop-off floor.'],
];

export const OrdersScreen: React.FC<OrdersScreenProps> = ({ onNavigateToMenu }) => {
  const { theme } = useTheme();
  const { orderHistory, submitOrderRating, addItem, categories, menuItems } = useCart();

  // Helper to detect whether an order line item is from the Chef's Choice rotation menu
  const isChefsChoiceItem = (item?: CartItem): boolean => {
    if (!item?.menuItem) return false;
    const m = item.menuItem;
    if (
      m.menuType === 'chefs_choice' ||
      m.categoryId === 'cat_chefs_choice' ||
      (typeof m.id === 'string' && m.id.startsWith('chef_')) ||
      (m.categoryName && m.categoryName.toLowerCase().includes("chef's choice"))
    ) {
      return true;
    }
    if (menuItems.length > 0) {
      const matchesStandardCatalog = menuItems.some(
        (std) =>
          std.menuType === 'standard' &&
          (std.id === m.id || std.name.trim().toLowerCase() === m.name.trim().toLowerCase())
      );
      if (!matchesStandardCatalog) {
        return true;
      }
    }
    return false;
  };

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [selectedInvoice, setSelectedInvoice] = useState<OrderHistoryItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [localRatings, setLocalRatings] = useState<Record<string, number>>({});

  // Resolve the category hero image for any order line item
  const resolveItemCategoryImage = (item?: CartItem): string => {
    if (!item?.menuItem) {
      return getCategoryHeroImage();
    }
    const { categoryId, categoryName, name } = item.menuItem;
    const matchedCat = categories.find(
      (c) =>
        c.id === categoryId ||
        (categoryName && c.name.toLowerCase() === categoryName.toLowerCase())
    );
    if (matchedCat?.heroImage) {
      return matchedCat.heroImage;
    }
    return getCategoryHeroImage(categoryId, categoryName, name);
  };

  // Resolve unique category images across all items in an order
  const resolveOrderCategoryImages = (order: OrderHistoryItem): string[] => {
    if (!order.items || order.items.length === 0) {
      return [getCategoryHeroImage()];
    }
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const item of order.items) {
      const url = resolveItemCategoryImage(item);
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
    return urls.length > 0 ? urls : [getCategoryHeroImage()];
  };

  // Split into active orders (preparing, out for delivery, paid scheduled) vs history (delivered, etc.)
  const { activeOrders, pastOrders } = useMemo(() => {
    const active: OrderHistoryItem[] = [];
    const past: OrderHistoryItem[] = [];

    orderHistory.forEach((o) => {
      if (o.status === 'delivered' || o.status === 'cancelled' || o.status === 'unfulfilled') {
        past.push(o);
      } else {
        active.push(o);
      }
    });

    return { activeOrders: active, pastOrders: past };
  }, [orderHistory]);

  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleStarPress = async (order: OrderHistoryItem, starNumber: number) => {
    // Optimistically update rating immediately for instant touch responsiveness on mobile
    setLocalRatings((prev) => ({ ...prev, [order.id]: starNumber }));

    try {
      await submitOrderRating(order.id, starNumber);
      Alert.alert(
        'Thank You!',
        `You rated this meal ${starNumber} star${starNumber === 1 ? '' : 's'}. Your feedback has been shared directly with our culinary team.`
      );
    } catch {
      Alert.alert('Rating Saved', `Your ${starNumber}-star rating has been recorded.`);
    }
  };

  const handleReorder = (order: OrderHistoryItem) => {
    if (!order.items || order.items.length === 0) {
      return;
    }

    const standardItems = order.items.filter((item) => !isChefsChoiceItem(item));
    const chefsChoiceCount = order.items.length - standardItems.length;

    if (standardItems.length === 0) {
      Alert.alert(
        'Reorder Not Available',
        "Chef's Choice meals are prepared exclusively for their specific weekly rotation date and cannot be reordered for future dates."
      );
      return;
    }

    // Reorder standard catalog items for the next available delivery weekday
    const weekdays = generateWeekdayOptions(undefined, 14);
    const nextAvailableOption = weekdays.find((d) => d.isAvailable && !d.isLocked) || weekdays[0];
    const nextDate = nextAvailableOption?.dateString || '';
    const nextDateLabel = nextAvailableOption?.fullFormattedDate || nextDate;

    standardItems.forEach((item) => {
      addItem(
        item.menuItem,
        item.quantity,
        item.allergyNotes,
        nextDate,
        item.size || 'standard',
        item.selectedAddOns || []
      );
    });

    const exclusionNote =
      chefsChoiceCount > 0
        ? `\n\nNote: ${chefsChoiceCount} Chef's Choice item(s) were excluded as rotation meals are only served on their specific scheduled day.`
        : '';

    Alert.alert(
      'Added to Basket ✓',
      `${standardItems.reduce((sum, i) => sum + i.quantity, 0)} Standard Classics meal(s) from this order have been added to your basket for ${nextDateLabel}.${exclusionNote}`,
      [
        ...(onNavigateToMenu ? [{ text: 'Go to Menu', onPress: onNavigateToMenu }] : []),
        { text: 'OK' },
      ]
    );
  };

  const currentList = activeTab === 'active' ? activeOrders : pastOrders;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Top Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: theme.surfaceBorder }]}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Your Orders</Text>
      </View>

      {/* Segmented Switcher (Active Orders vs Order History) */}
      <View style={styles.tabContainer}>
        <View style={[styles.switcherWrapper, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('active')}
            style={[
              styles.tabBtn,
              activeTab === 'active' && [styles.tabBtnActive, { backgroundColor: theme.primary }],
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === 'active' ? theme.textInverse : theme.textSecondary },
              ]}
            >
              Active Orders ({activeOrders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('history')}
            style={[
              styles.tabBtn,
              activeTab === 'history' && [styles.tabBtnActive, { backgroundColor: theme.primary }],
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === 'history' ? theme.textInverse : theme.textSecondary },
              ]}
            >
              Order History ({pastOrders.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Orders List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {currentList.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.chipBg }]}>
              <Ionicons
                name={activeTab === 'active' ? 'receipt-outline' : 'time-outline'}
                size={38}
                color={theme.textMuted}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              {activeTab === 'active' ? 'No Active Orders' : 'No Order History Yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {activeTab === 'active'
                ? "You don't have any meals in preparation. Browse today's gourmet selection to order!"
                : 'Completed corporate deliveries will appear here with tax invoices and chef rating tools.'}
            </Text>
            {activeTab === 'active' && onNavigateToMenu && (
              <TouchableOpacity
                onPress={onNavigateToMenu}
                style={[styles.menuButton, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.menuButtonText, { color: theme.textInverse }]}>Browse Menu</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          currentList.map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const currentRating = localRatings[order.id] ?? order.rating?.rating ?? 0;
            const primaryDishName = order.items[0]?.menuItem?.name || 'Gourmet Selection';
            const totalMealCount = order.items.reduce((s, i) => s + i.quantity, 0);
            const categoryImages = resolveOrderCategoryImages(order);

            // Compute stage
            const stageIndex =
              order.status === 'delivered'
                ? 4
                : order.status === 'out_for_delivery'
                ? 3
                : order.status === 'kitchen_prepping'
                ? 2
                : 1;

            return (
              <View
                key={order.id}
                style={[
                  styles.orderCard,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}
              >
                {/* Clickable Header Accordion Row */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => toggleExpand(order.id)}
                  style={styles.cardHeaderRow}
                >
                  {/* Food Category Image Tile (fitted within the small grid square) */}
                  <View style={[styles.iconTile, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}>
                    {categoryImages.length === 1 ? (
                      <Image
                        source={{ uri: categoryImages[0] }}
                        style={styles.iconTileSingleImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.iconTileGrid}>
                        {categoryImages.slice(0, 4).map((imgUri, idx) => (
                          <Image
                            key={`${order.id}-cat-${idx}`}
                            source={{ uri: imgUri }}
                            style={[
                              styles.iconTileGridCell,
                              categoryImages.length === 2 && { height: '100%' },
                            ]}
                            resizeMode="cover"
                          />
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.dishName, { color: theme.textPrimary }]} numberOfLines={1}>
                      {totalMealCount > 1 ? `${totalMealCount}x ${primaryDishName}` : primaryDishName}
                    </Text>
                    <View style={styles.orderMetaRow}>
                      <Text style={[styles.orderMetaText, { color: theme.textSecondary }]}>
                        {order.deliveryDateFormatted}
                      </Text>
                      <Text style={[styles.orderMetaBullet, { color: theme.textMuted }]}>•</Text>
                      <Text style={[styles.orderMetaText, { color: theme.textSecondary }]}>
                        #{order.orderNumber.replace('ORD-', '')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rightHeaderCol}>
                    <Text style={[styles.orderPrice, { color: theme.primary }]}>
                      R{order.totalPaid.toFixed(2)}
                    </Text>
                    <View style={styles.expandPill}>
                      <Text style={[styles.statusChip, { color: theme.textSecondary }]}>
                        {order.status === 'delivered' ? 'Delivered' : order.status === 'out_for_delivery' ? 'Out for Delivery' : 'Preparing'}
                      </Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={theme.textMuted}
                        style={{ marginLeft: 4 }}
                      />
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded Drop-down Accordion Details */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={[styles.cardDivider, { backgroundColor: theme.surfaceBorder }]} />

                    {/* Delivery Progress Stages */}
                    <Text style={[styles.sectionCaption, { color: theme.textSecondary }]}>
                      DELIVERY PROGRESS
                    </Text>
                    <View style={styles.stagesList}>
                      {STAGES.map(([stageTitle, stageDesc], idx) => {
                        const stepNumber = idx + 1;
                        const isDone = stageIndex >= stepNumber;
                        const isCurrent = stageIndex === stepNumber;

                        return (
                          <View key={stageTitle} style={styles.stageRow}>
                            <View style={styles.stageIndicatorCol}>
                              <View
                                style={[
                                  styles.stageCircle,
                                  isDone
                                    ? [styles.stageCircleDone, { backgroundColor: theme.primary }]
                                    : [styles.stageCirclePending, { borderColor: theme.surfaceBorder }],
                                ]}
                              >
                                {isDone ? (
                                  <Ionicons name="checkmark" size={12} color={theme.textInverse} />
                                ) : (
                                  <View style={[styles.pendingDot, { backgroundColor: theme.textMuted }]} />
                                )}
                              </View>
                              {idx < STAGES.length - 1 && (
                                <View
                                  style={[
                                    styles.stageLine,
                                    { backgroundColor: isDone ? theme.primary : theme.surfaceBorder },
                                  ]}
                                />
                              )}
                            </View>

                            <View style={styles.stageDetailsCol}>
                              <Text
                                style={[
                                  styles.stageTitle,
                                  { color: isCurrent ? theme.primary : theme.textPrimary },
                                  isCurrent && { fontWeight: '700' },
                                ]}
                              >
                                {stageTitle}
                              </Text>
                              <Text style={[styles.stageDesc, { color: theme.textSecondary }]}>
                                {stageDesc}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* Delivery Drop-off Details */}
                    <View style={[styles.detailsBox, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Drop-off Time</Text>
                        <Text style={[styles.detailValue, { color: theme.textPrimary }]}>Strictly 12:00 PM SAST</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Drop-off Point</Text>
                        <Text style={[styles.detailValue, { color: theme.textPrimary }]}>{order.deliveryFloor}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Location</Text>
                        <Text style={[styles.detailValue, { color: theme.textPrimary }]}>{order.companyLocation}</Text>
                      </View>
                    </View>

                    {/* Line Items List */}
                    <Text style={[styles.sectionCaption, { color: theme.textSecondary, marginTop: 14 }]}>
                      MEAL BREAKDOWN
                    </Text>
                    {order.items.map((line, idx) => {
                      const lineCategoryImg = resolveItemCategoryImage(line);
                      return (
                        <View key={line.id || idx} style={styles.itemLineRow}>
                          <View style={[styles.itemLineThumbWrap, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}>
                            <Image
                              source={{ uri: lineCategoryImg }}
                              style={styles.itemLineThumb}
                              resizeMode="cover"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemLineTitle, { color: theme.textPrimary }]}>
                              {line.quantity}x {line.menuItem.name}
                              {line.size === 'large' ? ' (Large)' : ''}
                            </Text>
                            {line.selectedAddOns && line.selectedAddOns.length > 0 && (
                              <Text style={[styles.itemLineAddOns, { color: theme.textMuted }]}>
                                + {line.selectedAddOns.map((a) => a.name).join(', ')}
                              </Text>
                            )}
                            {line.allergyNotes ? (
                              <Text style={[styles.itemAllergyAlert, { color: theme.error }]}>
                                ⚠️ Notes: {line.allergyNotes}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[styles.itemLinePrice, { color: theme.textPrimary }]}>
                            R{line.totalPrice.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })}

                    {/* Action Section: Rating + Vertical Buttons (Reorder first, Tax Invoice below) */}
                    <View style={[styles.cardActionsColumn, { borderTopColor: theme.surfaceBorder }]}>
                      {/* Rating Stars Row (for Order History) */}
                      {activeTab === 'history' && (
                        <View
                          style={[
                            styles.ratingSectionCard,
                            { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder },
                          ]}
                        >
                          <Text style={[styles.ratingLabel, { color: theme.textPrimary }]}>
                            {currentRating > 0 ? `Your Rating (${currentRating}/5):` : 'Rate Your Meal:'}
                          </Text>
                          <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <TouchableOpacity
                                key={star}
                                onPress={() => handleStarPress(order, star)}
                                activeOpacity={0.65}
                                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                                style={styles.starHit}
                              >
                                <Ionicons
                                  name={star <= currentRating ? 'star' : 'star-outline'}
                                  size={24}
                                  color={star <= currentRating ? '#F59E0B' : theme.textMuted}
                                />
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* 1. Reorder Button (First / Top button in Order History — Disabled for Chef's Choice Rotation Orders) */}
                      {activeTab === 'history' && (() => {
                        const allChefsChoice =
                          order.items.length > 0 && order.items.every((it) => isChefsChoiceItem(it));
                        if (allChefsChoice) {
                          return (
                            <View
                              style={[
                                styles.verticalActionBtn,
                                {
                                  borderColor: theme.surfaceBorder,
                                  backgroundColor: theme.background,
                                  opacity: 0.7,
                                },
                              ]}
                            >
                              <Ionicons name="lock-closed-outline" size={15} color={theme.textMuted} />
                              <Text style={[styles.verticalActionBtnText, { color: theme.textMuted }]}>
                                Chef&apos;s Choice (Fixed Day — No Reorder)
                              </Text>
                            </View>
                          );
                        }
                        return (
                          <TouchableOpacity
                            onPress={() => handleReorder(order)}
                            activeOpacity={0.8}
                            style={[
                              styles.verticalActionBtn,
                              { borderColor: theme.surfaceBorder, backgroundColor: theme.chipBg },
                            ]}
                          >
                            <Ionicons name="repeat" size={16} color={theme.textPrimary} />
                            <Text style={[styles.verticalActionBtnText, { color: theme.textPrimary }]}>
                              Reorder
                            </Text>
                          </TouchableOpacity>
                        );
                      })()}

                      {/* 2. Tax Invoice Button (Directly below Reorder) */}
                      <TouchableOpacity
                        onPress={() => setSelectedInvoice(order)}
                        activeOpacity={0.8}
                        style={[
                          styles.verticalActionBtn,
                          { borderColor: theme.primary, backgroundColor: theme.primaryMuted },
                        ]}
                      >
                        <Ionicons name="document-text-outline" size={16} color={theme.primary} />
                        <Text style={[styles.verticalActionBtnText, { color: theme.primary }]}>
                          Tax Invoice
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Tax Invoice Full Modal */}
      {selectedInvoice && (
        <TaxInvoiceModal
          visible={!!selectedInvoice}
          order={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: typography.heading,
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  switcherWrapper: {
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: 1,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    height: 38,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {},
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    paddingTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: typography.heading,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  menuButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  menuButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  orderCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileSingleImage: {
    width: '100%',
    height: '100%',
  },
  iconTileGrid: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  iconTileGridCell: {
    width: '50%',
    height: '50%',
  },
  dishName: {
    fontSize: 15,
    fontWeight: '700',
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  orderMetaText: {
    fontSize: 11,
  },
  orderMetaBullet: {
    marginHorizontal: 4,
    fontSize: 10,
  },
  rightHeaderCol: {
    alignItems: 'flex-end',
  },
  orderPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  expandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  statusChip: {
    fontSize: 10,
    fontWeight: '600',
  },
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  cardDivider: {
    height: 1,
    marginBottom: 12,
  },
  sectionCaption: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  stagesList: {
    marginBottom: 12,
  },
  stageRow: {
    flexDirection: 'row',
  },
  stageIndicatorCol: {
    alignItems: 'center',
    width: 22,
  },
  stageCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageCircleDone: {},
  stageCirclePending: {
    borderWidth: 1.5,
  },
  pendingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  stageLine: {
    width: 2,
    height: 24,
  },
  stageDetailsCol: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 10,
  },
  stageTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  stageDesc: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 1,
  },
  detailsBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 11,
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 10,
  },
  itemLineThumbWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemLineThumb: {
    width: '100%',
    height: '100%',
  },
  itemLineTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemLineAddOns: {
    fontSize: 10,
    marginTop: 1,
  },
  itemAllergyAlert: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  itemLinePrice: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardActionsColumn: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  ratingSectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  ratingLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starHit: {
    padding: 4,
  },
  verticalActionBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  verticalActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

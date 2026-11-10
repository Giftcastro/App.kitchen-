import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { OrderHistoryItem } from '../types';
import { RatingBar } from '../components/RatingBar';
import { TaxInvoiceModal } from '../components/TaxInvoiceModal';
import { DisputeModal } from '../components/DisputeModal';
import { getNowInSAST, formatDateISO } from '../utils/sastTime';

interface OrderHistoryScreenProps {
  onNavigateToMenu: () => void;
  onNavigateToTracker?: () => void;
}

type HistoryTab = 'today' | 'upcoming' | 'past';

export const OrderHistoryScreen: React.FC<OrderHistoryScreenProps> = ({
  onNavigateToMenu,
  onNavigateToTracker,
}) => {
  const { theme, isDark } = useTheme();
  const { currentUser } = useAuth();
  const { orderHistory, submitOrderRating, reportOrderNonDelivery } = useCart();

  const [activeTab, setActiveTab] = useState<HistoryTab>('today');
  const [isMorningNoticeOpen, setIsMorningNoticeOpen] = useState<boolean>(false);

  // State for active Tax Invoice Modal
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<OrderHistoryItem | null>(null);

  // State for active Dispute Modal
  const [disputeOrder, setDisputeOrder] = useState<OrderHistoryItem | null>(null);

  // Local draft states for rating form
  const [draftRatings, setDraftRatings] = useState<Record<string, number>>({});
  const [draftFeedbacks, setDraftFeedbacks] = useState<Record<string, string>>({});

  const todayIso = useMemo(() => formatDateISO(getNowInSAST()), []);

  const todayOrders = useMemo(() => {
    return orderHistory.filter(
      (order) =>
        order.targetDeliveryDate === todayIso ||
        order.status === 'kitchen_prepping' ||
        order.status === 'out_for_delivery'
    );
  }, [orderHistory, todayIso]);

  const upcomingOrders = useMemo(() => {
    return orderHistory.filter(
      (order) =>
        order.targetDeliveryDate > todayIso &&
        order.status === 'paid_scheduled' &&
        !todayOrders.some((t) => t.id === order.id)
    );
  }, [orderHistory, todayIso, todayOrders]);

  const pastOrders = useMemo(() => {
    return orderHistory.filter(
      (order) =>
        order.status === 'delivered' ||
        order.status === 'unfulfilled' ||
        order.status === 'cancelled' ||
        (order.targetDeliveryDate < todayIso && !todayOrders.some((t) => t.id === order.id))
    );
  }, [orderHistory, todayIso, todayOrders]);

  const displayedOrders = useMemo(() => {
    switch (activeTab) {
      case 'today':
        return todayOrders;
      case 'upcoming':
        return upcomingOrders;
      case 'past':
        return pastOrders;
    }
  }, [activeTab, todayOrders, upcomingOrders, pastOrders]);

  const handleRatingSubmit = async (orderId: string) => {
    const starCount = draftRatings[orderId] || 0;
    if (starCount === 0) {
      Alert.alert('Select Rating', 'Please select at least 1 star before submitting.');
      return;
    }

    const feedback = draftFeedbacks[orderId];
    await submitOrderRating(orderId, starCount, feedback);

    Alert.alert('Thank You!', 'Your rating and feedback have been shared with our culinary team.');
  };

  const getStatusBadge = (status: OrderHistoryItem['status']) => {
    switch (status) {
      case 'paid_scheduled':
        return {
          label: 'Paid / Scheduled',
          bg: theme.primaryMuted,
          color: theme.primary,
          icon: 'calendar-outline' as const,
        };
      case 'kitchen_prepping':
        return {
          label: 'Kitchen Prepping',
          bg: theme.goldWarningSurface,
          color: theme.goldWarning,
          icon: 'restaurant-outline' as const,
        };
      case 'out_for_delivery':
        return {
          label: 'Out for Batch Drop',
          bg: theme.primaryMuted,
          color: theme.primary,
          icon: 'car-outline' as const,
        };
      case 'delivered':
        return {
          label: 'Delivered',
          bg: theme.successSurface,
          color: theme.success,
          icon: 'checkmark-circle-outline' as const,
        };
      case 'unfulfilled':
        return {
          label: 'Unfulfilled / Disputed',
          bg: theme.errorSurface,
          color: theme.error,
          icon: 'alert-circle-outline' as const,
        };
      default:
        return {
          label: status,
          bg: theme.surfaceHighlight,
          color: theme.textSecondary,
          icon: 'time-outline' as const,
        };
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* 1. Header */}
      <View style={[styles.headerBar, { backgroundColor: theme.background, borderBottomColor: theme.surfaceBorder }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Order History & Invoices</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            All past corporate orders and tax records
          </Text>
        </View>
        <View style={styles.headerRightActions}>
          {todayOrders.length > 0 && (
            <TouchableOpacity
              onPress={() => setIsMorningNoticeOpen(true)}
              style={[styles.bellBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              accessibilityLabel="8:00 AM Morning Briefing"
            >
              <Ionicons name="notifications-outline" size={17} color={theme.textPrimary} />
              <View style={[styles.bellBadge, { backgroundColor: theme.error }]} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onNavigateToMenu}
            style={[styles.menuBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
          >
            <Ionicons name="restaurant-outline" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Categorized Tabs Toolbar */}
      <View style={[styles.tabSegment, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
        {[
          { key: 'today', label: "Today's Lunch", count: todayOrders.length },
          { key: 'upcoming', label: 'Upcoming', count: upcomingOrders.length },
          { key: 'past', label: 'Past Orders', count: pastOrders.length },
        ].map((tab) => {
          const isSelected = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.8}
              onPress={() => setActiveTab(tab.key as HistoryTab)}
              style={[
                styles.tabBtn,
                isSelected && {
                  backgroundColor: isDark ? '#FFFFFF' : '#000000',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: theme.textSecondary },
                  isSelected && {
                    color: isDark ? '#000000' : '#FFFFFF',
                    fontWeight: '800',
                  },
                ]}
              >
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    {
                      backgroundColor: isSelected
                        ? (isDark ? '#000000' : '#FFFFFF')
                        : theme.surfaceHighlight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      {
                        color: isSelected
                          ? (isDark ? '#FFFFFF' : '#000000')
                          : theme.textPrimary,
                      },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 3. 8:00 AM Dispatch Notice Banner (when viewing Today's Lunch) */}
        {activeTab === 'today' && todayOrders.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setIsMorningNoticeOpen(true)}
            style={[styles.morningNoticeBanner, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
          >
            <View style={[styles.morningNoticeIconWrapper, { backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons name="notifications" size={17} color={theme.textPrimary} />
            </View>
            <View style={styles.morningNoticeTextCol}>
              <View style={styles.morningNoticeBadgeRow}>
                <Text style={[styles.morningNoticeTimeTag, { color: theme.textPrimary }]}>8:00 AM SAST BRIEFING</Text>
                <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
              </View>
              <Text style={[styles.morningNoticeTitle, { color: theme.textPrimary }]}>
                Today's Lunch Drop is Confirmed
              </Text>
              <Text style={[styles.morningNoticeSub, { color: theme.textSecondary }]}>
                Chef is batch prepping in the central kitchen. Tap to view 8:00 AM details.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        )}

        {/* 4. Filtered Orders or Empty State */}
        {displayedOrders.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons
                name={activeTab === 'today' ? 'restaurant-outline' : activeTab === 'upcoming' ? 'calendar-outline' : 'receipt-outline'}
                size={40}
                color={theme.textMuted}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              {activeTab === 'today'
                ? 'No Lunch Scheduled for Today'
                : activeTab === 'upcoming'
                ? 'No Upcoming Orders Scheduled'
                : 'No Past Orders Found'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {activeTab === 'today'
                ? 'You do not have any corporate orders scheduled for today’s 12:00 PM batch drop.'
                : activeTab === 'upcoming'
                ? 'Schedule your lunches up to 2 weeks in advance to secure fresh corporate batch drops.'
                : 'Completed corporate orders and SARS-compliant tax invoices will appear here.'}
            </Text>
            {activeTab !== 'past' && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onNavigateToMenu}
                style={[styles.browseBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
              >
                <Text style={[styles.browseBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                  Browse 2-Week Menu →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          displayedOrders.map((order) => {
            const statusConfig = getStatusBadge(order.status);
            const isDelivered = order.status === 'delivered';
            const isDisputed = order.status === 'unfulfilled';
            const hasRating = Boolean(order.rating);
            const activeStar = draftRatings[order.id] || (order.rating ? order.rating.rating : 0);
            const activeFeedback = draftFeedbacks[order.id] ?? (order.rating?.feedback || '');

            return (
              <View
                key={order.id}
                style={[
                  styles.orderCard,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                  isDisputed && { borderColor: theme.errorBorder },
                ]}
              >
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  <View style={styles.orderRefCol}>
                    <Text style={[styles.orderRefText, { color: theme.textPrimary }]}>
                      {order.orderNumber}
                    </Text>
                    <Text style={[styles.deliveryDateBadge, { color: theme.textSecondary }]}>
                      {order.deliveryDateFormatted} • {order.deliverySlot}
                    </Text>
                  </View>

                  {/* Status Pill */}
                  <View style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}>
                    <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                {/* Location Row */}
                <View style={[styles.locationRow, { backgroundColor: theme.surfaceHighlight }]}>
                  <Ionicons name="location" size={14} color={theme.primary} />
                  <Text style={[styles.locationText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {order.companyLocation} • {order.deliveryFloor}
                  </Text>
                </View>

                {/* Line Items Summary */}
                <View style={styles.itemsSummary}>
                  {order.items.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <Text style={[styles.itemText, { color: theme.textPrimary }]} numberOfLines={2}>
                        {item.quantity}x {item.menuItem.name}{item.size === 'large' ? ' (Large)' : ''}{item.selectedAddOns && item.selectedAddOns.length > 0 ? ` (+${item.selectedAddOns.map((a) => a.name).join(', ')})` : ''}
                      </Text>
                      <Text style={[styles.itemPriceText, { color: theme.textSecondary }]}>
                        R {item.totalPrice.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                  {order.items.some((i) => i.allergyNotes) && (
                    <View style={[styles.allergyNoteTag, { backgroundColor: theme.goldWarningSurface }]}>
                      <Ionicons name="alert-circle" size={12} color={theme.goldWarning} />
                      <Text style={[styles.allergyNoteText, { color: theme.goldWarning }]}>
                        [Allergy Note: {order.items.find((i) => i.allergyNotes)?.allergyNotes}]
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

                {/* Financial Summary & Tax Invoice Row */}
                <View style={styles.financeRow}>
                  <View>
                    <Text style={[styles.financeLabel, { color: theme.textSecondary }]}>Total Paid (VAT incl.)</Text>
                    <Text style={[styles.financeAmount, { color: theme.primary }]}>
                      R {order.totalPaid.toFixed(2)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSelectedInvoiceOrder(order)}
                    style={[styles.invoiceActionBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}
                  >
                    <Ionicons name="document-text-outline" size={15} color={theme.primary} />
                    <Text style={[styles.invoiceActionText, { color: theme.textPrimary }]}>
                      Tax Invoice (PDF)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Disputed Alert Banner */}
                {isDisputed && order.dispute && (
                  <View style={[styles.disputeBanner, { backgroundColor: theme.errorSurface, borderColor: theme.errorBorder }]}>
                    <Ionicons name="warning" size={16} color={theme.error} />
                    <View style={styles.disputeTextCol}>
                      <Text style={[styles.disputeTitle, { color: theme.error }]}>
                        Non-Delivery Ticket: {order.dispute.supportTicketRef}
                      </Text>
                      <Text style={[styles.disputeStatus, { color: theme.textSecondary }]}>
                        Status: Kitchen Support Desk is reviewing the central dispatch batch manifest.
                      </Text>
                    </View>
                  </View>
                )}

                {/* 3. Post-Delivery Action Section (Visible ONLY when status is delivered) */}
                {isDelivered && (
                  <View style={[styles.ratingSection, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
                    {hasRating ? (
                      /* Already Rated State */
                      <View style={styles.ratedContainer}>
                        <View style={styles.ratedHeader}>
                          <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                          <Text style={[styles.ratedTitle, { color: theme.textPrimary }]}>
                            Your Rating ({order.rating?.rating} / 5 Stars)
                          </Text>
                        </View>
                        <RatingBar rating={order.rating!.rating} readOnly size={20} />
                        {order.rating?.feedback ? (
                          <Text style={[styles.ratedFeedback, { color: theme.textSecondary }]}>
                            "{order.rating.feedback}"
                          </Text>
                        ) : null}
                      </View>
                    ) : (
                      /* Unrated Interactive State */
                      <View style={styles.unratedContainer}>
                        <Text style={[styles.ratingPromptTitle, { color: theme.textPrimary }]}>
                          How was your meal drop on {order.deliveryDateFormatted.split(' ')[0]}?
                        </Text>
                        <RatingBar
                          rating={activeStar}
                          onRatingChange={(newStar) =>
                            setDraftRatings((prev) => ({ ...prev, [order.id]: newStar }))
                          }
                          size={26}
                        />

                        {activeStar > 0 && (
                          <TextInput
                            style={[
                              styles.feedbackInput,
                              {
                                backgroundColor: theme.inputBackground,
                                borderColor: theme.inputBorder,
                                color: theme.textPrimary,
                              },
                            ]}
                            placeholder="Optional culinary feedback for Chef..."
                            placeholderTextColor={theme.textMuted}
                            value={draftFeedbacks[order.id] || ''}
                            onChangeText={(txt) =>
                              setDraftFeedbacks((prev) => ({ ...prev, [order.id]: txt }))
                            }
                            multiline
                            numberOfLines={2}
                          />
                        )}

                        {activeStar > 0 && (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => handleRatingSubmit(order.id)}
                            style={[styles.submitRatingBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
                          >
                            <Text style={[styles.submitRatingBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                              Submit Rating
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Secondary Escalation Button */}
                    {!isDisputed && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setDisputeOrder(order)}
                        style={[styles.escalateButton, { borderColor: theme.errorBorder }]}
                      >
                        <Ionicons name="alert-circle-outline" size={14} color={theme.error} />
                        <Text style={[styles.escalateButtonText, { color: theme.error }]}>
                          Food Not Delivered / Report Issue
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Track Today's Batch Drop Button for Active Today Orders */}
                {onNavigateToTracker && (order.status === 'kitchen_prepping' || order.status === 'out_for_delivery') && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={onNavigateToTracker}
                    style={[styles.trackOrderBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
                  >
                    <Ionicons name="navigate-outline" size={15} color={isDark ? '#000000' : '#FFFFFF'} />
                    <Text style={[styles.trackOrderBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                      Track Today's Batch Drop
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* SARS Tax Invoice Modal */}
      <TaxInvoiceModal
        visible={Boolean(selectedInvoiceOrder)}
        order={selectedInvoiceOrder}
        onClose={() => setSelectedInvoiceOrder(null)}
      />

      {/* Dispute Modal */}
      <DisputeModal
        visible={Boolean(disputeOrder)}
        order={disputeOrder}
        userEmail={currentUser?.email || ''}
        userName={currentUser?.fullName || 'Alex Van Der Berg'}
        onClose={() => setDisputeOrder(null)}
        onConfirmDispute={reportOrderNonDelivery}
      />

      {/* 8:00 AM Delivery Notification Modal with Frosted BlurView */}
      <Modal
        visible={isMorningNoticeOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsMorningNoticeOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 45 : 85}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <TouchableWithoutFeedback onPress={() => setIsMorningNoticeOpen(false)}>
            <View style={[styles.modalBackdropTint, { backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.35)' }]} />
          </TouchableWithoutFeedback>

          <View
            style={[
              styles.noticeCard,
              {
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? '#2E2E32' : '#E5DFD3',
              },
            ]}
          >
            <View style={styles.noticeHeaderRow}>
              <View style={[styles.noticeBadge, { backgroundColor: theme.surfaceHighlight }]}>
                <Ionicons name="time-outline" size={13} color={theme.textPrimary} />
                <Text style={[styles.noticeBadgeText, { color: theme.textPrimary }]}>
                  8:00 AM SAST MORNING BRIEFING
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsMorningNoticeOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[styles.modalCloseBtn, { backgroundColor: theme.surfaceHighlight }]}
              >
                <Ionicons name="close" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.noticeIconCircle, { backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons name="restaurant" size={30} color={theme.textPrimary} />
            </View>

            <Text style={[styles.noticeTitle, { color: theme.textPrimary }]}>
              Today's Lunch Drop is Confirmed!
            </Text>
            <Text style={[styles.noticeSub, { color: theme.textSecondary }]}>
              Our central kitchen commenced batch cooking at 8:00 AM SAST. Your scheduled lunch order is locked in for 12:00 PM dropoff.
            </Text>

            {todayOrders[0] && (
              <View style={[styles.noticeOrderBox, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}>
                <View style={styles.noticeOrderHeader}>
                  <Text style={[styles.noticeOrderRef, { color: theme.textPrimary }]}>
                    {todayOrders[0].orderNumber}
                  </Text>
                  <View style={[styles.noticeStatusTag, { backgroundColor: theme.primaryMuted }]}>
                    <Text style={[styles.noticeStatusTagText, { color: theme.primary }]}>
                      Kitchen Prepping
                    </Text>
                  </View>
                </View>

                <View style={styles.noticeDetailRow}>
                  <Ionicons name="location-outline" size={14} color={theme.primary} />
                  <Text style={[styles.noticeDetailText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {todayOrders[0].companyLocation} • {todayOrders[0].deliveryFloor}
                  </Text>
                </View>

                <View style={styles.noticeDetailRow}>
                  <Ionicons name="bicycle-outline" size={14} color={theme.primary} />
                  <Text style={[styles.noticeDetailText, { color: theme.textSecondary }]}>
                    Window: 12:00 PM - 12:30 PM SAST Sharp
                  </Text>
                </View>

                <View style={[styles.noticeDivider, { backgroundColor: theme.surfaceBorder }]} />

                <Text style={[styles.noticeItemsList, { color: theme.textPrimary }]}>
                  {todayOrders[0].items.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(' • ')}
                </Text>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setIsMorningNoticeOpen(false);
                if (onNavigateToTracker) {
                  onNavigateToTracker();
                }
              }}
              style={[styles.noticePrimaryBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
            >
              <Ionicons name="navigate-outline" size={16} color={isDark ? '#000000' : '#FFFFFF'} />
              <Text style={[styles.noticePrimaryBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                Track Batch Progress
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsMorningNoticeOpen(false)}
              style={styles.noticeDismissBtn}
            >
              <Text style={[styles.noticeDismissText, { color: theme.textSecondary }]}>
                Dismiss Briefing
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 8,
  },
  bellBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tabSegment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },
  emptyContainer: {
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    gap: 10,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  browseBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  browseBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  orderCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  orderRefCol: {
    flex: 1,
    paddingRight: 8,
  },
  orderRefText: {
    fontSize: 15,
    fontWeight: '800',
  },
  deliveryDateBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  itemsSummary: {
    gap: 4,
    marginVertical: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemPriceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  allergyNoteTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  allergyNoteText: {
    fontSize: 10,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financeLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  financeAmount: {
    fontSize: 17,
    fontWeight: '800',
  },
  invoiceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  invoiceActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  disputeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  disputeTextCol: {
    flex: 1,
  },
  disputeTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  disputeStatus: {
    fontSize: 11,
    marginTop: 2,
  },
  ratingSection: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
  },
  ratedContainer: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  ratedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratedTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  ratedFeedback: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  unratedContainer: {
    alignItems: 'center',
    gap: 8,
  },
  ratingPromptTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  feedbackInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    minHeight: 50,
  },
  submitRatingBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  submitRatingBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  escalateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  escalateButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  morningNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    gap: 12,
  },
  morningNoticeIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morningNoticeTextCol: {
    flex: 1,
  },
  morningNoticeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  morningNoticeTimeTag: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  morningNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  morningNoticeSub: {
    fontSize: 11,
    marginTop: 1,
  },
  trackOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  trackOrderBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdropTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  noticeCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  noticeHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  noticeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  noticeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  noticeTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  noticeSub: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  noticeOrderBox: {
    width: '100%',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 6,
  },
  noticeOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  noticeOrderRef: {
    fontSize: 12,
    fontWeight: '800',
  },
  noticeStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  noticeStatusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  noticeDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noticeDetailText: {
    fontSize: 11.5,
    fontWeight: '500',
    flex: 1,
  },
  noticeDivider: {
    height: 1,
    marginVertical: 4,
  },
  noticeItemsList: {
    fontSize: 12,
    fontWeight: '600',
  },
  noticePrimaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  noticePrimaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  noticeDismissBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  noticeDismissText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerSpacing: {
    height: 40,
  },
});

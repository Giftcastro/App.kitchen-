import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useDeliveryCalendar } from '../hooks/useDeliveryCalendar';
import { PayFastModal } from '../components/PayFastModal';
import { OrderConfirmationModal } from '../components/OrderConfirmationModal';
import { TaxInvoiceModal } from '../components/TaxInvoiceModal';
import { FloorPickerModal } from '../components/FloorPickerModal';
import { OrderHistoryItem, CartItem } from '../types';

interface CheckoutScreenProps {
  onNavigateToMenu: () => void;
  onNavigateToProfile: () => void;
  onNavigateToTracker?: () => void;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  onNavigateToMenu,
  onNavigateToProfile,
  onNavigateToTracker,
}) => {
  const { theme, isDark } = useTheme();
  const { currentUser, updateDropoffFloor } = useAuth();
  const {
    cartItems,
    corporateAccounts,
    activeDateCartItems,
    updateQuantity,
    removeItem,
    clearCartForDate,
    getActiveDateTotals,
    completePaidCheckout,
  } = useCart();
  const { deliveryDates, selectedDate, selectedDateOption, isOrderable } = useDeliveryCalendar();

  const formatIsoDateLabel = (isoDate: string): string => {
    const matched = deliveryDates.find((opt) => opt.dateString === isoDate);
    if (matched) return matched.fullFormattedDate;
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      if (!isNaN(dt.getTime())) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${days[dt.getDay()]}, ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
      }
    }
    return isoDate;
  };

  const [isPayFastOpen, setIsPayFastOpen] = useState<boolean>(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderHistoryItem | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState<boolean>(false);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<OrderHistoryItem | null>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState<boolean>(false);

  // Dynamic corporate floor selection
  const userCompany = corporateAccounts.find(
    (c) => c.id === currentUser?.companyId || c.domains.includes(currentUser?.email?.split('@')[1] || '')
  ) || corporateAccounts[0];

  const availableFloors = userCompany?.locations || [];
  const canChangeFloor = availableFloors.length > 1;
  const [selectedOrderFloor, setSelectedOrderFloor] = useState<string>(
    currentUser?.deliveryFloor || 'Floor 3 (Reception Pantry)'
  );
  const [isFloorPickerOpen, setIsFloorPickerOpen] = useState<boolean>(false);

  // Support multi-date cart items grouping
  const displayItems: CartItem[] = cartItems;

  const groupedCartByDate = useMemo(() => {
    const map: Record<string, CartItem[]> = {};
    displayItems.forEach((item: CartItem) => {
      const d = item.targetDeliveryDate || selectedDate;
      if (!map[d]) map[d] = [];
      map[d].push(item);
    });
    return map;
  }, [displayItems, selectedDate]);

  const distinctDates = Object.keys(groupedCartByDate);

  const subtotalDisplay = useMemo(() => {
    return displayItems.reduce((sum: number, item: CartItem) => sum + item.totalPrice, 0);
  }, [displayItems]);
  const formattedSubtotal = `R ${subtotalDisplay.toFixed(2)}`;

  // Includes each date's delivery fee and discount. The server has the final say.
  const formattedAmountDue = `R ${distinctDates
    .reduce((sum, d) => sum + getActiveDateTotals(d).totalZar, 0)
    .toFixed(2)}`;

  const checkoutPayload = useMemo(
    () => ({
      floor: selectedOrderFloor,
      dates: distinctDates.map((date) => ({
        date,
        items: groupedCartByDate[date].map((item) => ({
          menuItemId: item.menuItem.id,
          size: (item.size || 'standard') as 'standard' | 'large',
          quantity: item.quantity,
          addOns: (item.selectedAddOns || []).map((a) => a.name),
          allergyNotes: item.allergyNotes,
        })),
      })),
    }),
    [groupedCartByDate, selectedOrderFloor]
  );
  const totalItemCount = displayItems.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);

  const formattedDateLabel = selectedDateOption
    ? `${selectedDateOption.fullFormattedDate}`
    : 'Selected Delivery Date';

  const handlePayPress = () => {
    if (displayItems.length === 0) {
      Alert.alert('Cart is Empty', 'Please add meals from the menu before checking out.');
      return;
    }

    setIsPayFastOpen(true);
  };

  const handlePaymentConfirmed = async () => {
    setIsPayFastOpen(false);

    const lastPlaced = await completePaidCheckout();

    if (lastPlaced) {
      setConfirmedOrder(lastPlaced);
    }
    if (onNavigateToTracker) {
      onNavigateToTracker();
    } else {
      setIsConfirmationOpen(true);
    }
  };

  const handleViewInvoice = (order: OrderHistoryItem) => {
    setSelectedInvoiceOrder(order);
    setIsInvoiceOpen(true);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* 1. Header Bar */}
      <View style={[styles.headerBar, { backgroundColor: theme.background, borderBottomColor: theme.surfaceBorder }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Review & Checkout</Text>
          <Text style={[styles.headerSubtitle, { color: theme.primary }]}>
            Scheduled Delivery: {selectedDateOption ? `${selectedDateOption.dayName}, ${selectedDateOption.dayNumber} ${selectedDateOption.monthName}` : 'Selected Date'} • 12:00 PM
          </Text>
        </View>
        <TouchableOpacity
          onPress={onNavigateToMenu}
          style={[styles.menuBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
        >
          <Ionicons name="home-outline" size={18} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. Delivery Site Verification Card with Floor Selection */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="business" size={18} color={theme.textPrimary} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Delivery Destination</Text>
            </View>
            {canChangeFloor && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsFloorPickerOpen(true)}
                style={[styles.changeFloorPill, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}
              >
                <Ionicons name="swap-vertical" size={13} color={theme.textPrimary} />
                <Text style={[styles.changeFloorPillText, { color: theme.textPrimary }]}>Change Floor</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.siteBox, { backgroundColor: theme.surfaceHighlight }]}>
            <Ionicons name="location-sharp" size={18} color={theme.textPrimary} />
            <View style={styles.siteInfo}>
              <Text style={[styles.siteName, { color: theme.textPrimary }]}>
                {userCompany?.companyName || currentUser?.companyName || 'Corporate Partner'}
              </Text>
              <Text style={[styles.siteAddress, { color: theme.textSecondary }]}>
                {currentUser?.locationName || userCompany?.locations[0] || currentUser?.buildingName || 'Corporate Campus'} (Designated Drop-off)
              </Text>
              <View style={styles.floorRow}>
                <Text style={[styles.siteFloor, { color: theme.textPrimary, fontWeight: '700' }]}>
                  {selectedOrderFloor}
                </Text>
                {canChangeFloor && (
                  <TouchableOpacity onPress={() => setIsFloorPickerOpen(true)}>
                    <Text style={[styles.editFloorLink, { color: theme.textSecondary }]}>• Edit Floor</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* 3. Scheduled Items List */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="restaurant" size={18} color={theme.textPrimary} />
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
              Scheduled Items ({totalItemCount})
            </Text>
          </View>

          {displayItems.length === 0 ? (
            <View style={styles.emptyCartBox}>
              <Ionicons name="cart-outline" size={36} color={theme.textMuted} />
              <Text style={[styles.emptyCartTitle, { color: theme.textPrimary }]}>No meals scheduled</Text>
              <Text style={[styles.emptyCartSubtitle, { color: theme.textSecondary }]}>
                Browse our advance 14-weekday menu to schedule your lunch.
              </Text>
              <TouchableOpacity
                onPress={onNavigateToMenu}
                style={[styles.exploreBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.exploreBtnText, { color: theme.onPrimary }]}>Browse Menu</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.itemsList}>
              {(Object.entries(groupedCartByDate) as [string, CartItem[]][]).map(([dKey, dItems]) => (
                <View key={dKey} style={styles.dateGroupContainer}>
                  <View style={[styles.dateGroupHeader, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}>
                    <Ionicons name="calendar-outline" size={13} color={theme.textPrimary} />
                    <Text style={[styles.dateGroupHeaderTitle, { color: theme.textPrimary }]}>
                      Scheduled: {dKey}
                    </Text>
                    <Text style={[styles.dateGroupHeaderCount, { color: theme.textSecondary }]}>
                      ({dItems.reduce((s: number, i: CartItem) => s + i.quantity, 0)} meals)
                    </Text>
                  </View>

                  {dItems.map((cartItem) => (
                    <View
                      key={cartItem.id}
                      style={[styles.itemRow, { borderBottomColor: theme.surfaceBorder }]}
                    >
                      <View style={styles.itemInfo}>
                        <View style={styles.itemNameRow}>
                          <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                            {cartItem.menuItem.name}
                          </Text>
                          {cartItem.size === 'large' && (
                            <View style={[styles.sizeTag, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}>
                              <Text style={[styles.sizeTagText, { color: theme.textPrimary }]}>Large</Text>
                            </View>
                          )}
                        </View>

                        {cartItem.selectedAddOns && cartItem.selectedAddOns.length > 0 && (
                          <Text style={[styles.itemAddOnsText, { color: theme.textSecondary }]}>
                            + {cartItem.selectedAddOns.map((a: { name: string; price: number }) => `${a.name} (+R${a.price.toFixed(0)})`).join(', ')}
                          </Text>
                        )}

                        <Text style={[styles.itemPrice, { color: theme.textPrimary }]}>
                          R {cartItem.totalPrice.toFixed(2)} ({cartItem.quantity} x R {cartItem.unitPrice.toFixed(2)})
                        </Text>

                        {cartItem.allergyNotes ? (
                          <View style={[styles.notePill, { backgroundColor: theme.goldWarningSurface, borderColor: theme.goldWarningBorder }]}>
                            <Ionicons name="alert-circle-outline" size={12} color={theme.goldWarning} />
                            <Text style={[styles.noteText, { color: theme.goldWarning }]}>
                              Note: {cartItem.allergyNotes}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Quantity Stepper */}
                      <View style={styles.qtyBox}>
                        <TouchableOpacity
                          onPress={() => updateQuantity(cartItem.id, cartItem.quantity - 1)}
                          style={[styles.qtyBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorderLight }]}
                        >
                          <Ionicons
                            name={cartItem.quantity === 1 ? 'trash-outline' : 'remove'}
                            size={15}
                            color={cartItem.quantity === 1 ? theme.error : theme.textPrimary}
                          />
                        </TouchableOpacity>
                        <Text style={[styles.qtyNumber, { color: theme.textPrimary }]}>{cartItem.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => updateQuantity(cartItem.id, cartItem.quantity + 1)}
                          style={[styles.qtyBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorderLight }]}
                        >
                          <Ionicons name="add" size={15} color={theme.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ))}

              <TouchableOpacity
                onPress={() => clearCartForDate(selectedDate)}
                style={styles.clearDateBtn}
              >
                <Ionicons name="trash-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.clearDateText, { color: theme.textMuted }]}>
                  Clear items for active date
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 4. Order Financial Summary Card */}
        {displayItems.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Financial Summary</Text>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Item Subtotal</Text>
              <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{formattedSubtotal}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Corporate Delivery Fee (0–15km)</Text>
              <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>R 0.00 (Free Batch)</Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: theme.textPrimary }]}>Total Due</Text>
              <Text style={[styles.totalValue, { color: theme.textPrimary }]}>{formattedSubtotal}</Text>
            </View>
          </View>
        )}

        {/* 5. Operational Cutoff & No-Refund Guardrail Card */}
        <View style={[styles.cutoffCard, { backgroundColor: theme.goldWarningSurface, borderColor: theme.goldWarningBorder }]}>
          <Ionicons name="warning" size={20} color={theme.goldWarning} />
          <View style={styles.cutoffTextContainer}>
            <Text style={[styles.cutoffHeading, { color: theme.goldWarning }]}>STRICT CUTOFF & NO-REFUND POLICY</Text>
            <Text style={[styles.cutoffBody, { color: theme.textPrimary }]}>
              Ingredients are prepped in advance for zero waste. Orders cannot be modified, canceled, or refunded once the 9:00 AM SAST cutoff, two business days before delivery, passes.
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* 6. Checkout CTA Button */}
      {displayItems.length > 0 && (
        <View style={[styles.bottomBar, { backgroundColor: theme.surfaceElevated, borderTopColor: theme.surfaceBorder }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePayPress}
            style={[styles.payBtn, { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.payBtnText, { color: isDark ? '#121212' : '#FFFFFF' }]}>
              Pay {formattedSubtotal} with PayFast →
            </Text>
            <Text style={[styles.payBtnSublabel, { color: isDark ? '#121212' : '#FFFFFF', opacity: 0.9 }]}>
              PayFast Sandbox • Instant EFT & Card
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PayFast Modal */}
      <PayFastModal
        visible={isPayFastOpen}
        totalZarFormatted={formattedAmountDue}
        checkoutPayload={checkoutPayload}
        itemCount={totalItemCount}
        selectedDateOption={selectedDateOption}
        userLocation={`${currentUser?.companyName || 'Corporate Partner'} • ${currentUser?.deliveryFloor || 'Drop-off Floor'}`}
        userEmail={currentUser?.email || ''}
        onClose={() => setIsPayFastOpen(false)}
        onPaymentConfirmed={handlePaymentConfirmed}
      />

      {/* Order Confirmation Modal */}
      <OrderConfirmationModal
        visible={isConfirmationOpen}
        order={confirmedOrder}
        onClose={() => {
          setIsConfirmationOpen(false);
          onNavigateToMenu();
        }}
        onViewInvoice={handleViewInvoice}
        onTrackOrder={onNavigateToTracker}
      />

      {/* Tax Invoice Modal */}
      <TaxInvoiceModal
        visible={isInvoiceOpen}
        order={selectedInvoiceOrder}
        onClose={() => setIsInvoiceOpen(false)}
      />

      {/* Dynamic Floor Picker Modal */}
      <FloorPickerModal
        visible={isFloorPickerOpen}
        selectedFloor={selectedOrderFloor}
        availableFloors={availableFloors}
        companyName={userCompany?.companyName}
        onSelectFloor={(floor) => {
          setSelectedOrderFloor(floor);
          updateDropoffFloor(floor);
        }}
        onClose={() => setIsFloorPickerOpen(false)}
      />
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
    fontWeight: '600',
    marginTop: 2,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  companyName: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 1,
  },
  siteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginTop: 6,
  },
  siteInfo: {
    flex: 1,
    gap: 2,
  },
  siteName: {
    fontSize: 14,
    fontWeight: '800',
  },
  siteAddress: {
    fontSize: 12,
  },
  siteFloor: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  changeFloorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  changeFloorPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  floorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  editFloorLink: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  locationDetailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  locationDetailText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  changeFloorLink: {
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  changeFloorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyCartBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyCartTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCartSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  exploreBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  exploreBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemsList: {
    marginTop: 4,
  },
  dateGroupContainer: {
    marginBottom: 12,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  dateGroupHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateGroupHeaderCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 10,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  sizeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  sizeTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  itemAddOnsText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  notePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 0.5,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  noteText: {
    fontSize: 10,
    fontWeight: '600',
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyNumber: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 16,
    textAlign: 'center',
  },
  clearDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 6,
  },
  clearDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  cutoffCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
  },
  cutoffTextContainer: {
    flex: 1,
  },
  cutoffHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cutoffBody: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  bottomSpacer: {
    height: 140,
  },
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 76 : 64,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  payBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  payBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
  payBtnSublabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
});

/**
 * Cart Screen Component
 *
 * Displays the user's shopping cart with order items.
 * Notes are captured at the item level when adding from the menu,
 * eliminating duplicate note entry.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
  import { useKitchen } from '../context/KitchenCoContext';
import { useRouter } from 'expo-router';
import { getOrderCutoffInfo } from '../utils/deliveryHelpers';

export default function CartScreen() {
  const { cart, removeFromCart, clearCart, addToCart, discounts, appliedDiscount, setAppliedDiscount, isItemEligibleForDiscount, calculateDiscountAmount, deliveryInfo } = useKitchen();
  const router = useRouter();

  const [discountCode, setDiscountCode] = useState('');
  const [discountError, setDiscountError] = useState('');
  // In-app modal instead of Alert.alert — Alert is a documented no-op on
  // React Native Web with no polyfill in this project, so it renders nothing there.
  const [appliedDiscountNotice, setAppliedDiscountNotice] = useState<{ code: string; percentage: number } | null>(null);

  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Calculate discount only on eligible items
  const discountAmount = calculateDiscountAmount(cart, appliedDiscount);
  // Distance-based delivery fee — resolved automatically from the user's
  // company address (corporate accounts) or default saved address.
  const deliveryFee = deliveryInfo.fee ?? 0;
  const finalTotal = totalPrice - discountAmount + deliveryFee;

  // Business hours + 48-hour advance ordering cutoff info
  const cutoffInfo = getOrderCutoffInfo();

  // Track which items get the discount for display purposes
  const getItemSavings = (itemId: string): number => {
    if (!appliedDiscount) return 0;
    const item = cart.find(i => i.id === itemId);
    if (!item || !isItemEligibleForDiscount(item, appliedDiscount)) return 0;
    return (item.price * item.quantity) * appliedDiscount.percentage / 100;
  };

  const handleApplyDiscount = () => {
    if (!discountCode.trim()) {
      setDiscountError('Please enter a discount code');
      return;
    }

    const foundDiscount = discounts.find(
      d => d.code.toUpperCase() === discountCode.trim().toUpperCase() && d.active
    );

    if (!foundDiscount) {
      setDiscountError('Invalid or inactive discount code');
      return;
    }

    if (foundDiscount.expires) {
      const expiryDate = new Date(foundDiscount.expires);
      const today = new Date();
      if (expiryDate < today) {
        setDiscountError('This discount code has expired');
        return;
      }
    }

    setAppliedDiscount(foundDiscount);
    setDiscountCode('');
    setDiscountError('');
    setAppliedDiscountNotice({ code: foundDiscount.code, percentage: foundDiscount.percentage });
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
  };

  const renderCartItem = ({ item }: { item: any }) => (
    <View style={styles.cartItem}>
      {/* Item details: name, size, notes, price */}
      <View style={styles.itemMeta}>
        <Text style={styles.itemName}>{item.name}</Text>
        {(item.selectedSize || item.category) && (
          <Text style={styles.itemSize}>
            {item.selectedSize || item.category}
          </Text>
        )}
        {item.deliveryDateLabel && (
          <Text style={styles.itemDeliveryDate}>📅 {item.deliveryDateLabel}</Text>
        )}
        {item.addOns && item.addOns.length > 0 && (
          <Text style={styles.itemAddOns}>+ {item.addOns.map((a: any) => a.name).join(', ')}</Text>
        )}
        {/* Display notes captured from menu (no duplicate input needed) */}
        {item.notes && (
          <Text style={styles.itemNotes}>📝 {item.notes}</Text>
        )}
        {appliedDiscount && isItemEligibleForDiscount(item, appliedDiscount) && (
          <Text style={styles.itemDiscountBadge}>
            🔥 {appliedDiscount.percentage}% OFF (save R{getItemSavings(item.id).toFixed(2)})
          </Text>
        )}
        <Text style={styles.itemPrice}>
          {appliedDiscount && isItemEligibleForDiscount(item, appliedDiscount) ? (
            <Text>
              <Text style={styles.originalPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
              {' '}R{((item.price * item.quantity) - (item.price * item.quantity) * appliedDiscount.percentage / 100).toFixed(2)}
            </Text>
          ) : (
            'R' + (item.price * item.quantity).toFixed(2)
          )}
        </Text>
      </View>

      {/* Quantity controls: +/- buttons */}
      <View style={styles.quantityControls}>
        <TouchableOpacity
          onPress={() => removeFromCart(item.id)}
          style={styles.qtyBtn}
        >
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyVal}>{item.quantity}</Text>
        <TouchableOpacity
          onPress={() =>
            addToCart({
              id: item.id,
              name: item.name,
              price: item.price,
              category: item.category,
              quantity: 1,
              image: item.image,
              selectedSize: item.selectedSize,
              // Preserve notes when adding more of the same item
              notes: item.notes,
            })
          }
          style={styles.qtyBtn}
        >
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🛒</Text>
      <Text style={styles.emptyText}>Your cart is empty</Text>
      <Text style={styles.emptySubtext}>
        Add some delicious meals to get started
      </Text>
      <TouchableOpacity
        style={styles.shopBtn}
        onPress={() => router.push('/')}
      >
        <Text style={styles.shopBtnText}>Browse Menu</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCartContent = () => (
    <>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
      <View style={styles.list}>
        {cart.map(item => (
          <React.Fragment key={item.id}>{renderCartItem({ item })}</React.Fragment>
        ))}
      </View>

      <View style={styles.discountSection}>
        <Text style={styles.discountSectionTitle}>Discount Code</Text>
        
        {appliedDiscount ? (
          <View style={styles.appliedDiscountCard}>
            <View style={styles.appliedDiscountInfo}>
              <Text style={styles.appliedDiscountCode}>{appliedDiscount.code}</Text>
              <Text style={styles.appliedDiscountPercent}>-{appliedDiscount.percentage}% OFF</Text>
            </View>
            <TouchableOpacity onPress={handleRemoveDiscount} style={styles.removeDiscountBtn}>
              <Text style={styles.removeDiscountText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <React.Fragment>
            <View style={styles.discountInputRow}>
              <TextInput
                style={[styles.discountInput, discountError ? styles.discountInputError : null]}
                placeholder="Enter discount code"
                placeholderTextColor="#6B6B6B"
                value={discountCode}
                onChangeText={text => {
                  setDiscountCode(text);
                  setDiscountError('');
                }}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.applyDiscountBtn} onPress={handleApplyDiscount}>
                <Text style={styles.applyDiscountBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
            {discountError ? (
              <Text style={styles.discountErrorText}>{discountError}</Text>
            ) : null}
          </React.Fragment>
        )}
      </View>

      <View style={styles.priceBreakdown}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Subtotal</Text>
          <Text style={styles.priceValue}>R {totalPrice.toFixed(2)}</Text>
        </View>

        {deliveryInfo.fee != null ? (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Delivery Fee ({deliveryInfo.distanceKm}km)</Text>
            <Text style={styles.priceValue}>R {deliveryFee.toFixed(2)}</Text>
          </View>
        ) : (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabelWarning}>
              {deliveryInfo.addressLabel
                ? 'Delivery fee unavailable — address missing a distance'
                : 'Add a delivery address to see your delivery fee'}
            </Text>
            <TouchableOpacity onPress={() => router.push('/profile')}>
              <Text style={styles.addAddressLink}>Add</Text>
            </TouchableOpacity>
          </View>
        )}

        {appliedDiscount && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Discount ({appliedDiscount.percentage}%)</Text>
            <Text style={styles.discountValue}>- R {discountAmount.toFixed(2)}</Text>
          </View>
        )}

        <View style={[styles.priceRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>R {finalTotal.toFixed(2)}</Text>
        </View>
      </View>

      {/* Business hours / 48h advance ordering cutoff notice */}
      <View style={styles.cutoffNotice}>
        <Text style={styles.cutoffNoticeIcon}>🕒</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cutoffNoticeTitle}>
            {cutoffInfo.cutoffPassed
              ? "Today's 9:00 AM cutoff has passed"
              : 'Ordering open · cutoff 9:00 AM'}
          </Text>
          <Text style={styles.cutoffNoticeText}>{cutoffInfo.message}</Text>
          <Text style={styles.cutoffNoticeDate}>
            Earliest delivery: {cutoffInfo.formattedEarliest}
          </Text>
        </View>
      </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => router.push('/payfast')}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutBtnText}>Checkout</Text>
          <Text style={styles.checkoutBtnTotal}>R {finalTotal.toFixed(2)}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Status bar */}
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header with back button and clear cart action */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Menu</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart</Text>
        {cart.length > 0 ? (
          <TouchableOpacity onPress={clearCart}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Content: either empty state or cart items */}
      {cart.length === 0 ? renderEmptyCart() : renderCartContent()}

      <Modal
        visible={!!appliedDiscountNotice}
        animationType="fade"
        transparent
        onRequestClose={() => setAppliedDiscountNotice(null)}
      >
        <View style={styles.noticeOverlay}>
          <View style={styles.noticeCard}>
            <Text style={styles.noticeIcon}>🎉</Text>
            <Text style={styles.noticeTitle}>Discount applied!</Text>
            <Text style={styles.noticeText}>
              {appliedDiscountNotice?.code} — {appliedDiscountNotice?.percentage}% off eligible items
            </Text>
            <TouchableOpacity style={styles.noticeBtn} onPress={() => setAppliedDiscountNotice(null)}>
              <Text style={styles.noticeBtnText}>Nice!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Base styles with consistent black/grey/white color palette
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  backBtn: { padding: 5 },
  backBtnText: { color: '#000000', fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#000000' },
  clearText: { color: '#E0393E', fontSize: 14, fontWeight: '700' },

  // Empty state styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 20,
    textAlign: 'center',
  },
  shopBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
  },
  shopBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  // Scroll area holds everything except the sticky footer, so the checkout
  // button is always fully visible instead of being pushed off-screen on
  // shorter phones once the cart grows (items + discount + cutoff notice).
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Cart item styles
  list: { padding: 20 },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  itemMeta: { flex: 1, paddingRight: 12 },
  itemName: { fontSize: 16, fontWeight: '700', color: '#000000' },
  itemSize: { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  itemNotes: {
    fontSize: 12,
    color: '#1DA836',
    marginTop: 4,
    fontStyle: 'italic',
  },
  itemDeliveryDate: {
    fontSize: 12,
    color: '#000000',
    marginTop: 4,
    fontWeight: '600',
  },
  itemAddOns: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 2,
  },
  itemDiscountBadge: {
    fontSize: 11,
    color: '#E8A100',
    marginTop: 4,
    fontWeight: '700',
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: '#9E9E9E',
    fontSize: 13,
  },
  itemPrice: {
    fontSize: 14,
    color: '#6B6B6B',
    marginTop: 4,
    fontWeight: '600',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { color: '#000000', fontSize: 18, fontWeight: 'bold' },
  qtyVal: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
  },

  discountSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    marginTop: 12,
  },
  discountSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  discountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountInput: {
    flex: 1,
    backgroundColor: '#F6F6F6',
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    color: '#000000',
  },
  discountInputError: {
    borderColor: '#E0393E',
  },
  applyDiscountBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginLeft: 8,
  },
  applyDiscountBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  discountErrorText: {
    color: '#E0393E',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  appliedDiscountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EAF7EE',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1DA836',
  },
  appliedDiscountInfo: {
    flex: 1,
  },
  appliedDiscountCode: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1DA836',
    letterSpacing: 0.5,
  },
  appliedDiscountPercent: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 2,
  },
  removeDiscountBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FDECEA',
    borderRadius: 8,
  },
  removeDiscountText: {
    color: '#E0393E',
    fontSize: 12,
    fontWeight: '700',
  },

  priceBreakdown: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: { fontSize: 14, color: '#6B6B6B' },
  priceValue: { fontSize: 14, color: '#000000', fontWeight: '600' },
  priceLabelWarning: { fontSize: 13, color: '#E8A100', flex: 1, paddingRight: 10 },
  addAddressLink: { fontSize: 13, color: '#000000', fontWeight: '700', textDecorationLine: 'underline' },
  discountValue: { fontSize: 14, color: '#1DA836', fontWeight: '600' },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    marginBottom: 0,
  },
    totalLabel: { fontSize: 15, fontWeight: '800', color: '#000000' },
  totalValue: { fontSize: 16, fontWeight: '900', color: '#000000' },

  cutoffNotice: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#F0DFA0',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 10,
  },
  cutoffNoticeIcon: { fontSize: 18 },
  cutoffNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8A6D00',
    marginBottom: 2,
  },
  cutoffNoticeText: { fontSize: 12, color: '#6B6B6B', lineHeight: 17 },
  cutoffNoticeDate: { fontSize: 11, color: '#6B6B6B', marginTop: 4 },

  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  checkoutBtn: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  checkoutBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  checkoutBtnTotal: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', opacity: 0.65 },

  noticeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  noticeCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
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
  noticeIcon: { fontSize: 36, marginBottom: 12 },
  noticeTitle: { fontSize: 18, fontWeight: '900', color: '#000000', marginBottom: 8, textAlign: 'center' },
  noticeText: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  noticeBtn: { backgroundColor: '#1DA836', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, alignSelf: 'stretch', alignItems: 'center' },
  noticeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
/**
 * Cart Screen Component
 *
 * Displays the user's shopping cart with order items.
 * Notes are captured at the item level when adding from the menu,
 * eliminating duplicate note entry.
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Modal,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKitchen } from '../context/KitchenCoContext';
import { useRouter } from 'expo-router';
import { getOrderCutoffInfo } from '../utils/deliveryHelpers';
import { ThemeColors } from '../utils/theme';

export default function CartScreen() {
  const { cart, removeFromCart, clearCart, addToCart, discounts, appliedDiscount, setAppliedDiscount, isItemEligibleForDiscount, calculateDiscountAmount, calculateSubsidyAmount, deliveryInfo, theme } = useKitchen();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
  // Company meal subsidy — automatic, no code needed; zero unless the user
  // is attached to a subsidizing company.
  const subsidyAmount = calculateSubsidyAmount(cart);
  // Distance-based delivery fee — resolved automatically from the user's
  // company address (corporate accounts) or default saved address.
  const deliveryFee = deliveryInfo.fee ?? 0;
  const finalTotal = Math.max(0, totalPrice - discountAmount - subsidyAmount) + deliveryFee;

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
          accessibilityRole="button"
          accessibilityLabel={item.quantity === 1 ? `Remove ${item.name} from cart` : `Decrease quantity of ${item.name}`}
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
          accessibilityRole="button"
          accessibilityLabel={`Increase quantity of ${item.name}`}
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
        accessibilityRole="button"
        accessibilityLabel="Browse menu"
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
            <TouchableOpacity
              onPress={handleRemoveDiscount}
              style={styles.removeDiscountBtn}
              accessibilityRole="button"
              accessibilityLabel={`Remove discount code ${appliedDiscount.code}`}
            >
              <Text style={styles.removeDiscountText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <React.Fragment>
            <View style={styles.discountInputRow}>
              <TextInput
                style={[styles.discountInput, discountError ? styles.discountInputError : null]}
                placeholder="Enter discount code"
                placeholderTextColor={theme.textTertiary}
                value={discountCode}
                onChangeText={text => {
                  setDiscountCode(text);
                  setDiscountError('');
                }}
                autoCapitalize="characters"
                accessibilityLabel="Discount code"
              />
              <TouchableOpacity
                style={styles.applyDiscountBtn}
                onPress={handleApplyDiscount}
                accessibilityRole="button"
                accessibilityLabel="Apply discount code"
              >
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
            <TouchableOpacity
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Add delivery address"
            >
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

        {subsidyAmount > 0 && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Company Meal Subsidy</Text>
            <Text style={styles.discountValue}>- R {subsidyAmount.toFixed(2)}</Text>
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
          accessibilityRole="button"
          accessibilityLabel={`Checkout, total R${finalTotal.toFixed(2)}`}
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
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />

      {/* Header with back button and clear cart action */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to menu"
        >
          <Text style={styles.backBtnText}>← Menu</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart</Text>
        {cart.length > 0 ? (
          <TouchableOpacity
            onPress={clearCart}
            accessibilityRole="button"
            accessibilityLabel="Clear cart"
          >
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
            <TouchableOpacity
              style={styles.noticeBtn}
              onPress={() => setAppliedDiscountNotice(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <Text style={styles.noticeBtnText}>Nice!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Theme-driven styles — colors come from the active theme so the screen
// responds to light/dark mode. A few decorative "badge"/"notice card" color
// sets (discount badge, applied-discount coupon card, cutoff notice) are
// intentionally kept as literal hex rather than theme tokens, matching how
// the Menu screen keeps its own discount badges and dietary tag chips literal
// — these are content/status colors, not grayscale UI chrome.
const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: { padding: 5 },
  backBtnText: { color: theme.text, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
  clearText: { color: theme.error, fontSize: 14, fontWeight: '700' },

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
    color: theme.text,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  shopBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
  },
  shopBtnText: { color: theme.onAccent, fontWeight: '800', fontSize: 15 },

  // Scroll area holds everything except the sticky footer, so the checkout
  // button is always fully visible instead of being pushed off-screen on
  // shorter phones once the cart grows (items + discount + cutoff notice).
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Cart item styles
  list: { padding: 20, gap: 10 },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 14,
    // Matches the Menu screen's uberCard elevation, scaled down slightly
    // since these rows are denser/smaller than a grid card.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  itemMeta: { flex: 1, paddingRight: 12 },
  itemName: { fontSize: 16, fontWeight: '700', color: theme.text },
  itemSize: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  itemNotes: {
    fontSize: 12,
    color: theme.success,
    marginTop: 4,
    fontStyle: 'italic',
  },
  itemDeliveryDate: {
    fontSize: 12,
    color: theme.text,
    marginTop: 4,
    fontWeight: '600',
  },
  itemAddOns: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  // Decorative discount hint — kept literal, like the Menu screen's
  // menuDiscountHint, so it reads the same "orange savings tag" in both themes.
  itemDiscountBadge: {
    fontSize: 11,
    color: '#E8A100',
    marginTop: 4,
    fontWeight: '700',
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: theme.textTertiary,
    fontSize: 13,
  },
  itemPrice: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { color: theme.text, fontSize: 18, fontWeight: 'bold' },
  qtyVal: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
  },

  discountSection: {
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 12,
  },
  discountSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.text,
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
    backgroundColor: theme.inputBg,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    color: theme.text,
  },
  discountInputError: {
    borderColor: theme.error,
  },
  applyDiscountBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginLeft: 8,
  },
  applyDiscountBtnText: {
    color: theme.onAccent,
    fontWeight: '800',
    fontSize: 14,
  },
  discountErrorText: {
    color: theme.error,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  // Applied-discount "coupon" card — a decorative success-green pill, kept
  // literal (like the Menu screen's dietary tag chips) so it reads as the
  // same consistent green badge regardless of theme.
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
  // appliedDiscountCard's background is a fixed light-green tint in both
  // themes (see appliedDiscountCard above) — this text must stay literal too.
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
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: { fontSize: 14, color: theme.textSecondary },
  priceValue: { fontSize: 14, color: theme.text, fontWeight: '600' },
  priceLabelWarning: { fontSize: 13, color: theme.warning, flex: 1, paddingRight: 10 },
  addAddressLink: { fontSize: 13, color: theme.text, fontWeight: '700', textDecorationLine: 'underline' },
  discountValue: { fontSize: 14, color: theme.success, fontWeight: '600' },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    marginBottom: 0,
  },
    totalLabel: { fontSize: 15, fontWeight: '800', color: theme.text },
  totalValue: { fontSize: 16, fontWeight: '900', color: theme.text },

  // Cutoff notice — a decorative "heads up" amber card, kept literal for the
  // same reason as the discount badge/coupon colors above.
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
  // cutoffNotice's background is a fixed light-amber tint in both themes
  // (see cutoffNotice above) — same reasoning, this text must stay literal.
  cutoffNoticeText: { fontSize: 12, color: '#6B6B6B', lineHeight: 17 },
  cutoffNoticeDate: { fontSize: 11, color: '#6B6B6B', marginTop: 4 },

  footer: {
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  checkoutBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  checkoutBtnText: { color: theme.onAccent, fontSize: 16, fontWeight: '800' },
  checkoutBtnTotal: { color: theme.onAccent, fontSize: 16, fontWeight: '800', opacity: 0.65 },

  noticeOverlay: { flex: 1, backgroundColor: theme.modalOverlay, justifyContent: 'center', alignItems: 'center' },
  noticeCard: {
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
  noticeIcon: { fontSize: 36, marginBottom: 12 },
  noticeTitle: { fontSize: 18, fontWeight: '900', color: theme.text, marginBottom: 8, textAlign: 'center' },
  noticeText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  noticeBtn: { backgroundColor: theme.success, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, alignSelf: 'stretch', alignItems: 'center' },
  noticeBtnText: { color: theme.white, fontSize: 15, fontWeight: '800' },
});
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
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { useKitchen } from '../context/KitchenCoContext';
import { useRouter } from 'expo-router';

export default function CartScreen() {
  const { cart, removeFromCart, clearCart, addToCart, discounts, appliedDiscount, setAppliedDiscount, isItemEligibleForDiscount, calculateDiscountAmount } = useKitchen();
  const router = useRouter();

  const [discountCode, setDiscountCode] = useState('');
  const [discountError, setDiscountError] = useState('');

  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Calculate discount only on eligible items
  const discountAmount = calculateDiscountAmount(cart, appliedDiscount);
  const finalTotal = totalPrice - discountAmount;

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
    Alert.alert('Success', 'Discount ' + foundDiscount.code + ' applied! ' + foundDiscount.percentage + '% off');
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
      <FlatList
        data={cart}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderCartItem}
      />

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

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => router.push('/payfast')}
        >
          <Text style={styles.checkoutBtnText}>Checkout</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Status bar */}
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
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
    </SafeAreaView>
  );
}

// Base styles with consistent black/grey/white color palette
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  backBtn: { padding: 5 },
  backBtnText: { color: '#5AC8FA', fontSize: 15, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  clearText: { color: '#FF453A', fontSize: 14, fontWeight: '700' },

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
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 20,
    textAlign: 'center',
  },
  shopBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
  },
  shopBtnText: { color: '#000000', fontWeight: '800', fontSize: 15 },

  // Cart item styles
  list: { padding: 20 },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  itemMeta: { flex: 1, paddingRight: 12 },
  itemName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  itemSize: { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  itemNotes: {
    fontSize: 12,
    color: '#00C853',
    marginTop: 4,
    fontStyle: 'italic',
  },
  itemDiscountBadge: {
    fontSize: 11,
    color: '#FF9500',
    marginTop: 4,
    fontWeight: '700',
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: '#6B6B6B',
    fontSize: 13,
  },
  itemPrice: {
    fontSize: 14,
    color: '#A0A0A0',
    marginTop: 4,
    fontWeight: '600',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C0C0C',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1C1C1E',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  qtyVal: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
  },

  discountSection: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginTop: 12,
  },
  discountSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
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
    backgroundColor: '#151515',
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    color: '#FFFFFF',
  },
  discountInputError: {
    borderColor: '#FF453A',
  },
  applyDiscountBtn: {
    backgroundColor: '#5AC8FA',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginLeft: 8,
  },
  applyDiscountBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 14,
  },
  discountErrorText: {
    color: '#FF453A',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  appliedDiscountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  appliedDiscountInfo: {
    flex: 1,
  },
  appliedDiscountCode: {
    fontSize: 15,
    fontWeight: '800',
    color: '#22C55E',
    letterSpacing: 0.5,
  },
  appliedDiscountPercent: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  removeDiscountBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FF453A20',
    borderRadius: 8,
  },
  removeDiscountText: {
    color: '#FF453A',
    fontSize: 12,
    fontWeight: '700',
  },

  priceBreakdown: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: { fontSize: 14, color: '#8E8E93' },
  priceValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
  discountValue: { fontSize: 14, color: '#22C55E', fontWeight: '600' },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    marginBottom: 0,
  },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  totalValue: { fontSize: 16, fontWeight: '900', color: '#22C55E' },

  footer: {
    backgroundColor: '#0C0C0C',
    borderTopWidth: 1,
    borderTopColor: '#1C1C1E',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  checkoutBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutBtnText: { color: '#000000', fontSize: 16, fontWeight: '800' },
});
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useKitchen } from '../context/KitchenCoContext';

export default function FloatingCartBanner() {
  const { cart, appliedDiscount, calculateDiscountAmount } = useKitchen();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = calculateDiscountAmount(cart, appliedDiscount);
  const finalTotal = totalPrice - discountAmount;

  if (totalItems === 0 || dismissed) return null;

  return (
    <View style={styles.floatingContainer}>
      <TouchableOpacity 
        style={styles.banner} 
        activeOpacity={0.9}
        onPress={() => router.push('/cart')}
      >
        <View style={styles.leftSection}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalItems}</Text>
          </View>
          <Text style={styles.bannerText}>View Cart</Text>
        </View>
        
        <Text style={styles.totalText}>
          {appliedDiscount ? (
            <>
              <Text style={styles.originalPrice}>R {totalPrice.toFixed(2)}</Text>
              {' '}R {finalTotal.toFixed(2)}
            </>
          ) : (
            'R ' + totalPrice.toFixed(2)
          )} ➔
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.dismissBtn}
        onPress={() => setDismissed(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  banner: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#FF8C5A',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#FF6B35',
    fontWeight: '900',
    fontSize: 14,
  },
  bannerText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.3,
  },
  totalText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: -0.3,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: 'normal',
  },
  dismissBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1A1D24',
    borderWidth: 1,
    borderColor: '#2E3340',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    color: '#9AA3B2',
    fontSize: 12,
    fontWeight: '700',
  },
});
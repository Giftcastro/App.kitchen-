import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { useRouter } from 'expo-router';
import { useKitchen } from '../context/KitchenCoContext';
import { ThemeColors } from '../utils/theme';

export default function FloatingCartBanner() {
  const { cart, appliedDiscount, calculateDiscountAmount, theme } = useKitchen();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${totalItems} item${totalItems === 1 ? '' : 's'}, total R${finalTotal.toFixed(2)}`}
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
        accessibilityRole="button"
        accessibilityLabel="Dismiss cart banner"
      >
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  banner: {
    backgroundColor: theme.accent,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: theme.onAccent,
    borderRadius: 16,
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    paddingHorizontal: 8,
  },
  badgeText: {
    color: theme.accent,
    fontWeight: '900',
    fontSize: 14,
  },
  bannerText: {
    color: theme.onAccent,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.3,
  },
  totalText: {
    color: theme.onAccent,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: -0.3,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: theme.onAccent + '99',
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
    backgroundColor: theme.accent,
    borderWidth: 1.5,
    borderColor: theme.onAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    color: theme.onAccent,
    fontSize: 12,
    fontWeight: '700',
  },
});
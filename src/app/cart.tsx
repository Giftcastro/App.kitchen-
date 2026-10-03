/** CartPage.xaml + CartPageViewModel. */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text } from '../components/AppText';
import { alerts } from '../components/Alerts';
import { Btn, Page } from '../components/ui';
import { useApp } from '../state/AppState';
import { setNavParam } from '../state/navParams';
import { CYCLE_WINDOW, fmtDayLabel, isValidDeliveryDate, STATIC_WINDOW } from '../services/scheduling';
import { getCompany, getDeliveryLocation } from '../services/directory';
import { getDiscounts } from '../services/promos';
import { quoteCart } from '../services/pricing';
import { fixed } from '../utils/theme';
import { lineTotal } from '../models';
import type { Company, CompanyLocation, Discount } from '../models';

export default function CartScreen() {
  const { colors, isDark, user, cartItems, removeCartItem, setCartQuantity } = useApp();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [location, setLocation] = useState<CompanyLocation | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getCompany(user.accountType === 'company' ? user.companyId : '').then(setCompany).catch(() => setCompany(null));
      getDeliveryLocation(user).then(setLocation).catch(() => setLocation(null));
      getDiscounts().then(setDiscounts).catch(() => setDiscounts([]));
    }, [user])
  );

  const quote = useMemo(() => quoteCart(cartItems, user, company, location, discounts), [cartItems, user, company, location, discounts]);
  const hasItems = cartItems.length > 0;

  const decrease = (key: string, quantity: number) => (quantity > 1 ? setCartQuantity(key, quantity - 1) : removeCartItem(key));

  const checkout = async () => {
    if (!hasItems) return;
    const invalid = cartItems.filter(i => !isValidDeliveryDate(i.deliveryDate, i.menuType === 'cycle' ? CYCLE_WINDOW : STATIC_WINDOW));
    if (invalid.length > 0) {
      await alerts.show(
        'Some items need a new date',
        `These items are past their order cutoff and need a new delivery date: ${invalid.map(i => i.product.name).join(', ')}`,
        'OK'
      );
      return;
    }
    if (!user) {
      await alerts.show('Please log in', 'You need to be logged in to place an order.', 'OK');
      return;
    }
    if (quote.isOutsideDeliveryRange) {
      await alerts.show(
        'Outside Delivery Range',
        'Your delivery location is beyond our 50km delivery range. Please contact us directly to arrange this order.',
        'OK'
      );
      return;
    }
    if (!location) {
      await alerts.show('No Delivery Location', "Your account doesn't have a delivery location yet. Please contact support to have one assigned.", 'OK');
      return;
    }
    setNavParam('Payment', { amountDue: quote.amountDue, deliveryFee: quote.deliveryFee, addressId: location.id });
    router.push('/payment');
  };

  return (
    <Page bg={colors.cream}>
      <View style={styles.fill}>
        <FlatList
          data={cartItems}
          keyExtractor={item => item.key}
          contentContainerStyle={[styles.list, !hasItems && styles.listEmpty]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>🛒</Text>
              <Text style={styles.emptyText}>Your basket is empty</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.item, { backgroundColor: isDark ? colors.cardBg : '#FFFFFF' }]}>
              <View style={styles.itemTop}>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.product.name}</Text>
                  <Text style={[styles.itemPrice, { color: colors.primary }]}>R{lineTotal(item).toFixed(2)}</Text>
                  <Text style={[styles.itemDate, { color: colors.primary }]}>For {fmtDayLabel(item.deliveryDate)}</Text>
                </View>
                <Pressable onPress={() => removeCartItem(item.key)} style={styles.remove} accessibilityLabel={`Remove ${item.product.name}`}>
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>

              <View style={styles.itemMiddle}>
                <View style={styles.options}>
                  {item.selectedOptions.map(o => (
                    <View key={o.name} style={styles.optionChip}>
                      <Text style={styles.optionText}>{o.name}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => decrease(item.key, item.quantity)}
                    style={[styles.stepBtn, { backgroundColor: isDark ? '#333333' : '#E0E0E0' }]}
                    accessibilityLabel="Decrease quantity"
                  >
                    <Text style={[styles.stepText, { color: isDark ? '#FFFFFF' : '#000000' }]}>-</Text>
                  </Pressable>
                  <Text style={[styles.qty, { color: colors.text }]}>{item.quantity}</Text>
                  <Pressable
                    onPress={() => setCartQuantity(item.key, item.quantity + 1)}
                    style={[styles.stepBtn, { backgroundColor: colors.primary }]}
                    accessibilityLabel="Increase quantity"
                  >
                    <Text style={[styles.stepText, { color: colors.onPrimary }]}>+</Text>
                  </Pressable>
                </View>
              </View>

              {!!item.specialRequests.trim() && <Text style={styles.note}>Note: {item.specialRequests}</Text>}
              {!!item.allergyNotes.trim() && <Text style={styles.allergy}>⚠️ Allergy alert: {item.allergyNotes}</Text>}
            </View>
          )}
        />

        {hasItems && (
          <View style={[styles.board, { backgroundColor: isDark ? colors.cardBg : '#FFFFFF' }]}>
            <View style={styles.row}>
              <Text style={styles.mealLabel}>Meal Total:</Text>
              <Text style={styles.mealValue}>R{quote.cartTotal.toFixed(2)}</Text>
            </View>
            {!!quote.subsidyLabel && (
              <View style={styles.row}>
                <Text style={[styles.subsidyLabel, { color: colors.primary }]}>{quote.subsidyLabel}</Text>
                <Text style={[styles.subsidyValue, { color: colors.primary }]}>-R{quote.subsidyTotal.toFixed(2)}</Text>
              </View>
            )}
            {quote.discountAmount > 0 && (
              <View style={styles.row}>
                <Text style={[styles.subsidyLabel, { color: colors.primary }]}>{quote.discountLabel}</Text>
                <Text style={[styles.subsidyValue, { color: colors.primary }]}>-R{quote.discountAmount.toFixed(2)}</Text>
              </View>
            )}
            {!!quote.deliveryFeeLabel && (
              <View style={styles.row}>
                <Text style={[styles.feeLabel, quote.isOutsideDeliveryRange && styles.feeLabelBad]}>{quote.deliveryFeeLabel}</Text>
                {!quote.isOutsideDeliveryRange && <Text style={[styles.feeValue, { color: colors.text }]}>R{quote.deliveryFee.toFixed(2)}</Text>}
              </View>
            )}
            {!!quote.subsidyLabel && <View style={[styles.divider, { backgroundColor: isDark ? '#333333' : '#E0E0E0' }]} />}
            <View style={styles.row}>
              <Text style={[styles.payLabel, { color: colors.text }]}>You Pay:</Text>
              <Text style={[styles.payValue, { color: colors.primary }]}>R{quote.amountDue.toFixed(2)}</Text>
            </View>
            <Btn testID="proceed-to-payment" title="Proceed to Payment" onPress={checkout} height={50} radius={10} />
          </View>
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: 15 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, padding: 20 },
  emptyText: { fontSize: 18, fontWeight: '700', color: 'gray' },
  item: { borderRadius: 10, marginBottom: 12, padding: 15, gap: 8 },
  itemTop: { flexDirection: 'row' },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 16, fontWeight: '700' },
  itemPrice: { fontSize: 14, fontWeight: '700' },
  itemDate: { fontSize: 12, fontWeight: '700' },
  remove: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: 'red', fontSize: 14 },
  itemMiddle: { flexDirection: 'row', alignItems: 'center' },
  options: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  optionChip: { backgroundColor: 'lightgray', borderRadius: 4, marginRight: 6, marginBottom: 6 },
  optionText: { fontSize: 11, color: 'black', marginHorizontal: 6, marginVertical: 3 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 16, fontWeight: '700' },
  qty: { fontSize: 14, fontWeight: '700', width: 24, textAlign: 'center' },
  note: { fontSize: 12, color: 'gray', fontStyle: 'italic' },
  allergy: { fontSize: 12, fontWeight: '700', color: fixed.amber },
  board: { borderTopLeftRadius: 15, borderTopRightRadius: 15, padding: 20, gap: 15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  mealLabel: { fontSize: 14, color: 'gray' },
  mealValue: { fontSize: 16, color: 'gray' },
  subsidyLabel: { flex: 1, fontSize: 12 },
  subsidyValue: { fontSize: 16, fontWeight: '700' },
  feeLabel: { flex: 1, fontSize: 12, color: 'gray' },
  feeLabelBad: { color: '#C62828', fontWeight: '700' },
  feeValue: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1 },
  payLabel: { fontSize: 16, fontWeight: '700' },
  payValue: { fontSize: 22, fontWeight: '700' },
});

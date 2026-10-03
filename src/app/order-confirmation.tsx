/** OrderConfirmationPage.xaml + OrderConfirmationViewModel. */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/AppText';
import { Btn, Card, Page } from '../components/ui';
import { useApp } from '../state/AppState';
import { getNavParam, setNavParam } from '../state/navParams';
import { fmtLongDate } from '../services/scheduling';
import { fixed } from '../utils/theme';

export default function OrderConfirmationScreen() {
  const { colors } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders] = useState(() => getNavParam('Orders') ?? []);
  const firstOrder = orders[0];
  const totalPaid = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const lines = orders.flatMap(o => o.lines);

  const backToTabs = (path: '/' | '/orders') => {
    router.dismissAll();
    router.navigate(path);
  };

  const viewInvoice = () => {
    if (!firstOrder) return;
    setNavParam('Order', firstOrder);
    router.push('/tax-invoice');
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 20 + insets.top }]}>
        <View style={styles.badgeBlock}>
          <View style={styles.badge}>
            <Text style={styles.tick}>✓</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Order Scheduled &amp; Paid!</Text>
          {firstOrder && <Text style={[styles.orderNo, { color: colors.primary }]}>Order #{firstOrder.orderNumber}</Text>}
        </View>

        {firstOrder && (
          <Card radius={14} border={colors.surfaceBorder}>
            <View style={styles.stack4}>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>DELIVERY DATE</Text>
              <Text style={[styles.value, { color: colors.text }]}>{fmtLongDate(firstOrder.deliveryDate)}</Text>
            </View>
          </Card>
        )}

        <Card radius={14} border={colors.surfaceBorder}>
          <View style={styles.stack10}>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>ITEMS IN THIS BATCH ({lines.length})</Text>
            {lines.map((line, index) => (
              <View key={`${line.name}-${index}`} style={styles.row}>
                <Text style={[styles.itemName, { color: colors.text }]}>{line.quantity > 1 ? `${line.quantity}x ${line.name}` : line.name}</Text>
                <Text style={[styles.itemAmount, { color: colors.primary }]}>R {(line.unitPrice * line.quantity).toFixed(2)}</Text>
              </View>
            ))}
            <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />
            <View style={styles.row}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>Total Paid</Text>
              <Text style={[styles.totalValue, { color: colors.primary }]}>R {totalPaid.toFixed(2)}</Text>
            </View>
          </View>
        </Card>

        <Btn title="Track My Order" onPress={() => backToTabs('/orders')} bold radius={10} height={48} />
        <Btn title="View Tax Invoice" onPress={viewInvoice} variant="outline" color={colors.text} bold radius={10} height={48} />
        <Btn title="Done" onPress={() => backToTabs('/')} variant="ghost" color={colors.textSecondary} fontSize={13} height={40} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16 },
  badgeBlock: { alignItems: 'center', gap: 6, marginTop: 30, marginBottom: 10 },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: fixed.green,
    backgroundColor: fixed.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { fontSize: 40, fontWeight: '700', color: fixed.green },
  title: { fontSize: 20, fontWeight: '700' },
  orderNo: { fontSize: 14, fontWeight: '700' },
  stack4: { gap: 4 },
  stack10: { gap: 10 },
  caption: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  value: { fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  itemName: { flex: 1, fontSize: 13 },
  itemAmount: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1 },
  totalLabel: { fontSize: 14, fontWeight: '700' },
  totalValue: { fontSize: 16, fontWeight: '700' },
});

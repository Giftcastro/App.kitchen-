/** TaxInvoicePage.xaml + TaxInvoiceViewModel. */
import React, { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { Text } from '../components/AppText';
import { Btn, Card, Page } from '../components/ui';
import { useApp } from '../state/AppState';
import { getNavParam } from '../state/navParams';
import { getCompany, mapLocation } from '../services/directory';
import { fmtLongDate } from '../services/scheduling';
import { supabase } from '../lib/supabase/client';

export default function TaxInvoiceScreen() {
  const { colors } = useApp();
  const [order] = useState(() => getNavParam('Order'));
  const [customerCompanyName, setCustomerCompanyName] = useState('');
  const [customerLocationName, setCustomerLocationName] = useState('');

  useEffect(() => {
    if (!order) return;
    getCompany(order.companyId)
      .then(c => setCustomerCompanyName(c?.name ?? 'Individual Customer'))
      .catch(() => setCustomerCompanyName('Individual Customer'));
    (async () => {
      const [{ data: site }, { data: own }] = await Promise.all([
        supabase.from('company_addresses').select('*').eq('id', order.locationId).maybeSingle(),
        supabase.from('addresses').select('*').eq('id', order.locationId).maybeSingle(),
      ]);
      const row = site ?? own;
      const location = row ? mapLocation(row) : null;
      setCustomerLocationName(location?.address || location?.name || '—');
    })().catch(() => setCustomerLocationName('—'));
  }, [order]);

  if (!order) return null;

  // Order keeps only the final total, so the meal subtotal is backed out of
  // its known parts rather than stored separately.
  const mealSubtotal = order.totalAmount - order.deliveryFee + order.subsidyAmount + order.discountAmount;

  const share = async () => {
    const lines = [
      'YOUR KITCHEN CO. (PTY) LTD',
      'SARS Compliant Tax Invoice',
      `Invoice: ${order.taxInvoiceNumber}`,
      'VAT Reg No: 4910298412',
      'Corporate Culinary Hub, Sandton, 2196',
      '',
      `Customer: ${customerCompanyName}`,
      `Delivery: ${customerLocationName}`,
      `Delivery Date: ${fmtLongDate(order.deliveryDate)}`,
      '',
      'LINE ITEMS',
      ...order.lines.map(l => `  ${l.quantity > 1 ? `${l.quantity}x ` : ''}${l.name} — R${(l.unitPrice * l.quantity).toFixed(2)}`),
      ...order.lines.filter(l => l.allergyNotes).map(l => `  ⚠️ Allergy (${l.name}): ${l.allergyNotes}`),
      '',
      `Meal Subtotal:          R ${mealSubtotal.toFixed(2)}`,
      ...(order.subsidyAmount > 0 ? [`Company Subsidy:       -R ${order.subsidyAmount.toFixed(2)}`] : []),
      ...(order.discountAmount > 0 ? [`Corporate Discount:    -R ${order.discountAmount.toFixed(2)}`] : []),
      `Delivery Fee:           R ${order.deliveryFee.toFixed(2)}`,
      '--------------------------------',
      `Total Paid (ZAR):       R ${order.totalAmount.toFixed(2)}`,
      '',
      'VAT: Not applicable (zero-rated corporate catering).',
    ];
    await Share.share({ message: lines.join('\n'), title: `Tax Invoice ${order.taxInvoiceNumber}` });
  };

  const amountRow = (label: string, value: string, bold = false) => (
    <View style={styles.row}>
      <Text style={[styles.small, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.small, { color: colors.text, fontWeight: bold ? '700' : '400' }]}>{value}</Text>
    </View>
  );

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.stack2}>
          <Text style={[styles.title, { color: colors.text }]}>SARS Tax Invoice</Text>
          <Text style={[styles.invoiceNo, { color: colors.primary }]}>{order.taxInvoiceNumber}</Text>
        </View>

        <Card radius={14} border={colors.surfaceBorder}>
          <View style={styles.stack12}>
            <View style={styles.stack2}>
              <Text style={[styles.caption, { color: colors.primary }]}>SUPPLIER DETAILS</Text>
              <Text style={[styles.strong, { color: colors.text }]}>Your Kitchen Co. (Pty) Ltd</Text>
              <Text style={[styles.small, { color: colors.textSecondary }]}>VAT Reg No: 4910298412</Text>
              <Text style={[styles.small, { color: colors.textSecondary }]}>Corporate Culinary Hub, Sandton, 2196</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />
            <View style={styles.stack2}>
              <Text style={[styles.caption, { color: colors.primary }]}>CUSTOMER &amp; DROP-OFF</Text>
              <Text style={[styles.strong, { color: colors.text }]}>{customerCompanyName}</Text>
              <Text style={[styles.small, { color: colors.textSecondary }]}>{customerLocationName}</Text>
              {!!order.deliveryFloor && <Text style={[styles.small, { color: colors.textSecondary }]}>{order.deliveryFloor}</Text>}
              <Text style={[styles.small, { color: colors.textSecondary }]}>Scheduled Delivery: {fmtLongDate(order.deliveryDate)}</Text>
            </View>
          </View>
        </Card>

        <Card radius={14} border={colors.surfaceBorder}>
          <View style={styles.stack10}>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>LINE ITEMS</Text>
            {order.lines.map((line, index) => (
              <View key={`${line.name}-${index}`} style={styles.stack2}>
                <View style={styles.row}>
                  <Text style={[styles.line, { color: colors.text }]}>{line.quantity > 1 ? `${line.quantity}x ${line.name}` : line.name}</Text>
                  <Text style={[styles.line, { color: colors.text }]}>R {(line.unitPrice * line.quantity).toFixed(2)}</Text>
                </View>
                {!!line.allergyNotes && <Text style={styles.allergy}>⚠️ Allergy alert: {line.allergyNotes}</Text>}
              </View>
            ))}
            <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />
            {amountRow('Meal Subtotal', `R ${mealSubtotal.toFixed(2)}`)}
            {order.subsidyAmount > 0 && amountRow('Company Subsidy', `-R ${order.subsidyAmount.toFixed(2)}`, true)}
            {order.discountAmount > 0 && amountRow('Corporate Discount', `-R ${order.discountAmount.toFixed(2)}`, true)}
            {amountRow('Delivery Fee', `R ${order.deliveryFee.toFixed(2)}`)}
            <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />
            <View style={styles.row}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>Total Paid (ZAR)</Text>
              <Text style={[styles.totalValue, { color: colors.primary }]}>R {order.totalAmount.toFixed(2)}</Text>
            </View>
            <Text style={[styles.vat, { color: colors.textSecondary }]}>VAT: Not applicable — zero-rated corporate catering.</Text>
          </View>
        </Card>

        <Btn title="Share / Save Invoice" onPress={share} bold radius={10} height={48} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16 },
  stack2: { gap: 2 },
  stack10: { gap: 10 },
  stack12: { gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  invoiceNo: { fontSize: 14, fontWeight: '700' },
  caption: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  strong: { fontSize: 14, fontWeight: '700' },
  small: { fontSize: 12 },
  line: { fontSize: 13, flexShrink: 1 },
  allergy: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  divider: { height: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  totalLabel: { fontSize: 15, fontWeight: '700' },
  totalValue: { fontSize: 17, fontWeight: '700' },
  vat: { fontSize: 10 },
});

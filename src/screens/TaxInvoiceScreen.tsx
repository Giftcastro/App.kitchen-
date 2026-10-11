/**
 * TaxInvoicePage.xaml + TaxInvoiceViewModel. Download PDF and Share as Text
 * both come from the shared InvoiceDocument (services/export), the same
 * document the admin's daily invoice batch prints.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/AppText';
import { alerts } from '../components/Alerts';
import { Btn, Card, Page } from '../components/ui';
import { useApp } from '../state/AppState';
import { getNavParam } from '../state/navParams';
import { fmtLongDate } from '../services/scheduling';
import { InvoiceDocument, invoiceText, loadInvoiceDocument, mealSubtotal as subtotalOf, PdfWriter, sharePdf, shareText, writeInvoice } from '../services/export';

export default function TaxInvoiceScreen() {
  const { colors } = useApp();
  const [order] = useState(() => getNavParam('Order'));
  const [doc, setDoc] = useState<InvoiceDocument | null>(null);

  useEffect(() => {
    if (order) loadInvoiceDocument(order).then(setDoc).catch(() => setDoc(null));
  }, [order]);

  if (!order) return null;

  const mealSubtotal = subtotalOf(order);
  const getDoc = async () => doc ?? (await loadInvoiceDocument(order));

  const share = async () => {
    try {
      await shareText(invoiceText(await getDoc()), `Invoice ${order.taxInvoiceNumber}`);
    } catch (err) {
      await alerts.show('Share Failed', (err as Error)?.message ?? 'The invoice could not be shared.', 'OK');
    }
  };

  const downloadPdf = async () => {
    try {
      const pdf = new PdfWriter();
      writeInvoice(pdf, await getDoc());
      await sharePdf(`Invoice_${order.taxInvoiceNumber}`, pdf, `Invoice ${order.taxInvoiceNumber}`);
    } catch (err) {
      await alerts.show('Download Failed', (err as Error)?.message ?? 'The invoice PDF could not be created.', 'OK');
    }
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
          <Text style={[styles.title, { color: colors.text }]}>Invoice</Text>
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
              <Text style={[styles.strong, { color: colors.text }]}>{order.customerName}</Text>
              <Text style={[styles.small, { color: colors.textSecondary }]}>Order #{order.orderNumber}</Text>
              <Text style={[styles.strong, { color: colors.text }]}>{doc?.companyName ?? ''}</Text>
              <Text style={[styles.small, { color: colors.textSecondary }]}>{doc ? doc.locationAddress : ''}</Text>
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

        <View style={styles.buttons}>
          <Btn title="Download PDF" onPress={downloadPdf} bold radius={10} height={48} style={styles.flex} />
          <Btn title="Share as Text" onPress={share} bold radius={10} height={48} style={styles.flex} />
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  buttons: { flexDirection: 'row', gap: 10 },
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

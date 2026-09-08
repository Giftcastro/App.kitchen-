/**
 * Tax invoice bottom sheet.
 *
 * Ported from JoTsav/kicthenCoV1 `main` (src/components/TaxInvoiceModal.tsx) —
 * same sheet anatomy, supplier/customer blocks, line-item table, calculation
 * rows, payment stamp and download button, at his sizes.
 *
 * Adaptations:
 * - Theme from `useKitchen()`, text via our AppText wrapper.
 * - Order fields come from `presentOrder()` (see orderPresentation.ts).
 * - Supplier/customer details are read from the order rather than hardcoded to
 *   his demo tenant ("Intellect Design Arena, 11 Alice Lane"), which would
 *   print the wrong company on every one of our clients' invoices.
 * - The download button actually produces a document. His shows an Alert
 *   saying the PDF "will be exported"; here it renders the invoice through
 *   expo-print — shared as a real PDF on native, and handed to the browser's
 *   own print/save-as-PDF dialog on web, since expo-print's web shim has no
 *   printToFileAsync (same constraint (tabs)/admin.tsx works around).
 *
 * The invoice number is derived, not issued by a finance system — see
 * orderPresentation.ts. Nothing here is a SARS-registered document.
 */
import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Text } from './AppText';
import { useKitchen, Order } from '../context/KitchenCoContext';
import { presentOrder } from '../utils/orderPresentation';

interface TaxInvoiceModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
}

export const TaxInvoiceModal: React.FC<TaxInvoiceModalProps> = ({ visible, order, onClose }) => {
  const { theme, user } = useKitchen();
  const [busy, setBusy] = useState(false);

  if (!visible || !order) return null;

  const view = presentOrder(order);
  const styles = createStyles(theme);
  const money = (n: number) => `R ${n.toFixed(2)}`;

  const buildHtml = () => `
    <html><head><meta charset="utf-8" /><style>
      body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding: 28px; color: #111; }
      h1 { font-size: 20px; margin: 0 0 2px; }
      .ref { font-size: 13px; color: #555; margin-bottom: 18px; }
      .block { margin-bottom: 16px; }
      .heading { font-size: 11px; letter-spacing: 0.5px; font-weight: 700; color: #666; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
      td { padding: 5px 0; border-bottom: 1px solid #eee; }
      td.amt { text-align: right; white-space: nowrap; }
      .totals td { border: none; padding: 3px 0; }
      .total { font-size: 15px; font-weight: 800; border-top: 2px solid #111; }
    </style></head><body>
      <h1>Tax Invoice</h1>
      <div class="ref">${view.taxInvoiceNumber}</div>
      <div class="block"><div class="heading">SUPPLIER DETAILS</div>
        <strong>Kitchen Co. (Pty) Ltd</strong><br/>Corporate Culinary Hub, Sandton, 2196<br/>tax@yourkitchenco.co.za</div>
      <div class="block"><div class="heading">CUSTOMER &amp; DROP-OFF</div>
        <strong>${user?.name || 'Customer'}</strong><br/>${view.companyLocation}<br/>${view.deliveryFloor}<br/>
        Scheduled Delivery: ${view.deliveryDateFormatted} &bull; ${view.deliverySlot}</div>
      <div class="block"><div class="heading">LINE ITEMS</div><table>
        ${order.items.map((i) => `<tr><td>${i.quantity}x ${i.name}${i.selectedSize ? ` (${i.selectedSize})` : ''}</td><td class="amt">${money(i.price * i.quantity)}</td></tr>`).join('')}
      </table>
      <table class="totals">
        <tr><td>Meal Subtotal</td><td class="amt">${money(view.itemSubtotal)}</td></tr>
        ${view.discountAmount > 0 ? `<tr><td>Discount</td><td class="amt">-${money(view.discountAmount)}</td></tr>` : ''}
        ${view.subsidyAmount > 0 ? `<tr><td>Company Subsidy</td><td class="amt">-${money(view.subsidyAmount)}</td></tr>` : ''}
        <tr><td>Delivery Fee</td><td class="amt">${view.deliveryFee === 0 ? 'R 0.00 (Standard Batch Drop)' : money(view.deliveryFee)}</td></tr>
        <tr class="total"><td>Total Paid (ZAR)</td><td class="amt">${money(view.totalPaid)}</td></tr>
      </table></div>
      ${view.paymentReference ? `<div class="ref">Paid via PayFast &bull; Ref: ${view.paymentReference}</div>` : ''}
    </body></html>`;

  const handleDownloadPDF = async () => {
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        // Web shim has no printToFileAsync; printAsync opens the browser's own
        // dialog, where "Save as PDF" is the destination.
        await Print.printAsync({ html: buildHtml() });
      } else {
        const { uri } = await Print.printToFileAsync({ html: buildHtml() });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
        else Alert.alert('Invoice ready', `Saved to ${uri}`);
      }
    } catch {
      Alert.alert('Could not generate the invoice', 'Please try again from this order.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.handleBar} />

          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Tax Invoice</Text>
              <Text style={styles.subtitle}>{view.taxInvoiceNumber}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close tax invoice"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <View style={styles.invoiceCard}>
              <View style={styles.detailBlock}>
                <Text style={styles.sectionHeading}>SUPPLIER DETAILS</Text>
                <Text style={styles.boldText}>Kitchen Co. (Pty) Ltd</Text>
                <Text style={styles.metaText}>Corporate Culinary Hub, Sandton, 2196</Text>
                <Text style={styles.metaText}>tax@yourkitchenco.co.za</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailBlock}>
                <Text style={styles.sectionHeading}>CUSTOMER &amp; DROP-OFF</Text>
                <Text style={styles.boldText}>{user?.name || 'Customer'}</Text>
                <Text style={styles.metaText}>{view.companyLocation}</Text>
                <Text style={styles.metaText}>{view.deliveryFloor}</Text>
                <Text style={styles.metaText}>
                  Scheduled Delivery: {view.deliveryDateFormatted} • {view.deliverySlot}
                </Text>
              </View>
            </View>

            <View style={styles.invoiceCard}>
              <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>LINE ITEMS</Text>
              {order.items.map((item, idx) => (
                <View key={item.id || idx} style={styles.tableRow}>
                  <View style={styles.itemCol}>
                    <Text style={styles.itemTitle}>
                      {item.quantity}x {item.name}{item.selectedSize ? ` (${item.selectedSize})` : ''}
                      {item.addOns && item.addOns.length > 0 ? ` (+${item.addOns.map((a) => a.name).join(', ')})` : ''}
                    </Text>
                    {item.notes ? <Text style={styles.itemNotes}>Special Note: {item.notes}</Text> : null}
                  </View>
                  <Text style={styles.itemAmount}>{money(item.price * item.quantity)}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Meal Subtotal</Text>
                <Text style={styles.calcValue}>{money(view.itemSubtotal)}</Text>
              </View>

              {view.discountAmount > 0 ? (
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: theme.text }]}>Discount</Text>
                  <Text style={[styles.calcValue, { fontWeight: '700' }]}>-{money(view.discountAmount)}</Text>
                </View>
              ) : null}

              {view.subsidyAmount > 0 ? (
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: theme.text }]}>Company Subsidy</Text>
                  <Text style={[styles.calcValue, { fontWeight: '700' }]}>-{money(view.subsidyAmount)}</Text>
                </View>
              ) : null}

              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Corporate Delivery Fee</Text>
                <Text style={styles.calcValue}>
                  {view.deliveryFee === 0 ? 'R 0.00 (Standard Batch Drop)' : money(view.deliveryFee)}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Paid (ZAR)</Text>
                <Text style={styles.totalAmount}>{money(view.totalPaid)}</Text>
              </View>
            </View>

            {/* Only stamped when we actually hold a reference for this order. */}
            {view.paymentReference ? (
              <View style={styles.stampCard}>
                <Ionicons name="shield-checkmark" size={16} color={theme.success} />
                <Text style={styles.stampText}>Paid via PayFast • Ref: {view.paymentReference}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleDownloadPDF}
              disabled={busy}
              style={[styles.downloadBtn, busy && styles.downloadBtnBusy]}
              accessibilityRole="button"
              accessibilityLabel="Download tax invoice PDF"
            >
              <Ionicons name="download-outline" size={18} color={theme.onAccent} />
              <Text style={styles.downloadBtnText}>
                {busy ? 'Preparing…' : 'Download Tax Invoice PDF'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useKitchen>['theme']) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.modalOverlay, justifyContent: 'flex-end' },
  container: {
    backgroundColor: theme.surface, borderColor: theme.border,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%', borderTopWidth: 1,
  },
  handleBar: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14, backgroundColor: theme.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', color: theme.text },
  subtitle: { fontSize: 13, fontWeight: '700', marginTop: 2, color: theme.textSecondary },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceSecondary },
  scroll: { paddingBottom: 16 },
  invoiceCard: {
    borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 12, gap: 8,
    backgroundColor: theme.surfaceSecondary, borderColor: theme.border,
  },
  detailBlock: { gap: 3 },
  sectionHeading: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2, color: theme.text },
  boldText: { fontSize: 14, fontWeight: '700', color: theme.text },
  metaText: { fontSize: 12, fontWeight: '500', color: theme.textSecondary },
  divider: { height: 1, marginVertical: 4, backgroundColor: theme.border },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 2 },
  itemCol: { flex: 1, paddingRight: 8 },
  itemTitle: { fontSize: 13, fontWeight: '600', color: theme.text },
  itemNotes: { fontSize: 11, fontWeight: '500', marginTop: 2, color: theme.warning },
  itemAmount: { fontSize: 13, fontWeight: '700', color: theme.text },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calcLabel: { fontSize: 12, fontWeight: '500', color: theme.textSecondary },
  calcValue: { fontSize: 12, fontWeight: '600', color: theme.text },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: theme.text },
  totalAmount: { fontSize: 18, fontWeight: '800', color: theme.text },
  stampCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, marginBottom: 14,
    backgroundColor: theme.surfaceSecondary,
  },
  stampText: { fontSize: 11, fontWeight: '600', flex: 1, color: theme.textSecondary },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 48, borderRadius: 14, backgroundColor: theme.accent,
  },
  downloadBtnBusy: { opacity: 0.6 },
  downloadBtnText: { fontSize: 14, fontWeight: '800', color: theme.onAccent },
});

export default TaxInvoiceModal;

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { OrderHistoryItem } from '../types';
import { PdfWriter, sharePdf } from '../services/export';
import { renderInvoicePageToPdf, AdminActiveOrderRow } from '../services/kitchenExports';

interface TaxInvoiceModalProps {
  visible: boolean;
  order: OrderHistoryItem | null;
  onClose: () => void;
}

export const TaxInvoiceModal: React.FC<TaxInvoiceModalProps> = ({
  visible,
  order,
  onClose,
}) => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const { corporateAccounts } = useCart();

  if (!visible || !order) return null;

  // Resolve customer, company and location dynamically
  const customerName = order.customerName || currentUser?.fullName || 'Corporate Customer';
  const customerEmail = order.customerEmail || currentUser?.email || '';

  const matchedCompany = corporateAccounts.find(
    (c) =>
      c.companyName === order.companyName ||
      (order.companyLocation && order.companyLocation.includes(c.companyName))
  );

  const companyName =
    order.companyName ||
    matchedCompany?.companyName ||
    currentUser?.companyName ||
    'Corporate Partner';

  const locationAddress =
    order.companyLocation ||
    matchedCompany?.locations?.[0] ||
    currentUser?.buildingName ||
    currentUser?.locationName ||
    'Corporate Campus';

  const dropoffFloor = order.deliveryFloor || currentUser?.deliveryFloor || 'Reception';
  const deliveryTimeStr = `${order.deliveryDateFormatted || order.targetDeliveryDate} • ${order.deliverySlot || '12:00 PM Sharp'}`;

  const handleDownloadPDF = async () => {
    try {
      const pdf = new PdfWriter();
      const row: AdminActiveOrderRow = {
        order,
        companyName,
        locationName: locationAddress,
        customerName: customerEmail ? `${customerName} (${customerEmail})` : customerName,
        deliveryDateLabel: order.deliveryDateFormatted || order.targetDeliveryDate,
      };
      renderInvoicePageToPdf(pdf, row, 1);

      await sharePdf(
        `YKC_Invoice_${order.taxInvoiceNumber || order.orderNumber}`,
        pdf,
        `Tax Invoice ${order.taxInvoiceNumber || order.orderNumber}`
      );
    } catch (e: any) {
      console.warn('PDF export failed:', e);
      Alert.alert('Download Error', 'Could not generate PDF export. Please try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
          {/* Handle */}
          <View style={[styles.handleBar, { backgroundColor: theme.surfaceBorderLight }]} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Tax Invoice</Text>
              <Text style={[styles.subtitle, { color: theme.primary }]}>{order.taxInvoiceNumber}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.surface }]}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Vendor & Client Details Card */}
            <View style={[styles.invoiceCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <View style={styles.detailBlock}>
                <Text style={[styles.sectionHeading, { color: theme.primary }]}>SUPPLIER DETAILS</Text>
                <Text style={[styles.boldText, { color: theme.textPrimary }]}>Your KitchenCO (Pty) Ltd</Text>
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>Billing: invoicesykc@csggroup.co.za · Support: supportykc@csggroup.co.za</Text>
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>Web: www.yourkitchenco.co.za</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

              <View style={styles.detailBlock}>
                <Text style={[styles.sectionHeading, { color: theme.primary }]}>BILLED &amp; DELIVERED TO</Text>
                <Text style={[styles.boldText, { color: theme.textPrimary }]}>
                  {customerName} {customerEmail ? `(${customerEmail})` : ''}
                </Text>
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                  {companyName} • {locationAddress}
                </Text>
                {dropoffFloor ? (
                  <Text style={[styles.metaText, { color: theme.textSecondary }]}>{dropoffFloor}</Text>
                ) : null}
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                  Scheduled Delivery: {deliveryTimeStr}
                </Text>
              </View>
            </View>

            {/* Line Items Table */}
            <View style={[styles.invoiceCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>LINE ITEMS</Text>
              {order.items.map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <View style={styles.itemCol}>
                    <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                      {item.quantity}x {item.menuItem.name}{item.size === 'large' ? ' (Large)' : ''}{item.selectedAddOns && item.selectedAddOns.length > 0 ? ` (+${item.selectedAddOns.map((a) => a.name).join(', ')})` : ''}
                    </Text>
                    {item.allergyNotes ? (
                      <Text style={[styles.itemNotes, { color: theme.error }]}>
                        Special Request: {item.allergyNotes}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.itemAmount, { color: theme.textPrimary }]}>
                    R {item.totalPrice.toFixed(2)}
                  </Text>
                </View>
              ))}

              <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

              {/* Financial Calculation (Strictly Zero VAT) */}
              <View style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: theme.textSecondary }]}>Meal Subtotal</Text>
                <Text style={[styles.calcValue, { color: theme.textPrimary }]}>
                  R {order.itemSubtotal.toFixed(2)}
                </Text>
              </View>

              {order.discountZar && order.discountZar > 0 ? (
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: theme.textPrimary }]}>
                    Corporate Discount {order.discountType === 'fixed_zar' ? `(Fixed R${order.discountValue})` : (order.discountPercentage ? `(${order.discountPercentage}%)` : '')}
                  </Text>
                  <Text style={[styles.calcValue, { color: theme.textPrimary, fontWeight: '700' }]}>
                    -R {order.discountZar.toFixed(2)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: theme.textSecondary }]}>Corporate Delivery Fee</Text>
                <Text style={[styles.calcValue, { color: theme.textPrimary }]}>
                  {order.deliveryFee === 0 ? 'R 0.00 (Standard Batch Drop)' : `R ${order.deliveryFee.toFixed(2)}`}
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: theme.textPrimary }]}>Total Paid (ZAR)</Text>
                <Text style={[styles.totalAmount, { color: theme.textPrimary }]}>
                  R {order.totalPaid.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Payment Audit Stamp */}
            <View style={[styles.stampCard, { backgroundColor: theme.surfaceHighlight }]}>
              <Ionicons name="shield-checkmark" size={16} color={theme.success} />
              <Text style={[styles.stampText, { color: theme.textSecondary }]}>
                Paid via {order.paymentMethod || 'PayGate (Card)'} • Ref: {order.paymentReference} • Amount Due: R 0.00
              </Text>
            </View>

            {/* Actions */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleDownloadPDF}
              style={[styles.downloadBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="download-outline" size={18} color={theme.textInverse} />
              <Text style={[styles.downloadBtnText, { color: theme.textInverse }]}>Download Official YKC Invoice PDF</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
    borderTopWidth: 1,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: 16,
  },
  invoiceCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  detailBlock: {
    gap: 3,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  boldText: {
    fontSize: 14,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  itemCol: {
    flex: 1,
    paddingRight: 8,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemNotes: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  itemAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  calcValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  stampCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  stampText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  downloadBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

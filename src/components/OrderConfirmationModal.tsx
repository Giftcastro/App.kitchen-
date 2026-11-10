import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { OrderHistoryItem } from '../types';

interface OrderConfirmationModalProps {
  visible: boolean;
  order: OrderHistoryItem | null;
  onClose: () => void;
  onViewInvoice: (order: OrderHistoryItem) => void;
  onTrackOrder?: () => void;
}

export const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  visible,
  order,
  onClose,
  onViewInvoice,
  onTrackOrder,
}) => {
  const { theme } = useTheme();

  if (!visible || !order) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Success Badge */}
            <View style={styles.badgeContainer}>
              <View style={[styles.iconCircle, { backgroundColor: theme.successSurface, borderColor: theme.success }]}>
                <Ionicons name="checkmark-circle" size={48} color={theme.success} />
              </View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                Order Scheduled & Paid!
              </Text>
              <Text style={[styles.orderNumber, { color: theme.primary }]}>
                {order.orderNumber}
              </Text>
            </View>

            {/* Delivery Time & Location Pill */}
            <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <View style={styles.infoRow}>
                <Ionicons name="time" size={18} color={theme.goldWarning} />
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>DELIVERY DATE & TIME</Text>
                  <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                    {order.deliveryDateFormatted} • {order.deliverySlot}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

              <View style={styles.infoRow}>
                <Ionicons name="location" size={18} color={theme.primary} />
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>ASSIGNED DROP-OFF POINT</Text>
                  <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                    {order.companyLocation}
                  </Text>
                  <Text style={[styles.infoSubvalue, { color: theme.textSecondary }]}>
                    {order.deliveryFloor}
                  </Text>
                </View>
              </View>
            </View>

            {/* Itemized Snapshot */}
            <View style={[styles.itemsCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <Text style={[styles.itemsHeader, { color: theme.textSecondary }]}>
                ITEMS IN THIS BATCH ({order.items.length})
              </Text>
              {order.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={[styles.itemQtyTitle, { color: theme.textPrimary }]}>
                    {item.quantity}x {item.menuItem.name}
                  </Text>
                  <Text style={[styles.itemPrice, { color: theme.primary }]}>
                    R {item.totalPrice.toFixed(2)}
                  </Text>
                </View>
              ))}

              <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Total Paid (PayFast)</Text>
                <Text style={[styles.totalValue, { color: theme.textPrimary }]}>
                  R {order.totalPaid.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Live Tracker CTA */}
            {onTrackOrder && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  onClose();
                  onTrackOrder();
                }}
                style={[styles.trackBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="cube" size={18} color={theme.textInverse} />
                <Text style={[styles.trackBtnText, { color: theme.textInverse }]}>
                  Track Delivery Status (Stage 1) →
                </Text>
              </TouchableOpacity>
            )}

            {/* SARS Tax Invoice Action */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onViewInvoice(order)}
              style={[styles.invoiceBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            >
              <Ionicons name="receipt-outline" size={18} color={theme.primary} />
              <Text style={[styles.invoiceBtnText, { color: theme.textPrimary }]}>
                View SARS Tax Invoice ({order.taxInvoiceNumber})
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Back to Menu CTA */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onClose}
              style={[styles.doneBtn, { backgroundColor: theme.surfaceHighlight }]}
            >
              <Text style={[styles.doneBtnText, { color: theme.textPrimary }]}>Done & Back to Menu</Text>
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  scroll: {
    paddingBottom: 8,
  },
  badgeContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  infoCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginVertical: 10,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoSubvalue: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  divider: {
    height: 1,
  },
  itemsCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  itemsHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemQtyTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  trackBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
  },
  invoiceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  doneBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

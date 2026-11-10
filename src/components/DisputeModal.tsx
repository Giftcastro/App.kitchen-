import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { OrderHistoryItem } from '../types';

interface DisputeModalProps {
  visible: boolean;
  order: OrderHistoryItem | null;
  userEmail: string;
  userName: string;
  onClose: () => void;
  onConfirmDispute: (orderId: string, reason: string) => void;
}

export const DisputeModal: React.FC<DisputeModalProps> = ({
  visible,
  order,
  userEmail,
  userName,
  onClose,
  onConfirmDispute,
}) => {
  const { theme } = useTheme();
  const [reason, setReason] = useState<string>('Package missing from floor pantry cooler after 12:15 PM');

  if (!visible || !order) return null;

  const handleEscalate = () => {
    const ticketId = `TCK-${Math.floor(10000 + Math.random() * 90000)}`;
    const emailSubject = encodeURIComponent(`[URGENT] Non-Delivery Escalation: ${order.orderNumber} (${ticketId})`);
    const emailBody = encodeURIComponent(
      `URGENT NON-DELIVERY ESCALATION REPORT\n\n` +
      `Ticket Reference: ${ticketId}\n` +
      `Order Reference: ${order.orderNumber}\n` +
      `Employee Name: ${userName}\n` +
      `Corporate Email: ${userEmail}\n` +
      `Company Location: ${order.companyLocation}\n` +
      `Drop-off Floor: ${order.deliveryFloor}\n` +
      `Scheduled Delivery Date: ${order.deliveryDateFormatted} • 12:00 PM\n` +
      `PayFast Reference: ${order.paymentReference}\n` +
      `Total Paid: R ${order.totalPaid.toFixed(2)}\n\n` +
      `Issue Description:\n${reason}\n\n` +
      `Please investigate with the batch delivery driver immediately.`
    );

    onConfirmDispute(order.id, reason);
    onClose();

    // Trigger email client
    Linking.openURL(`mailto:supportykc@csggroup.co.za?subject=${emailSubject}&body=${emailBody}`).catch(() => {
      Alert.alert(
        'Ticket Created',
        `Dispute ticket ${ticketId} has been logged. Our dispatch desk will investigate with the pantry logistics driver.`
      );
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
          <View style={[styles.handleBar, { backgroundColor: theme.surfaceBorderLight }]} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="warning" size={20} color={theme.error} />
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                Report Meal Issue / Non-Delivery
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.surface }]}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Prompt Box */}
          <View style={[styles.promptCard, { backgroundColor: theme.errorSurface, borderColor: theme.errorBorder }]}>
            <Text style={[styles.promptTitle, { color: theme.error }]}>
              Did your meal fail to arrive at {order.deliveryFloor} at 12:00 PM?
            </Text>
            <Text style={[styles.promptBody, { color: theme.textSecondary }]}>
              Batch drops are placed in the labeled floor coolers by 12:00 PM sharp. If your meal is missing, our culinary dispatch team will immediately trace the driver batch manifest.
            </Text>
          </View>

          {/* Order Details Metadata Card */}
          <View style={[styles.metaCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Order Reference:</Text>
              <Text style={[styles.metaValue, { color: theme.textPrimary }]}>{order.orderNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Drop-off Location:</Text>
              <Text style={[styles.metaValue, { color: theme.textPrimary }]}>{order.deliveryFloor}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>PayFast Reference:</Text>
              <Text style={[styles.metaValue, { color: theme.textPrimary }]}>{order.paymentReference}</Text>
            </View>
          </View>

          {/* Reason Input */}
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Additional Details for Kitchen Support Desk:
          </Text>
          <TextInput
            style={[
              styles.reasonInput,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.inputBorder,
                color: theme.textPrimary,
              },
            ]}
            placeholder="Describe what happened (e.g. checked at 12:15 PM, cooler was empty)..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
            value={reason}
            onChangeText={setReason}
            textAlignVertical="top"
          />

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.cancelBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            >
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleEscalate}
              style={[styles.escalateBtn, { backgroundColor: theme.error }]}
            >
              <Ionicons name="mail" size={16} color="#FFFFFF" />
              <Text style={styles.escalateBtnText}>Confirm & Dispatch Ticket</Text>
            </TouchableOpacity>
          </View>
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 4,
  },
  promptTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  promptBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  metaCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    minHeight: 68,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  escalateBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  escalateBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

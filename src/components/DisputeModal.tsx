/**
 * "Report Meal Issue / Non-Delivery" sheet.
 *
 * Ported from JoTsav/kicthenCoV1 `main` (src/components/DisputeModal.tsx) —
 * same bottom-sheet anatomy, prompt card, metadata rows, reason input and
 * two-button action row, and the same mailto escalation with a generated
 * ticket reference.
 *
 * Adaptations: the theme comes from `useKitchen()`, text uses our AppText
 * wrapper, order fields come from `presentOrder()` (see orderPresentation.ts)
 * since our `Order` does not carry his display fields, and the ticket
 * reference is minted by the context's `reportOrderNonDelivery` rather than
 * here — the modal shows the reference the store actually recorded instead of
 * generating a second, different one for the email.
 */
import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, Linking, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from './AppText';
import { useKitchen, Order } from '../context/KitchenCoContext';
import { presentOrder } from '../utils/orderPresentation';

interface DisputeModalProps {
  visible: boolean;
  order: Order | null;
  userEmail: string;
  userName: string;
  onClose: () => void;
  /** Records the dispute and returns the support ticket reference it logged. */
  onConfirmDispute: (orderId: string, reason: string) => string;
}

export const DisputeModal: React.FC<DisputeModalProps> = ({
  visible,
  order,
  userEmail,
  userName,
  onClose,
  onConfirmDispute,
}) => {
  const { theme } = useKitchen();
  const [reason, setReason] = useState<string>('');

  if (!visible || !order) return null;

  const view = presentOrder(order);
  const styles = createStyles(theme);

  const handleEscalate = () => {
    const detail = reason.trim() || 'Meal not present in designated floor pantry cooler at 12:00 PM';
    // Log first, then quote the reference the store actually recorded — minting
    // a second one here would put a different ticket number in the email than
    // the one shown on the order card.
    const ticketId = onConfirmDispute(order.id, detail);

    const subject = encodeURIComponent(`[URGENT] Non-Delivery Escalation: ${view.orderNumber} (${ticketId})`);
    const body = encodeURIComponent(
      `URGENT NON-DELIVERY ESCALATION REPORT\n\n` +
      `Ticket Reference: ${ticketId}\n` +
      `Order Reference: ${view.orderNumber}\n` +
      `Employee Name: ${userName}\n` +
      `Corporate Email: ${userEmail}\n` +
      `Delivery Location: ${view.companyLocation}\n` +
      `Drop-off Point: ${view.deliveryFloor}\n` +
      `Scheduled Delivery: ${view.deliveryDateFormatted} • ${view.deliverySlot}\n` +
      (view.paymentReference ? `PayFast Reference: ${view.paymentReference}\n` : '') +
      `Total Paid: R ${view.totalPaid.toFixed(2)}\n\n` +
      `Issue Description:\n${detail}\n\n` +
      `Please investigate with the batch delivery driver immediately.`
    );

    onClose();

    Linking.openURL(`mailto:support@yourkitchenco.co.za?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert(
        'Ticket Created',
        `Dispute ticket ${ticketId} has been logged. Our dispatch desk will investigate with the pantry logistics driver.`
      );
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.handleBar} />

          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="warning" size={20} color={theme.error} />
              <Text style={styles.title}>Report Meal Issue / Non-Delivery</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close report issue"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>
              Did your meal fail to arrive at the {view.deliveryFloor} at {view.deliverySlot}?
            </Text>
            <Text style={styles.promptBody}>
              Batch drops are placed in the labeled floor coolers by {view.deliverySlot} sharp. If your
              meal is missing, our culinary dispatch team will immediately trace the driver batch manifest.
            </Text>
          </View>

          <View style={styles.metaCard}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Order Reference:</Text>
              <Text style={styles.metaValue}>{view.orderNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Drop-off Location:</Text>
              <Text style={styles.metaValue} numberOfLines={1}>{view.deliveryFloor}</Text>
            </View>
            {/* Omitted rather than faked when the order predates the field. */}
            {view.paymentReference ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>PayFast Reference:</Text>
                <Text style={styles.metaValue} numberOfLines={1}>{view.paymentReference}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.fieldLabel}>Additional Details for Kitchen Support Desk:</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Describe what happened (e.g. checked at 12:15 PM, cooler was empty)..."
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={3}
            value={reason}
            onChangeText={setReason}
            textAlignVertical="top"
            accessibilityLabel="Issue details"
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.cancelBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel report"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleEscalate}
              style={styles.escalateBtn}
              accessibilityRole="button"
              accessibilityLabel="Confirm and dispatch ticket"
            >
              <Ionicons name="mail" size={16} color={theme.white} />
              <Text style={styles.escalateBtnText}>Confirm &amp; Dispatch Ticket</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useKitchen>['theme']) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.modalOverlay, justifyContent: 'flex-end' },
  container: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
    borderTopWidth: 1,
  },
  handleBar: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14, backgroundColor: theme.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title: { fontSize: 16, fontWeight: '800', color: theme.text, flex: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceSecondary },
  promptCard: {
    borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 12, gap: 4,
    backgroundColor: theme.surfaceSecondary, borderColor: theme.error,
  },
  promptTitle: { fontSize: 13, fontWeight: '700', lineHeight: 18, color: theme.error },
  promptBody: { fontSize: 12, lineHeight: 16, color: theme.textSecondary },
  metaCard: {
    borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 12, gap: 6,
    backgroundColor: theme.surfaceSecondary, borderColor: theme.border,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  metaLabel: { fontSize: 12, fontWeight: '500', color: theme.textSecondary },
  metaValue: { fontSize: 12, fontWeight: '700', color: theme.text, flexShrink: 1, textAlign: 'right' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, color: theme.textSecondary },
  reasonInput: {
    borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, minHeight: 68, marginBottom: 16,
    backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text,
  },
  actionsRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.surface, borderColor: theme.border,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: theme.textSecondary },
  escalateBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, backgroundColor: theme.error,
  },
  escalateBtnText: { fontSize: 14, fontWeight: '800', color: theme.white },
});

export default DisputeModal;

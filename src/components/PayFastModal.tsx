import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { DeliveryDateOption } from '../types';
import {
  CheckoutCartPayload,
  createPayFastCheckout,
  fetchPaymentIntentStatus,
  PaymentIntentStatus,
} from '../services/supabaseDataService';
import { reportError } from '../services/errorReporting';

interface PayFastModalProps {
  visible: boolean;
  onClose: () => void;
  totalZarFormatted: string;
  itemCount: number;
  selectedDateOption?: DeliveryDateOption;
  userLocation?: string;
  userEmail?: string;
  checkoutPayload: CheckoutCartPayload;
  onPaymentConfirmed: () => void | Promise<void>;
}

type PaymentMethodKey = 'eft' | 'card' | 'masterpass';

const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 15 * 60 * 1000;
const GRACE_AFTER_BROWSER_CLOSE_MS = 20000;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Payment is settled by PayFast's notification to our server. The browser
// closing, however it closes, says nothing about whether money moved.
async function waitForPaymentResult(
  intentId: string,
  browserClosedAt: () => number | null
): Promise<PaymentIntentStatus> {
  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    const status = await fetchPaymentIntentStatus(intentId);
    if (status && status !== 'pending') return status;
    const closedAt = browserClosedAt();
    if (closedAt && Date.now() - closedAt > GRACE_AFTER_BROWSER_CLOSE_MS) return 'pending';
    await delay(POLL_INTERVAL_MS);
  }
  return 'pending';
}

export const PayFastModal: React.FC<PayFastModalProps> = ({
  visible,
  onClose,
  totalZarFormatted,
  itemCount,
  selectedDateOption,
  userLocation: customUserLocation,
  userEmail,
  checkoutPayload,
  onPaymentConfirmed,
}) => {
  const { theme, isDark } = useTheme();
  const { currentUser } = useAuth();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodKey>('eft');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const userLocation = customUserLocation || (currentUser
    ? `${currentUser.companyName} • ${currentUser.deliveryFloor}`
    : 'Corporate Partner • Main Drop-off Floor');

  const handlePayFastLaunch = async () => {
    setIsProcessing(true);

    try {
      const checkout = await createPayFastCheckout(checkoutPayload);
      // Refuse to open anything except PayFast, whatever the response says.
      if (!/^https:\/\/(www|sandbox)\.payfast\.co\.za\/eng\/process\?/.test(checkout.redirectUrl)) {
        throw new Error('Secure checkout could not be verified. Please try again.');
      }
      const returnUrl = 'kitchenco://payment-success';

      let closedAt: number | null = null;
      WebBrowser.openAuthSessionAsync(checkout.redirectUrl, returnUrl)
        .catch((err) => reportError('payfast_browser', err))
        .finally(() => {
          closedAt = Date.now();
        });

      const status = await waitForPaymentResult(checkout.intentId, () => closedAt);
      try {
        WebBrowser.dismissAuthSession();
      } catch {
        // Already closed.
      }

      if (status === 'paid') {
        await onPaymentConfirmed();
      } else if (status === 'pending') {
        Alert.alert(
          'Payment Not Confirmed Yet',
          'We have not received confirmation from PayFast. If you completed payment, your order will appear in Orders shortly. Your cart has been kept.'
        );
      } else {
        Alert.alert('Payment Not Completed', 'Your payment did not go through, so no order was placed.');
      }
    } catch (err: any) {
      reportError('payfast_checkout', err);
      Alert.alert('Checkout Error', err.message || 'Unable to start PayFast checkout. Please try again.');
    } finally {
      setIsProcessing(false);
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
            <View style={styles.headerTitleContainer}>
              <View style={styles.payfastBadge}>
                <Ionicons name="card" size={16} color={theme.textPrimary} />
                <Text style={[styles.payfastBadgeText, { color: theme.textPrimary }]}>PayFast Secure Checkout</Text>
              </View>
              <Text style={[styles.amountDueText, { color: theme.textPrimary }]}>
                {totalZarFormatted}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.surface }]}
              disabled={isProcessing}
            >
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Delivery Destination Verification */}
            <View style={[styles.destCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <View style={styles.destRow}>
                <Ionicons name="location" size={16} color={theme.textPrimary} />
                <Text style={[styles.destTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  {userLocation}
                </Text>
              </View>
              <Text style={[styles.destSubtitle, { color: theme.textSecondary }]}>
                Scheduled Delivery: {selectedDateOption ? `${selectedDateOption.dayName}, ${selectedDateOption.dayNumber} ${selectedDateOption.monthName}` : '12:00 PM'} • 12:00 PM Drop
              </Text>
            </View>

            {/* Payment Methods */}
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              SELECT PAYMENT METHOD
            </Text>

            {/* 1. Instant PayFast Gateway */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSelectedMethod('eft')}
              style={[
                styles.methodCard,
                { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                selectedMethod === 'eft' && { borderColor: theme.textPrimary, backgroundColor: theme.primaryMuted },
              ]}
            >
              <View style={styles.methodLeft}>
                <View style={[styles.iconCircle, { backgroundColor: theme.surfaceHighlight }]}>
                  <Ionicons name="shield-checkmark" size={18} color={theme.textPrimary} />
                </View>
                <View>
                  <Text style={[styles.methodTitle, { color: theme.textPrimary }]}>PayFast Secure Gateway</Text>
                  <Text style={[styles.methodDesc, { color: theme.textSecondary }]}>
                    Instant EFT (Capitec Pay / Ozow), Card & Masterpass
                  </Text>
                </View>
              </View>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.primary}
              />
            </TouchableOpacity>

            {/* Note: Debit / Credit Card and Masterpass QR options commented out for sandbox simplicity */}
            {/*
            <TouchableOpacity onPress={() => setSelectedMethod('card')} style={styles.methodCard}>
              <Text>Debit / Credit Card</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedMethod('masterpass')} style={styles.methodCard}>
              <Text>Masterpass / SnapScan QR</Text>
            </TouchableOpacity>
            */}

            {/* Security Guarantee Pill */}
            {/*<View style={[styles.securityBadge, { backgroundColor: theme.surfaceHighlight }]}>*/}
            {/*  <Ionicons name="lock-closed" size={14} color={theme.textPrimary} />*/}
            {/*  <Text style={[styles.securityText, { color: theme.textSecondary }]}>*/}
            {/*    256-Bit SSL Encrypted • PCI DSS Level 1 Certified*/}
            {/*  </Text>*/}
            {/*</View>*/}

            {/* Pay Button CTA */}
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={isProcessing}
              onPress={handlePayFastLaunch}
              style={[styles.payBtn, { backgroundColor:theme.primary}]}
            >
              {isProcessing ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={theme.onPrimary} />
                  <Text style={[styles.payBtnText, { color:theme.onPrimary}]}>Redirecting to PayFast...</Text>
                </View>
              ) : (
                <Text style={[styles.payBtnText, { color:theme.onPrimary}]}>
                  Pay {totalZarFormatted} with PayFast →
                </Text>
              )}
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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
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
    marginBottom: 16,
  },
  headerTitleContainer: {
    gap: 4,
  },
  payfastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payfastBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountDueText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 10,
  },
  destCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 4,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  destTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  destSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 24,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  methodDesc: {
    fontSize: 11,
    fontWeight: '500',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    marginVertical: 12,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  payBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  payBtnText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sandboxLink: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  sandboxLinkText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

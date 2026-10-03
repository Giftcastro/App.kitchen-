/**
 * PaymentPage.xaml + PaymentViewModel.
 *
 * Card is MAUI's demo checkout: validated, a simulated gateway delay, then
 * the order is placed. PayFast opens PayFast's sandbox checkout in a WebView
 * on a phone (the order is placed when PayFast redirects back as paid); the
 * web build has no WebView, so there it simulates the round trip like MAUI.
 */
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput } from '../components/AppText';
import { alerts } from '../components/Alerts';
import { Btn, Card, Page } from '../components/ui';
import { useApp } from '../state/AppState';
import { getNavParam, setNavParam } from '../state/navParams';
import { placeCartOrder } from '../services/orders';
import { buildPayFastHtml, newPaymentReference, PAYFAST } from '../services/payfast';

type Method = 'Card' | 'PayFast';

export default function PaymentScreen() {
  const { colors, cartItems, clearCart } = useApp();
  const router = useRouter();
  const [params] = useState(() => getNavParam('Payment'));
  const [selectedMethod, setSelectedMethod] = useState<Method>('Card');
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Processing your payment…');
  const [payFastReference, setPayFastReference] = useState<string | null>(null);
  const placing = useRef(false);

  const amountDue = params?.amountDue ?? 0;
  const deliveryFee = params?.deliveryFee ?? 0;

  const completeOrder = async (paymentReference: string) => {
    if (placing.current || !params) return;
    placing.current = true;
    setIsProcessing(true);
    try {
      const order = await placeCartOrder(cartItems, params.addressId, paymentReference);
      clearCart();
      setNavParam('Orders', [order]);
      router.push('/order-confirmation');
    } catch (err) {
      await alerts.show('Order Not Placed', (err as Error)?.message ?? 'Your order could not be placed.', 'OK');
    } finally {
      placing.current = false;
      setIsProcessing(false);
    }
  };

  const simulateGateway = async (message: string, reference: string) => {
    setProcessingMessage(message);
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1800));
    await completeOrder(reference);
  };

  const payWithCard = async () => {
    const digits = cardNumber.replace(/\s/g, '');
    if (digits.length < 13 || digits.length > 19 || !/^\d+$/.test(digits)) {
      await alerts.show('Invalid Card Number', 'Please enter a valid card number.', 'OK');
      return;
    }
    if (expiryDate.length !== 5 || expiryDate[2] !== '/') {
      await alerts.show('Invalid Expiry Date', 'Please enter the expiry date as MM/YY.', 'OK');
      return;
    }
    if (cvv.length < 3 || cvv.length > 4) {
      await alerts.show('Invalid CVV', 'Please enter a valid 3 or 4 digit security code.', 'OK');
      return;
    }
    if (!cardholderName.trim()) {
      await alerts.show('Missing Name', 'Please enter the name on the card.', 'OK');
      return;
    }
    await simulateGateway('Processing your card payment…', newPaymentReference('DEMO-CARD'));
  };

  const payWithPayFast = async () => {
    const reference = newPaymentReference('KC');
    if (Platform.OS === 'web') {
      await simulateGateway('Redirecting to PayFast…', reference);
      return;
    }
    setPayFastReference(reference);
  };

  const onPayFastNavigation = (nav: WebViewNavigation) => {
    if (!payFastReference) return;
    if (nav.url.startsWith(PAYFAST.RETURN_URL)) {
      const reference = payFastReference;
      setPayFastReference(null);
      setProcessingMessage('Confirming your order…');
      completeOrder(reference);
    } else if (nav.url.startsWith(PAYFAST.CANCEL_URL)) {
      setPayFastReference(null);
    }
  };

  const methodTile = (method: Method, emoji: string) => (
    <Pressable
      onPress={() => setSelectedMethod(method)}
      accessibilityRole="radio"
      aria-checked={selectedMethod === method}
      style={[styles.tile, { backgroundColor: colors.cardBg, borderColor: selectedMethod === method ? colors.primary : colors.inputBorder }]}
    >
      <Text style={styles.tileEmoji}>{emoji}</Text>
      <Text style={[styles.tileLabel, { color: colors.text }]}>{method}</Text>
    </Pressable>
  );

  const field = (value: string, onChange: (t: string) => void, placeholder: string, opts: { numeric?: boolean; max?: number; secure?: boolean } = {}) => (
    <View style={[styles.field, { borderColor: colors.inputBorder, backgroundColor: colors.cardBg }]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType={opts.numeric ? 'number-pad' : 'default'}
        maxLength={opts.max}
        secureTextEntry={opts.secure}
        style={[styles.fieldInput, { color: colors.text }]}
      />
    </View>
  );

  return (
    <Page bg={colors.cream}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card radius={16} padding={18}>
          <View style={styles.stack6}>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>Amount Due</Text>
            <Text style={[styles.amount, { color: colors.primary }]}>R{amountDue.toFixed(2)}</Text>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>Includes R{deliveryFee.toFixed(2)} delivery</Text>
          </View>
        </Card>

        <Text style={[styles.heading, { color: colors.text }]}>Choose Payment Method</Text>
        <View style={styles.tiles}>
          {methodTile('Card', '💳')}
          {methodTile('PayFast', '⚡')}
        </View>

        {selectedMethod === 'Card' ? (
          <View style={styles.stack12}>
            {field(cardholderName, setCardholderName, 'Name on Card')}
            {field(cardNumber, setCardNumber, 'Card Number', { numeric: true, max: 19 })}
            <View style={styles.tiles}>
              <View style={styles.flex}>{field(expiryDate, setExpiryDate, 'MM/YY', { max: 5 })}</View>
              <View style={styles.flex}>{field(cvv, setCvv, 'CVV', { numeric: true, max: 4, secure: true })}</View>
            </View>
            <Text style={[styles.small, { color: colors.textSecondary }]}>🔒 This is a demo checkout — no real card details are transmitted or stored.</Text>
            <Btn title={`Pay R${amountDue.toFixed(2)}`} onPress={payWithCard} bold radius={10} height={50} style={styles.payButton} />
          </View>
        ) : (
          <View style={styles.stack12}>
            <Card radius={12} padding={16} border={colors.inputBorder}>
              <View style={styles.stack8}>
                <Text style={[styles.body, { color: colors.text }]}>
                  You&apos;ll be securely redirected to PayFast to complete this payment — South Africa&apos;s trusted payment gateway, supporting EFT,
                  Instant EFT, and all major cards.
                </Text>
                <Text style={[styles.small, { color: colors.textSecondary }]}>
                  {Platform.OS === 'web'
                    ? '🔒 This is a demo checkout — no real redirect or transaction occurs.'
                    : '🔒 PayFast sandbox — test payments only, no real money is taken.'}
                </Text>
              </View>
            </Card>
            <Btn title={`Pay R${amountDue.toFixed(2)} with PayFast`} onPress={payWithPayFast} bold radius={10} height={50} />
          </View>
        )}
      </ScrollView>

      {isProcessing && (
        <View style={styles.overlay}>
          <View style={[styles.processing, { backgroundColor: colors.cardBg }]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.processingText, { color: colors.text }]}>{processingMessage}</Text>
          </View>
        </View>
      )}

      {Platform.OS !== 'web' && (
        <Modal visible={!!payFastReference} animationType="slide" onRequestClose={() => setPayFastReference(null)}>
          <SafeAreaView style={styles.flex}>
            <View style={styles.payFastBar}>
              <Pressable onPress={() => setPayFastReference(null)} hitSlop={8}>
                <Text style={styles.payFastCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.payFastTitle}>PayFast</Text>
              <Text style={styles.payFastAmount}>R{amountDue.toFixed(2)}</Text>
            </View>
            {payFastReference && (
              <WebView
                source={{ html: buildPayFastHtml(amountDue, payFastReference) }}
                onNavigationStateChange={onPayFastNavigation}
                style={styles.flex}
              />
            )}
          </SafeAreaView>
        </Modal>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 20 },
  stack6: { gap: 6 },
  stack8: { gap: 8 },
  stack12: { gap: 12 },
  caption: { fontSize: 12 },
  amount: { fontSize: 32, fontWeight: '700' },
  heading: { fontSize: 16, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderRadius: 14, borderWidth: 2, padding: 14, alignItems: 'center', gap: 4 },
  tileEmoji: { fontSize: 26 },
  tileLabel: { fontSize: 14, fontWeight: '700' },
  field: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
  fieldInput: { fontSize: 14, minHeight: 40 },
  small: { fontSize: 11 },
  body: { fontSize: 13 },
  payButton: { marginTop: 8 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.67)', alignItems: 'center', justifyContent: 'center' },
  processing: { width: 220, borderRadius: 16, padding: 30, alignItems: 'center', gap: 14 },
  processingText: { fontSize: 13, textAlign: 'center' },
  payFastBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  payFastCancel: { color: '#C62828', fontWeight: '700', fontSize: 15 },
  payFastTitle: { fontWeight: '700', fontSize: 16 },
  payFastAmount: { fontWeight: '700', fontSize: 14 },
});

import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform, SafeAreaView, StatusBar, TextInput, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { useKitchen } from '../context/KitchenCoContext';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

// Configure how notifications should behave when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function PayFastSandboxScreen() {
  const { cart, placeOrder, user, saveCard, orderNote, appliedDiscount, calculateDiscountAmount } = useKitchen();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCardForm, setShowCardForm] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [saveCardEnabled, setSaveCardEnabled] = useState(false);

  // Calculate discount amount and final total (only on eligible items)
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = calculateDiscountAmount(cart, appliedDiscount);
  const finalTotal = totalPrice - discountAmount;

  // Card form fields
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  // Helper to detect card type from number
  const getCardType = (number: string): 'visa' | 'mastercard' | 'amex' | 'other' => {
    const cleaned = number.replace(/\s/g, '');
    if (cleaned.startsWith('4')) return 'visa';
    if (cleaned.startsWith('5') || cleaned.startsWith('2')) return 'mastercard';
    if (cleaned.startsWith('3')) return 'amex';
    return 'other';
  };

  // Mask card number - keep only last 4 digits
  const maskCardNumber = (number: string): string => {
    const cleaned = number.replace(/\s/g, '');
    const lastFour = cleaned.slice(-4);
    return `•••• •••• •••• ${lastFour}`;
  };

  // PayFast Credentials
  const MERCHANT_ID = '10000100';
  const MERCHANT_KEY = '4642db1a3e141';
  const SANDBOX_PAYFAST_URL = 'https://sandbox.payfast.co.za/eng/process';

  const RETURN_URL = 'https://www.example.com/payment-success';
  const CANCEL_URL = 'https://www.example.com/payment-cancelled';

  // Request notification permissions when checkout opens
  useEffect(() => {
    async function requestPermissions() {
      if (Platform.OS !== 'web') {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      }
    }
    requestPermissions();
  }, []);

  // Format card number with spaces every 4 digits
  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  // Format expiry date as MM/YY
  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    return cleaned;
  };

  const validateCardForm = () => {
    const errors: {[key: string]: string} = {};
    const cleanedCardNum = cardNumber.replace(/\s/g, '');

    if (!cardholderName.trim()) {
      errors.cardholderName = 'Cardholder name is required';
    }
    if (cleanedCardNum.length < 16) {
      errors.cardNumber = 'Please enter a valid 16-digit card number';
    }
    if (expiryDate.length < 5) {
      errors.expiryDate = 'Please enter a valid expiry date (MM/YY)';
    } else {
      const [month, year] = expiryDate.split('/');
      const now = new Date();
      const currentYear = now.getFullYear() % 100;
      const currentMonth = now.getMonth() + 1;
      if (parseInt(month) < 1 || parseInt(month) > 12) {
        errors.expiryDate = 'Invalid month';
      } else if (parseInt(year) < currentYear || (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
        errors.expiryDate = 'Card has expired';
      }
    }
    if (cvv.length < 3) {
      errors.cvv = 'Please enter a valid CVV';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCardSubmit = () => {
    if (validateCardForm()) {
      // Save card if enabled
      if (saveCardEnabled && user) {
        saveCard({
          cardholderName: cardholderName.trim(),
          cardNumber: maskCardNumber(cardNumber),
          expiryDate: expiryDate,
          cardType: getCardType(cardNumber),
        });
      }
      setShowCardForm(false);
      setIsLoading(true);
    }
  };

  // Function to trigger the local push notification
  const triggerSuccessNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🍳 Order Confirmed!",
          body: "We have received your payment of R" + (appliedDiscount ? finalTotal.toFixed(2) : totalPrice.toFixed(2)) + ". The kitchen has started preparing your order!",
          sound: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.log("Could not fire notification: ", error);
    }
  };

  // Simulate sending an email notification
  const sendEmailNotification = async () => {
    const userEmail = user?.email || 'your email';
    const userName = user?.name || 'Valued Customer';

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Log the email for debugging
    console.log("Email sent to: " + userEmail);
    console.log("Subject: Order Confirmed - Kitchen Co.");
    console.log("Body: Hi " + userName + ", your payment of R" + (appliedDiscount ? finalTotal.toFixed(2) : totalPrice.toFixed(2)) + " was successful! Your order is being prepared.");

    setEmailSent(true);
    return true;
  };

  const payFastHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #000000;
            text-align: center;
          }
          .loader {
            border: 4px solid #1C1C1E;
            border-top: 4px solid #FFFFFF;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          h2 { color: #FFFFFF; font-size: 18px; font-weight: 600; }
        </style>
      </head>
      <body onload="document.forms['payfast_form'].submit();">
        <div>
          <div class="loader"></div>
          <h2>Connecting to secure payment...</h2>
        </div>

        <form name="payfast_form" action="${SANDBOX_PAYFAST_URL}" method="post">
          <input type="hidden" name="merchant_id" value="${MERCHANT_ID}">
          <input type="hidden" name="merchant_key" value="${MERCHANT_KEY}">
          <input type="hidden" name="return_url" value="${RETURN_URL}">
          <input type="hidden" name="cancel_url" value="${CANCEL_URL}">
          
          <input type="hidden" name="m_payment_id" value="KITCHEN-${Date.now()}">
          <input type="hidden" name="amount" value="${finalTotal.toFixed(2)}">
          <input type="hidden" name="item_name" value="Kitchen App Order">
          <input type="hidden" name="item_description" value="Food order collection from Kitchen App">
        </form>
      </body>
    </html>
  `;

  const handleNavigationStateChange = async (navState: any) => {
    const { url } = navState;

    if (url.startsWith(RETURN_URL)) {
      // 1. Send system push notification
      await triggerSuccessNotification();
      
      // 2. Send email notification to the user's email
      await sendEmailNotification();
      
      // 3. Clear state and record order details
      placeOrder();
      
      // 4. Show success screen
      setShowSuccess(true);
    } else if (url.startsWith(CANCEL_URL)) {
      router.replace('/cart');
    }
  };

  // Success screen after payment + email
  if (showSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.successContainer}>
          <View style={styles.successIconWrap}>
            <Text style={styles.successIcon}>✅</Text>
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          {appliedDiscount ? (
            <Text style={styles.successAmount}>
              <Text style={styles.successOriginalPrice}>R{totalPrice.toFixed(2)}</Text>
              {' '}R{finalTotal.toFixed(2)}
            </Text>
          ) : (
            <Text style={styles.successAmount}>R{totalPrice.toFixed(2)}</Text>
          )}
          <Text style={styles.successSubtext}>
            Your order has been placed and the kitchen is preparing your meal.
          </Text>
          
          {/* Email notification status */}
          <View style={styles.emailStatusCard}>
            <View style={styles.emailStatusRow}>
              <Text style={styles.emailIcon}>📧</Text>
              <View style={styles.emailStatusContent}>
                <Text style={styles.emailStatusTitle}>Email Confirmation Sent</Text>
                <Text style={styles.emailStatusText}>
                  A confirmation has been sent to {user?.email || 'your email'}
                </Text>
              </View>
              {emailSent ? (
                <Text style={styles.emailCheckmark}>✅</Text>
              ) : (
                <ActivityIndicator size="small" color="#22C55E" />
              )}
            </View>
          </View>

          <TouchableOpacity 
            style={styles.continueShoppingBtn}
            onPress={() => router.replace('/activity')}
          >
            <Text style={styles.continueShoppingBtnText}>View My Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.backToMenuBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.backToMenuBtnText}>Back to Menu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Card details form
  if (showCardForm) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/cart')} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Card Details</Text>
          <View style={styles.headerTotal}>
            <Text style={styles.headerTotalText}>R{finalTotal.toFixed(2)}</Text>
          </View>
        </View>

        <ScrollView style={styles.cardFormScroll} contentContainerStyle={styles.cardFormContent}>
          {/* Order summary mini card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            {cart.map((item, idx) => (
              <View key={item.id || idx} style={styles.summaryRow}>
                <Text style={styles.summaryItem}>
                  {item.quantity}x {item.name}
                </Text>
                <Text style={styles.summaryPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            ))}
            {orderNote ? (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryNoteRow}>
                  <Text style={styles.summaryNoteLabel}>Note:</Text>
                  <Text style={styles.summaryNote}>{orderNote}</Text>
                </View>
              </>
            ) : null}
            {appliedDiscount ? (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryDiscountRow}>
                  <Text style={styles.summaryDiscountLabel}>Discount ({appliedDiscount.percentage}%)</Text>
                  <Text style={styles.summaryDiscountValue}>-R{discountAmount.toFixed(2)}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              {appliedDiscount ? (
                <Text style={styles.summaryTotalValue}>
                  <Text style={styles.summaryOriginalPrice}>R{totalPrice.toFixed(2)}</Text>
                  {' '}R{finalTotal.toFixed(2)}
                </Text>
              ) : (
                <Text style={styles.summaryTotalValue}>R{totalPrice.toFixed(2)}</Text>
              )}
            </View>
          </View>

          {/* Card Details Form */}
          <View style={styles.cardFormSection}>
            <Text style={styles.cardFormTitle}>💳 Payment Details</Text>
            <Text style={styles.cardFormSubtitle}>
              Enter your card information to complete the payment
            </Text>

            {/* Cardholder Name */}
            <View style={styles.cardInputGroup}>
              <Text style={styles.cardLabel}>CARDHOLDER NAME</Text>
              <View style={[styles.cardInputWrapper, formErrors.cardholderName ? styles.cardInputError : null]}>
                <TextInput
                  style={styles.cardInput}
                  placeholder="John Doe"
                  placeholderTextColor="#6B6B6B"
                  value={cardholderName}
                  onChangeText={(val) => { setCardholderName(val); setFormErrors({...formErrors, cardholderName: ''}); }}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
              {formErrors.cardholderName && <Text style={styles.cardFieldError}>{formErrors.cardholderName}</Text>}
            </View>

            {/* Card Number */}
            <View style={styles.cardInputGroup}>
              <Text style={styles.cardLabel}>CARD NUMBER</Text>
              <View style={[styles.cardInputWrapper, formErrors.cardNumber ? styles.cardInputError : null]}>
                <Text style={styles.cardInputIcon}>💳</Text>
                <TextInput
                  style={styles.cardInput}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor="#6B6B6B"
                  value={cardNumber}
                  onChangeText={(val) => { setCardNumber(formatCardNumber(val)); setFormErrors({...formErrors, cardNumber: ''}); }}
                  keyboardType="number-pad"
                  maxLength={19}
                />
              </View>
              {formErrors.cardNumber && <Text style={styles.cardFieldError}>{formErrors.cardNumber}</Text>}
            </View>

            {/* Expiry and CVV row */}
            <View style={styles.cardRow}>
              <View style={[styles.cardInputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.cardLabel}>EXPIRY DATE</Text>
                <View style={[styles.cardInputWrapper, formErrors.expiryDate ? styles.cardInputError : null]}>
                  <TextInput
                    style={styles.cardInput}
                    placeholder="MM/YY"
                    placeholderTextColor="#6B6B6B"
                    value={expiryDate}
                    onChangeText={(val) => { setExpiryDate(formatExpiry(val)); setFormErrors({...formErrors, expiryDate: ''}); }}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                {formErrors.expiryDate && <Text style={styles.cardFieldError}>{formErrors.expiryDate}</Text>}
              </View>

              <View style={[styles.cardInputGroup, { flex: 1 }]}>
                <Text style={styles.cardLabel}>CVV</Text>
                <View style={[styles.cardInputWrapper, formErrors.cvv ? styles.cardInputError : null]}>
                  <TextInput
                    style={styles.cardInput}
                    placeholder="123"
                    placeholderTextColor="#6B6B6B"
                    value={cvv}
                    onChangeText={(val) => { setCvv(val.replace(/\D/g, '').slice(0, 4)); setFormErrors({...formErrors, cvv: ''}); }}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
                {formErrors.cvv && <Text style={styles.cardFieldError}>{formErrors.cvv}</Text>}
              </View>
            </View>

            {/* Save Card Checkbox */}
            <TouchableOpacity 
              style={styles.saveCardRow} 
              onPress={() => setSaveCardEnabled(!saveCardEnabled)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, saveCardEnabled && styles.checkboxSelected]}>
                {saveCardEnabled && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <View style={styles.saveCardTextContainer}>
                <Text style={styles.saveCardTitle}>Save Card for Future Purchases</Text>
                <Text style={styles.saveCardSubtitle}>Your card will be securely stored for faster checkout next time</Text>
              </View>
            </TouchableOpacity>

            {/* Security note */}
            <View style={styles.securityNote}>
              <Text style={styles.securityIcon}>🔒</Text>
              <Text style={styles.securityText}>
                Your payment information is encrypted and secure. We do not store your card details.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Pay button */}
        <View style={styles.cardFooter}>
          <TouchableOpacity style={styles.payNowBtn} onPress={handleCardSubmit}>
            <Text style={styles.payNowBtnText}>Pay R{finalTotal.toFixed(2)}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // PayFast WebView (payment processing)
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/cart')} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Processing Payment</Text>
        <View style={styles.headerTotal}>
          <Text style={styles.headerTotalText}>R{finalTotal.toFixed(2)}</Text>
        </View>
      </View>

      {/* Order summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Order Summary</Text>
        {cart.map((item, idx) => (
          <View key={item.id || idx} style={styles.summaryRow}>
            <Text style={styles.summaryItem}>
              {item.quantity}x {item.name}
            </Text>
            <Text style={styles.summaryPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
          </View>
        ))}
        {appliedDiscount ? (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryDiscountRow}>
              <Text style={styles.summaryDiscountLabel}>Discount ({appliedDiscount.percentage}%)</Text>
              <Text style={styles.summaryDiscountValue}>-R{discountAmount.toFixed(2)}</Text>
            </View>
          </>
        ) : null}
        <View style={styles.summaryDivider} />
        <View style={styles.summaryTotalRow}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          {appliedDiscount ? (
            <Text style={styles.summaryTotalValue}>
              <Text style={styles.summaryOriginalPrice}>R{totalPrice.toFixed(2)}</Text>
              {' '}R{finalTotal.toFixed(2)}
            </Text>
          ) : (
            <Text style={styles.summaryTotalValue}>R{totalPrice.toFixed(2)}</Text>
          )}
        </View>
      </View>

      <WebView
        ref={webViewRef}
        source={{ html: payFastHTML }}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        style={styles.webview}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Processing payment securely...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  closeButton: { padding: 4 },
  closeButtonText: { color: '#FF453A', fontWeight: '700', fontSize: 15 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  headerTotal: { backgroundColor: '#1C1C1E', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  headerTotalText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  webview: { flex: 1, opacity: 0, height: 0 },
  
  // Summary card
  summaryCard: { backgroundColor: '#1A1A1A', margin: 16, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2C2C2E' },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  summaryItem: { fontSize: 13, color: '#A0A0A0', flex: 1 },
  summaryPrice: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: '#2C2C2E', marginVertical: 10 },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryTotalLabel: { fontSize: 14, color: '#8E8E93' },
  summaryTotalValue: { fontSize: 16, fontWeight: '800', color: '#22C55E' },
  summaryOriginalPrice: { textDecorationLine: 'line-through', color: '#6B6B6B', fontSize: 14 },
  summaryDiscountRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  summaryDiscountLabel: { fontSize: 13, color: '#5AC8FA' },
  summaryDiscountValue: { fontSize: 13, color: '#22C55E', fontWeight: '600' },
  summaryNoteRow: { marginTop: 6, marginBottom: 4 },
  summaryNoteLabel: { fontSize: 12, fontWeight: '700', color: '#5AC8FA' },
  summaryNote: { fontSize: 12, color: '#8E8E93', lineHeight: 16, marginTop: 2 },
  successOriginalPrice: { textDecorationLine: 'line-through', color: '#6B6B6B', fontSize: 24 },
  
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: { marginTop: 15, fontSize: 15, color: '#8E8E93', fontWeight: '500' },

  // Card Form Styles
  cardFormScroll: { flex: 1 },
  cardFormContent: { paddingBottom: 20 },
  cardFormSection: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  cardFormTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  cardFormSubtitle: { fontSize: 12, color: '#8E8E93', marginBottom: 20, lineHeight: 16 },
  cardInputGroup: { marginBottom: 16 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#6B6B6B', marginBottom: 6, letterSpacing: 0.5 },
  cardInputWrapper: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInputError: { borderColor: '#FF453A' },
  cardInputIcon: { fontSize: 16, marginRight: 10 },
  cardInput: { flex: 1, fontSize: 16, color: '#FFFFFF', paddingVertical: 0, height: 50 },
  cardFieldError: { color: '#FF453A', fontSize: 11, fontWeight: '600', marginTop: 4, marginLeft: 4 },
  cardRow: { flexDirection: 'row' },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginTop: 4,
  },
  securityIcon: { fontSize: 16, marginRight: 10 },
  securityText: { fontSize: 12, color: '#8E8E93', flex: 1, lineHeight: 16 },
  cardFooter: {
    backgroundColor: '#0C0C0C',
    borderTopWidth: 1,
    borderTopColor: '#1C1C1E',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  payNowBtn: {
    backgroundColor: '#22C55E',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  payNowBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // Success Screen Styles
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#121212',
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A3A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  successIcon: { fontSize: 40 },
  successTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginBottom: 8 },
  successAmount: { fontSize: 36, fontWeight: '900', color: '#22C55E', marginBottom: 12 },
  successSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  emailStatusCard: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  emailStatusRow: { flexDirection: 'row', alignItems: 'center' },
  emailIcon: { fontSize: 24, marginRight: 12 },
  emailStatusContent: { flex: 1 },
  emailStatusTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  emailStatusText: { fontSize: 12, color: '#8E8E93', lineHeight: 16 },
  emailCheckmark: { fontSize: 20 },
  continueShoppingBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  continueShoppingBtnText: { color: '#000000', fontSize: 16, fontWeight: '800' },
  backToMenuBtn: {
    backgroundColor: '#1C1C1E',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  backToMenuBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // Save Card Checkbox Styles
  saveCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#6B6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxSelected: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  checkboxCheck: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  saveCardTextContainer: {
    flex: 1,
  },
  saveCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  saveCardSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
    lineHeight: 14,
  },
});
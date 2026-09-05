import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Platform, StatusBar, ScrollView } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useKitchen } from '../context/KitchenCoContext';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { haptics } from '../utils/haptics';
import { ThemeColors } from '../utils/theme';

// Configure how notifications should behave when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function PayFastSandboxScreen() {
  const { cart, placeOrder, user, savedCards, saveCard, orderNote, appliedDiscount, calculateDiscountAmount, deliveryInfo, theme } = useKitchen();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCardForm, setShowCardForm] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [saveCardEnabled, setSaveCardEnabled] = useState(false);
  // A saved card only ever exposes a masked number, so re-selecting one skips
  // straight to CVV confirmation rather than asking for the full PAN again.
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null);
  // finalTotal is derived live from `cart`, which placeOrder() empties on
  // success — snapshot the amount actually paid so the success screen still
  // has something to show once the cart is gone.
  const [paidAmount, setPaidAmount] = useState(0);

  // Calculate discount amount and final total (only on eligible items)
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = calculateDiscountAmount(cart, appliedDiscount);
  const deliveryFee = deliveryInfo.fee ?? 0;
  const finalTotal = totalPrice - discountAmount + deliveryFee;

  // Card form fields
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [formErrors, setFormErrors] = useState<{[key: string]: string | undefined}>({});

  // PayFast’s m_payment_id is our reference for this checkout, so it has to
  // stay fixed for the life of the screen. It was Date.now() inlined into the
  // form template below, which is built during render — so every re-render
  // (a keystroke in the card form is enough) minted a different reference for
  // the same payment. Lazy useState computes it once per mount instead.
  const [paymentReference] = useState(() => `KITCHEN-${Date.now()}`);

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

  // Card number and expiry are deliberately NOT auto-formatted with inserted
  // spaces/slashes while typing (no "1234 5678" / "12/25" live reformat).
  // Rewriting a controlled TextInput's value mid-keystroke to insert
  // characters is a well-documented Android cursor-jump/flicker source —
  // the native cursor snaps to the end of the text on every reformat,
  // which is exactly the "glitching" this was causing. Digits-only input
  // (matching how the CVV field already behaved, which never glitched)
  // sidesteps the whole bug category. The card number needs no formatter
  // at all now — maskCardNumber handles the saved-card display — so only
  // formatExpiry survives, used when recording the saved card below.

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

    // A saved card was already validated when it was first entered — re-confirming
    // it for a faster checkout only needs the CVV, never the full card number again.
    if (selectedSavedCardId) {
      if (cvv.length < 3) errors.cvv = 'Please enter a valid CVV';
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    }

    const cleanedCardNum = cardNumber.replace(/\s/g, '');

    if (!cardholderName.trim()) {
      errors.cardholderName = 'Cardholder name is required';
    }
    if (cleanedCardNum.length < 16) {
      errors.cardNumber = 'Please enter a valid 16-digit card number';
    }
    if (expiryDate.length < 4) {
      errors.expiryDate = 'Please enter a valid expiry date (MM/YY)';
    } else {
      const month = expiryDate.slice(0, 2);
      const year = expiryDate.slice(2, 4);
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
    haptics.light();
    if (validateCardForm()) {
      // Only save a *new* card — a previously-saved one is already on file.
      if (!selectedSavedCardId && saveCardEnabled && user) {
        saveCard({
          cardholderName: cardholderName.trim(),
          cardNumber: maskCardNumber(cardNumber),
          expiryDate: formatExpiry(expiryDate),
          cardType: getCardType(cardNumber),
        });
      }
      setShowCardForm(false);
      setIsLoading(true);
    } else {
      haptics.warning();
    }
  };

  const handleSelectSavedCard = (cardId: string) => {
    setSelectedSavedCardId(cardId);
    setCvv('');
    setFormErrors({});
  };

  const handleUseDifferentCard = () => {
    setSelectedSavedCardId(null);
    setCardholderName('');
    setCardNumber('');
    setExpiryDate('');
    setCvv('');
    setFormErrors({});
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
            background-color: #FFFFFF;
            text-align: center;
          }
          .loader {
            border: 4px solid #EBEBEB;
            border-top: 4px solid #000000;
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
          h2 { color: #000000; font-size: 18px; font-weight: 600; }
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
          
          <input type="hidden" name="m_payment_id" value="${paymentReference}">
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
      setIsLoading(false);
      await triggerSuccessNotification();
      
      // 2. Send email notification to the user's email
      await sendEmailNotification();
      
      // 3. Clear state and record order details — snapshot the total first,
      // since placeOrder() empties the cart that finalTotal is derived from.
      setPaidAmount(finalTotal);
      placeOrder();

      // 4. Show success screen
      haptics.success();
      setShowSuccess(true);
    } else if (url.startsWith(CANCEL_URL)) {
      router.replace('/cart');
    }
  };

  // Success screen after payment + email
  if (showSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
        <View style={styles.successContainer}>
          <View style={styles.successIconWrap}>
            <Text style={styles.successIcon}>✅</Text>
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successAmount}>R{paidAmount.toFixed(2)}</Text>
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
                <ActivityIndicator size="small" color={theme.success} />
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.continueShoppingBtn}
            onPress={() => router.replace('/activity')}
            accessibilityRole="button"
            accessibilityLabel="View my orders"
          >
            <Text style={styles.continueShoppingBtnText}>View My Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backToMenuBtn}
            onPress={() => router.replace('/')}
            accessibilityRole="button"
            accessibilityLabel="Back to menu"
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
        <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.replace('/cart')}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryItem}>
                    {item.quantity}x {item.name}
                  </Text>
                  {item.deliveryDateLabel && (
                    <Text style={styles.summaryItemDate}>📅 {item.deliveryDateLabel}</Text>
                  )}
                  {item.addOns && item.addOns.length > 0 && (
                    <Text style={styles.summaryItemAddOns}>+ {item.addOns.map((a: any) => a.name).join(', ')}</Text>
                  )}
                </View>
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
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryItem}>
                {deliveryInfo.fee != null ? `Delivery Fee (${deliveryInfo.distanceKm}km)` : 'Delivery Fee'}
              </Text>
              <Text style={styles.summaryPrice}>
                {deliveryInfo.fee != null ? `R${deliveryFee.toFixed(2)}` : 'Add address'}
              </Text>
            </View>
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
              <Text style={styles.summaryTotalValue}>R{finalTotal.toFixed(2)}</Text>
            </View>
          </View>

          {/* Saved Cards — quick-select skips straight to CVV confirmation */}
          {savedCards.length > 0 && (
            <View style={styles.savedCardsSection}>
              <Text style={styles.savedCardsTitle}>SAVED CARDS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedCardsRow}>
                {savedCards.map((card) => {
                  const isSelected = selectedSavedCardId === card.id;
                  return (
                    <TouchableOpacity
                      key={card.id}
                      style={[styles.savedCardChip, isSelected && styles.savedCardChipSelected]}
                      onPress={() => handleSelectSavedCard(card.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${card.cardType.toUpperCase()} card, ${card.cardNumber}`}
                    >
                      <Text style={styles.savedCardChipIcon}>💳</Text>
                      <View>
                        <Text style={[styles.savedCardChipType, isSelected && styles.savedCardChipTextSelected]}>{card.cardType.toUpperCase()}</Text>
                        <Text style={[styles.savedCardChipNumber, isSelected && styles.savedCardChipTextSelected]}>{card.cardNumber}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.savedCardChip, styles.newCardChip, !selectedSavedCardId && styles.savedCardChipSelected]}
                  onPress={handleUseDifferentCard}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !selectedSavedCardId }}
                  accessibilityLabel="Use a new card"
                >
                  <Text style={styles.savedCardChipIcon}>➕</Text>
                  <Text style={[styles.savedCardChipType, !selectedSavedCardId && styles.savedCardChipTextSelected]}>New Card</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* Card Details Form */}
          <View style={styles.cardFormSection}>
            <Text style={styles.cardFormTitle}>💳 Payment Details</Text>
            <Text style={styles.cardFormSubtitle}>
              {selectedSavedCardId
                ? 'Confirm the CVV for your saved card to complete the payment'
                : 'Enter your card information to complete the payment'}
            </Text>

            {selectedSavedCardId ? (
              <View style={styles.selectedCardSummary}>
                <Text style={styles.selectedCardSummaryIcon}>💳</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedCardSummaryName}>
                    {savedCards.find((c) => c.id === selectedSavedCardId)?.cardholderName}
                  </Text>
                  <Text style={styles.selectedCardSummaryNumber}>
                    {savedCards.find((c) => c.id === selectedSavedCardId)?.cardNumber}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleUseDifferentCard}
                  accessibilityRole="button"
                  accessibilityLabel="Change card"
                >
                  <Text style={styles.selectedCardSummaryChange}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Cardholder Name */}
                <View style={styles.cardInputGroup}>
                  <Text style={styles.cardLabel}>CARDHOLDER NAME</Text>
                  <View style={[styles.cardInputWrapper, formErrors.cardholderName ? styles.cardInputError : null]}>
                    <TextInput
                      style={styles.cardInput}
                      placeholder="John Doe"
                      placeholderTextColor={theme.textTertiary}
                      value={cardholderName}
                      onChangeText={(val) => { setCardholderName(val); setFormErrors({...formErrors, cardholderName: undefined}); }}
                      autoCapitalize="words"
                      autoCorrect={false}
                      accessibilityLabel="John Doe"
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
                      placeholderTextColor={theme.textTertiary}
                      value={cardNumber}
                      onChangeText={(val) => { setCardNumber(val.replace(/\D/g, '').slice(0, 16)); setFormErrors({...formErrors, cardNumber: undefined}); }}
                      keyboardType="number-pad"
                      maxLength={16}
                      accessibilityLabel="1234 5678 9012 3456"
                    />
                  </View>
                  {formErrors.cardNumber && <Text style={styles.cardFieldError}>{formErrors.cardNumber}</Text>}
                </View>

                <View style={styles.cardInputGroup}>
                  <Text style={styles.cardLabel}>EXPIRY DATE</Text>
                  <View style={[styles.cardInputWrapper, formErrors.expiryDate ? styles.cardInputError : null]}>
                    <TextInput
                      style={styles.cardInput}
                      placeholder="MM/YY"
                      placeholderTextColor={theme.textTertiary}
                      value={expiryDate}
                      onChangeText={(val) => { setExpiryDate(val.replace(/\D/g, '').slice(0, 4)); setFormErrors({...formErrors, expiryDate: undefined}); }}
                      keyboardType="number-pad"
                      maxLength={4}
                      accessibilityLabel="MM/YY"
                    />
                  </View>
                  {formErrors.expiryDate && <Text style={styles.cardFieldError}>{formErrors.expiryDate}</Text>}
                </View>
              </>
            )}

            {/* CVV — required for both a new card and a re-confirmed saved card */}
            <View style={styles.cardInputGroup}>
              <Text style={styles.cardLabel}>CVV</Text>
              <View style={[styles.cardInputWrapper, formErrors.cvv ? styles.cardInputError : null, { maxWidth: 140 }]}>
                <TextInput
                  style={styles.cardInput}
                  placeholder="123"
                  placeholderTextColor={theme.textTertiary}
                  value={cvv}
                  onChangeText={(val) => { setCvv(val.replace(/\D/g, '').slice(0, 4)); setFormErrors({...formErrors, cvv: undefined}); }}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  accessibilityLabel="123"
                />
              </View>
              {formErrors.cvv && <Text style={styles.cardFieldError}>{formErrors.cvv}</Text>}
            </View>

            {/* Save Card Checkbox — only relevant when entering a new card */}
            {!selectedSavedCardId && (
              <TouchableOpacity
                style={styles.saveCardRow}
                onPress={() => setSaveCardEnabled(!saveCardEnabled)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: saveCardEnabled }}
                accessibilityLabel="Save card for future purchases"
              >
                <View style={[styles.checkbox, saveCardEnabled && styles.checkboxSelected]}>
                  {saveCardEnabled && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <View style={styles.saveCardTextContainer}>
                  <Text style={styles.saveCardTitle}>Save Card for Future Purchases</Text>
                  <Text style={styles.saveCardSubtitle}>Your card will be securely stored for faster checkout next time</Text>
                </View>
              </TouchableOpacity>
            )}

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
          <TouchableOpacity
            style={styles.payNowBtn}
            onPress={handleCardSubmit}
            accessibilityRole="button"
            accessibilityLabel={`Pay R${finalTotal.toFixed(2)}`}
          >
            <Text style={styles.payNowBtnText}>Pay R{finalTotal.toFixed(2)}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // PayFast WebView (payment processing)
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/cart')}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.closeButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Processing Payment</Text>
        <View style={styles.headerTotal}>
          <Text style={styles.headerTotalText}>R{finalTotal.toFixed(2)}</Text>
        </View>
      </View>

      <ScrollView style={styles.processingScroll} contentContainerStyle={styles.processingScrollContent}>
        {/* Order summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          {cart.map((item, idx) => (
            <View key={item.id || idx} style={styles.summaryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryItem}>
                  {item.quantity}x {item.name}
                </Text>
                {item.deliveryDateLabel && (
                  <Text style={styles.summaryItemDate}>📅 {item.deliveryDateLabel}</Text>
                )}
                {item.addOns && item.addOns.length > 0 && (
                  <Text style={styles.summaryItemAddOns}>+ {item.addOns.map((a: any) => a.name).join(', ')}</Text>
                )}
              </View>
              <Text style={styles.summaryPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryItem}>
              {deliveryInfo.fee != null ? `Delivery (${deliveryInfo.distanceKm}km)` : 'Delivery'}
            </Text>
            <Text style={styles.summaryPrice}>
              {deliveryInfo.fee != null ? `R${deliveryFee.toFixed(2)}` : 'Add address'}
            </Text>
          </View>
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
            <Text style={styles.summaryTotalValue}>R{finalTotal.toFixed(2)}</Text>
          </View>
        </View>

        {Platform.OS === 'web' ? (
          <View style={styles.webFallback}>
            <Text style={styles.webFallbackIcon}>🔒</Text>
            <Text style={styles.webFallbackTitle}>Sandbox Redirect</Text>
            <Text style={styles.webFallbackText}>
              The PayFast hosted page runs inside a native web view, which is not
              available on the web demo. Use the sandbox controls below to simulate
              the redirect outcome.
            </Text>
            <TouchableOpacity
              style={[styles.webFallbackBtn, styles.webFallbackBtnSuccess]}
              onPress={() => handleNavigationStateChange({ url: RETURN_URL })}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Simulate payment success"
            >
              <Text style={styles.webFallbackBtnText}>Simulate Payment Success</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.webFallbackBtn, styles.webFallbackBtnCancel]}
              onPress={() => handleNavigationStateChange({ url: CANCEL_URL })}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Simulate payment cancelled"
            >
              <Text style={styles.webFallbackBtnText}>Simulate Payment Cancelled</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: payFastHTML }}
            onNavigationStateChange={handleNavigationStateChange}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            style={styles.webview}
          />
        )}
      </ScrollView>

      {isLoading && Platform.OS !== 'web' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.white} />
          <Text style={styles.loadingText}>Processing payment securely...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  closeButton: { padding: 4 },
  closeButtonText: { color: theme.error, fontWeight: '700', fontSize: 15 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
  headerTotal: { backgroundColor: theme.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  headerTotalText: { color: theme.text, fontWeight: '800', fontSize: 14 },
  webview: { flex: 1, opacity: 0, height: 0 },
  processingScroll: { flex: 1 },
  processingScrollContent: { paddingBottom: 24 },

  // Web fallback panel (PayFast's hosted page runs inside a native WebView,
  // which is unavailable on web). Provides explicit sandbox redirect controls.
  webFallback: {
    padding: 24,
    alignItems: 'center',
  },
  webFallbackIcon: { fontSize: 44, marginBottom: 12 },
  webFallbackTitle: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 8 },
  webFallbackText: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  webFallbackBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  webFallbackBtnSuccess: { backgroundColor: theme.success },
  webFallbackBtnCancel: { backgroundColor: theme.error },
  webFallbackBtnText: { color: theme.white, fontSize: 15, fontWeight: '800' },

  // Summary card
  summaryCard: { backgroundColor: theme.surface, margin: 16, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: theme.border },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: theme.text, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  summaryItem: { fontSize: 13, color: theme.textSecondary },
  summaryItemDate: { fontSize: 11, color: theme.text, fontWeight: '600', marginTop: 2 },
  summaryItemAddOns: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  summaryPrice: { fontSize: 13, color: theme.text, fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: theme.border, marginVertical: 10 },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryTotalLabel: { fontSize: 14, color: theme.textSecondary },
  summaryTotalValue: { fontSize: 16, fontWeight: '800', color: theme.text },
  summaryOriginalPrice: { textDecorationLine: 'line-through', color: theme.textTertiary, fontSize: 14 },
  summaryDiscountRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  summaryDiscountLabel: { fontSize: 13, color: theme.textSecondary },
  summaryDiscountValue: { fontSize: 13, color: theme.success, fontWeight: '600' },
  summaryNoteRow: { marginTop: 6, marginBottom: 4 },
  summaryNoteLabel: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  summaryNote: { fontSize: 12, color: theme.textSecondary, lineHeight: 16, marginTop: 2 },
  successOriginalPrice: { textDecorationLine: 'line-through', color: theme.textTertiary, fontSize: 24 },

  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: theme.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: { marginTop: 15, fontSize: 15, color: theme.white, fontWeight: '500' },

  // Card Form Styles
  cardFormScroll: { flex: 1 },
  cardFormContent: { paddingBottom: 20 },
  cardFormSection: {
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardFormTitle: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 4 },
  cardFormSubtitle: { fontSize: 12, color: theme.textSecondary, marginBottom: 20, lineHeight: 16 },
  cardInputGroup: { marginBottom: 16 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.5 },
  cardInputWrapper: {
    backgroundColor: theme.inputBg,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInputError: { borderColor: theme.error },
  cardInputIcon: { fontSize: 16, marginRight: 10 },
  cardInput: { flex: 1, fontSize: 16, color: theme.text, paddingVertical: 0, height: 50 },
  cardFieldError: { color: theme.error, fontSize: 11, fontWeight: '600', marginTop: 4, marginLeft: 4 },
  cardRow: { flexDirection: 'row' },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 4,
  },
  securityIcon: { fontSize: 16, marginRight: 10 },
  securityText: { fontSize: 12, color: theme.textSecondary, flex: 1, lineHeight: 16 },
  cardFooter: {
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  payNowBtn: {
    backgroundColor: theme.success,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  payNowBtnText: { color: theme.white, fontSize: 16, fontWeight: '800' },

  // Success Screen Styles
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: theme.background,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EAF7EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: theme.success,
  },
  successIcon: { fontSize: 40 },
  successTitle: { fontSize: 24, fontWeight: '900', color: theme.text, marginBottom: 8 },
  successAmount: { fontSize: 36, fontWeight: '900', color: theme.text, marginBottom: 12 },
  successSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  emailStatusCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  emailStatusRow: { flexDirection: 'row', alignItems: 'center' },
  emailIcon: { fontSize: 24, marginRight: 12 },
  emailStatusContent: { flex: 1 },
  emailStatusTitle: { fontSize: 14, fontWeight: '800', color: theme.text, marginBottom: 2 },
  emailStatusText: { fontSize: 12, color: theme.textSecondary, lineHeight: 16 },
  emailCheckmark: { fontSize: 20 },
  continueShoppingBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  continueShoppingBtnText: { color: theme.onAccent, fontSize: 16, fontWeight: '800' },
  backToMenuBtn: {
    backgroundColor: theme.surfaceSecondary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: theme.border,
  },
  backToMenuBtnText: { color: theme.text, fontSize: 16, fontWeight: '800' },

  // Save Card Checkbox Styles
  saveCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: theme.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxSelected: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  checkboxCheck: {
    color: theme.white,
    fontSize: 12,
    fontWeight: '800',
  },
  saveCardTextContainer: {
    flex: 1,
  },
  saveCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 2,
  },
  saveCardSubtitle: {
    fontSize: 11,
    color: theme.textSecondary,
    lineHeight: 14,
  },

  // Saved card quick-select
  savedCardsSection: { marginHorizontal: 16, marginTop: 16, marginBottom: 0 },
  savedCardsTitle: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, letterSpacing: 0.5 },
  savedCardsRow: { gap: 10, paddingRight: 4 },
  savedCardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    minWidth: 160,
  },
  savedCardChipSelected: { borderColor: theme.success, backgroundColor: '#EAF7EE' },
  newCardChip: { justifyContent: 'center', minWidth: 110 },
  savedCardChipIcon: { fontSize: 18 },
  savedCardChipType: { color: theme.text, fontSize: 12, fontWeight: '800' },
  savedCardChipNumber: { color: theme.textSecondary, fontSize: 11, marginTop: 1 },
  // savedCardChipSelected's tint is a fixed light green in both themes — its
  // text must stay literal dark too, or it goes invisible in dark mode.
  savedCardChipTextSelected: { color: '#1A1A1A' },
  selectedCardSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
    gap: 12,
  },
  selectedCardSummaryIcon: { fontSize: 24 },
  selectedCardSummaryName: { color: theme.text, fontSize: 14, fontWeight: '700' },
  selectedCardSummaryNumber: { color: theme.textSecondary, fontSize: 12, marginTop: 2 },
  selectedCardSummaryChange: { color: theme.text, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});
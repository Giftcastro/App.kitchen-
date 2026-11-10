import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CartItem, DeliveryDateOption } from '../types';
import { useTheme } from '../theme/ThemeContext';

interface CartModalProps {
  visible: boolean;
  items: CartItem[];
  selectedDateOption?: DeliveryDateOption;
  deliveryDateFormatted?: string;
  userLocation?: string;
  totalZarFormatted?: string;
  totals?: {
    formattedTotalZar: string;
    itemCount: number;
    subtotalZar: number;
    vatAmount: number;
    totalZar: number;
  };
  onClose: () => void;
  onUpdateQuantity: (itemId: string, newQty: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearDateCart?: (dateString: string) => void;
  onClearCart?: () => void;
  onProceedToCheckout?: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({
  visible,
  items,
  selectedDateOption,
  deliveryDateFormatted,
  userLocation = 'Corporate Drop-off Floor',
  totalZarFormatted,
  totals,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onClearDateCart,
  onClearCart,
  onProceedToCheckout,
}) => {
  const { theme, isDark } = useTheme();

  if (!visible) return null;

  const dateLabel = deliveryDateFormatted || (selectedDateOption
    ? `${selectedDateOption.dayName}, ${selectedDateOption.dayNumber} ${selectedDateOption.monthName} ${selectedDateOption.year}`
    : 'Selected Delivery Date');

  const displayTotal = totalZarFormatted || totals?.formattedTotalZar || 'R 0.00';
  const targetDateString = items[0]?.targetDeliveryDate || '';

  const handleClear = () => {
    if (onClearCart) {
      onClearCart();
    } else if (onClearDateCart) {
      onClearDateCart(targetDateString);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.surfaceBorderLight,
            },
          ]}
        >
          {/* Top Handle */}
          <View style={[styles.handleBar, { backgroundColor: theme.surfaceBorderLight }]} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Order Review</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{dateLabel}</Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.surface }]}
            >
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Delivery Location Metadata */}
          <View style={[styles.metaCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={styles.metaRow}>
              <Ionicons name="business-outline" size={16} color={theme.primary} />
              <Text style={[styles.metaText, { color: theme.textPrimary }]}>{userLocation}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={16} color={theme.primary} />
              <Text style={[styles.metaText, { color: theme.textPrimary }]}>Batch Drop: 12:00 PM Sharp</Text>
            </View>
          </View>

          {/* Items List */}
          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cart-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Your cart for this day is empty.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.itemsScroll}>
              <View style={styles.listHeaderRow}>
                <Text style={[styles.listHeader, { color: theme.textSecondary }]}>
                  SCHEDULED MEALS ({items.reduce((s, i) => s + i.quantity, 0)})
                </Text>
                <TouchableOpacity onPress={handleClear}>
                  <Text style={[styles.clearBtnText, { color: theme.error }]}>Clear Day Cart</Text>
                </TouchableOpacity>
              </View>

              {items.map((cartItem) => (
                <View
                  key={cartItem.id}
                  style={[styles.itemCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
                >
                  <View style={styles.itemTopRow}>
                    <View style={styles.itemInfo}>
                      <View style={styles.itemNameRow}>
                        <Text style={[styles.itemName, { color: theme.textPrimary }]}>
                          {cartItem.menuItem.name}
                        </Text>
                        {cartItem.size === 'large' && (
                          <View style={[styles.sizeTag, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}>
                            <Text style={[styles.sizeTagText, { color: theme.textPrimary }]}>Large</Text>
                          </View>
                        )}
                      </View>

                      {cartItem.selectedAddOns && cartItem.selectedAddOns.length > 0 && (
                        <Text style={[styles.itemAddOnsText, { color: theme.textSecondary }]}>
                          + {cartItem.selectedAddOns.map((a) => `${a.name} (+R${a.price.toFixed(0)})`).join(', ')}
                        </Text>
                      )}

                      <Text style={[styles.itemUnit, { color: theme.textSecondary }]}>
                        R {cartItem.unitPrice.toFixed(2)} each
                      </Text>

                      {cartItem.targetDeliveryDate ? (
                        <View style={[styles.itemDateBadge, { backgroundColor: theme.surfaceHighlight }]}>
                          <Ionicons name="calendar-outline" size={11} color={theme.textSecondary} />
                          <Text style={[styles.itemDateText, { color: theme.textSecondary }]}>
                            Deliver on: {cartItem.targetDeliveryDate}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={[styles.itemTotal, { color: theme.primary }]}>
                      R {cartItem.totalPrice.toFixed(2)}
                    </Text>
                  </View>

                  {/* Allergy Notes if any */}
                  {cartItem.allergyNotes ? (
                    <View style={[styles.allergyNoteBox, { backgroundColor: theme.surfaceHighlight }]}>
                      <Ionicons name="alert-circle" size={13} color={theme.primary} />
                      <Text style={[styles.allergyNoteText, { color: theme.textSecondary }]}>
                        Note: {cartItem.allergyNotes}
                      </Text>
                    </View>
                  ) : null}

                  {/* Quantity Stepper */}
                  <View style={styles.itemBottomRow}>
                    <TouchableOpacity
                      onPress={() => onRemoveItem(cartItem.id)}
                      style={styles.removeAction}
                    >
                      <Ionicons name="trash-outline" size={15} color={theme.textMuted} />
                      <Text style={[styles.removeText, { color: theme.textMuted }]}>Remove</Text>
                    </TouchableOpacity>

                    <View style={[styles.stepper, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}>
                      <TouchableOpacity
                        onPress={() => onUpdateQuantity(cartItem.id, cartItem.quantity - 1)}
                        style={styles.stepperBtn}
                      >
                        <Ionicons name="remove" size={16} color={theme.textPrimary} />
                      </TouchableOpacity>

                      <Text style={[styles.stepperNum, { color: theme.textPrimary }]}>
                        {cartItem.quantity}
                      </Text>

                      <TouchableOpacity
                        onPress={() => onUpdateQuantity(cartItem.id, cartItem.quantity + 1)}
                        style={styles.stepperBtn}
                      >
                        <Ionicons name="add" size={16} color={theme.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Footer Checkout */}
          {items.length > 0 && (
            <View style={[styles.footer, { borderTopColor: theme.surfaceBorder }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Due (ZAR)</Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>{displayTotal}</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  onClose();
                  if (onProceedToCheckout) {
                    onProceedToCheckout();
                  }
                }}
                style={[styles.checkoutBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.checkoutBtnText, { color: theme.onPrimary }]}>
                  Proceed to Checkout (12:00 PM Drop)
                </Text>
                <Ionicons name="arrow-forward" size={18} color={theme.onPrimary} />
              </TouchableOpacity>
            </View>
          )}
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
    maxHeight: '88%',
    borderTopWidth: 1,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  itemsScroll: {
    maxHeight: 280,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
    paddingRight: 8,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  sizeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  sizeTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  itemAddOnsText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemUnit: {
    fontSize: 12,
    marginTop: 2,
  },
  itemDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  itemDateText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '800',
  },
  allergyNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 6,
  },
  allergyNoteText: {
    fontSize: 11,
    fontWeight: '500',
  },
  itemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  removeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeText: {
    fontSize: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperNum: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  footer: {
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  checkoutBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  checkoutBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});

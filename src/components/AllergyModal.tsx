import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuItem, DeliveryDateOption, MenuAddOn } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme';
import { generateWeekdayOptions, groupWeekdaysByWeek } from '../utils/sastTime';
import { MENU_CATEGORIES, getCategoryHeroImage } from '../data/mockData';

interface AllergyModalProps {
  visible: boolean;
  item?: MenuItem | null;
  dish?: MenuItem | null;
  selectedDateOption?: DeliveryDateOption;
  selectedDateFormatted?: string;
  availableDates?: DeliveryDateOption[];
  onClose: () => void;
  onConfirm: (
    item: MenuItem,
    quantity: number,
    notes: string,
    size?: 'standard' | 'large',
    selectedAddOns?: MenuAddOn[],
    dateAllocations?: { dateString: string; quantity: number }[]
  ) => void;
  onNavigateToCheckout?: () => void;
  onOpenDateSelector?: () => void;
}

// Session tracker so user is only notified once per session
let hasSeenCutoffSession = false;

export const AllergyModal: React.FC<AllergyModalProps> = ({
  visible,
  item,
  dish,
  selectedDateOption,
  selectedDateFormatted,
  availableDates,
  onClose,
  onConfirm,
  onNavigateToCheckout,
  onOpenDateSelector,
}) => {
  const activeDish = dish || item || null;
  const { theme, isDark } = useTheme();

  const isStandardMenu = activeDish?.menuType === 'standard';

  // 9:00 AM cutoff banner popup state
  const [showCutoffNotice, setShowCutoffNotice] = useState<boolean>(false);

  // Post-add 3-choice bottom modal state
  const [showPostAddChoice, setShowPostAddChoice] = useState<boolean>(false);
  const [addedDeliveryDayName, setAddedDeliveryDayName] = useState<string>('Wednesday');

  // Filter between "Current Week" (week index 0) and "In 2 Weeks" (week index 1)
  const [activeWeekTab, setActiveWeekTab] = useState<number>(0);

  // Orderable dates
  const orderableWeekdays = useMemo(() => {
    const source =
      availableDates && availableDates.length > 0
        ? availableDates
        : generateWeekdayOptions(undefined, 14);
    return source.filter((d) => d.isAvailable && !d.isLocked);
  }, [availableDates]);

  // Grouped by week (up to 2 weeks)
  const dateWeekGroups = useMemo(() => {
    return groupWeekdaysByWeek(orderableWeekdays, undefined, 2);
  }, [orderableWeekdays]);

  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<'standard' | 'large'>('standard');
  const [selectedAddOns, setSelectedAddOns] = useState<MenuAddOn[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [dateQuantities, setDateQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (visible && activeDish) {
      setQuantity(1);
      setNotes('');
      setSelectedSize('standard');
      setSelectedAddOns([]);
      setShowPostAddChoice(false);

      // Check if cutoff notice has been shown
      if (!hasSeenCutoffSession) {
        setShowCutoffNotice(true);
        hasSeenCutoffSession = true;
      } else {
        setShowCutoffNotice(false);
      }

      const activeOrderableDate =
        selectedDateOption && selectedDateOption.isAvailable && !selectedDateOption.isLocked
          ? selectedDateOption.dateString
          : orderableWeekdays[0]?.dateString || '';
      setSelectedDates(activeOrderableDate ? [activeOrderableDate] : []);
      setDateQuantities(activeOrderableDate ? { [activeOrderableDate]: 1 } : {});

      // Determine initial active week tab based on selected date
      if (dateWeekGroups.length > 1 && activeOrderableDate) {
        const inSecondWeek = dateWeekGroups[1]?.days.some((d: DeliveryDateOption) => d.dateString === activeOrderableDate);
        if (inSecondWeek) {
          setActiveWeekTab(1);
        } else {
          setActiveWeekTab(0);
        }
      }
    }
  }, [visible, activeDish, selectedDateOption, orderableWeekdays, dateWeekGroups]);

  const hasLargeOption = !!activeDish?.prices?.large;
  const standardPrice = activeDish?.prices?.standard || activeDish?.price || 0;
  const largePrice = activeDish?.prices?.large || standardPrice;
  const basePrice = selectedSize === 'large' ? largePrice : standardPrice;

  const availableAddOns: MenuAddOn[] = activeDish?.addOns || [];

  // Hero image resolution (strictly per category as specified)
  const heroImageUrl = useMemo(() => {
    if (!activeDish) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&auto=format&fit=crop&q=80';
    return getCategoryHeroImage(activeDish.categoryId, activeDish.categoryName);
  }, [activeDish]);

  const handleToggleAddOn = (addOn: MenuAddOn) => {
    setSelectedAddOns((prev) => {
      const exists = prev.some((a) => a.name === addOn.name);
      if (exists) {
        return prev.filter((a) => a.name !== addOn.name);
      }
      return [...prev, addOn];
    });
  };

  const handleToggleDate = (dateStr: string) => {
    const isOrderable = orderableWeekdays.some((d) => d.dateString === dateStr);
    if (!isOrderable) return;

    setSelectedDates((prev) => {
      if (prev.includes(dateStr)) {
        if (prev.length === 1) return prev; // Keep at least 1 date selected
        const next = prev.filter((d) => d !== dateStr);
        setDateQuantities((prevQ) => {
          const nextQ = { ...prevQ };
          delete nextQ[dateStr];
          return nextQ;
        });
        return next;
      } else {
        setDateQuantities((prevQ) => ({ ...prevQ, [dateStr]: 1 }));
        return [...prev, dateStr];
      }
    });
  };

  const handleClearDates = () => {
    if (orderableWeekdays[0]?.dateString) {
      setSelectedDates([orderableWeekdays[0].dateString]);
      setDateQuantities({ [orderableWeekdays[0].dateString]: 1 });
    }
  };

  const handleDateQtyChange = (dateStr: string, newQty: number) => {
    if (newQty < 1 || newQty > 20) return;
    setDateQuantities((prev) => ({ ...prev, [dateStr]: newQty }));
  };

  const totalPortions = (!isStandardMenu || selectedDates.length <= 1)
    ? quantity
    : selectedDates.reduce((sum, d) => sum + (dateQuantities[d] || 1), 0);

  const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
  const singlePortionTotal = basePrice + addOnsTotal;
  const totalCalculated = (totalPortions * singlePortionTotal).toFixed(2);

  const handleIncrement = () => setQuantity((q) => Math.min(20, q + 1));
  const handleDecrement = () => setQuantity((q) => Math.max(1, q - 1));

  const handleAdd = () => {
    if (!activeDish) return;

    // Record delivery day name for the choice popup
    const targetDateStr = selectedDates[0] || selectedDateOption?.dateString || '';
    const matchedDate = orderableWeekdays.find((d) => d.dateString === targetDateStr);
    const dayName = matchedDate ? matchedDate.dayName : 'Wednesday';
    setAddedDeliveryDayName(dayName);

    if (isStandardMenu && selectedDates.length > 0) {
      const dateAllocations = selectedDates.map((d) => ({
        dateString: d,
        quantity: selectedDates.length >= 2 ? (dateQuantities[d] || 1) : quantity,
      }));
      onConfirm(activeDish, totalPortions, notes, selectedSize, selectedAddOns, dateAllocations);
    } else {
      onConfirm(activeDish, quantity, notes, selectedSize, selectedAddOns);
    }

    // Present the 3 choices modal
    setShowPostAddChoice(true);
  };

  if (!activeDish) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Background Blur Overlay showing Kitchen Co logo at back */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropTouchArea} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.bottomSheet,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.surfaceBorderLight,
            },
          ]}
        >
          {/* Top Handle Bar */}
          <View style={[styles.handleBar, { backgroundColor: theme.surfaceBorder }]} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* 1. Dish Hero Image */}
            <View style={[styles.heroImageWrapper, { backgroundColor: theme.surface }]}>
              <Image source={{ uri: heroImageUrl }} style={styles.heroImage} resizeMode="cover" />
              <TouchableOpacity
                onPress={onClose}
                style={[styles.floatingCloseBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* 2. Dish Title, Category & Dietary Tags */}
            <View style={styles.titleSection}>
              <View style={styles.categoryRow}>
                {activeDish.categoryName && (
                  <View style={[styles.categoryBadge, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}>
                    <Text style={[styles.categoryBadgeText, { color: theme.primary }]}>
                      {activeDish.categoryName}
                    </Text>
                  </View>
                )}
                {activeDish.dietaryTags?.map((tag) => (
                  <View key={tag} style={[styles.tagBadge, { backgroundColor: theme.tagBackground, borderColor: theme.tagBorder }]}>
                    <Text style={[styles.tagBadgeText, { color: theme.tagText }]}>{tag}</Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.dishTitle, { color: theme.textPrimary }]}>{activeDish.name}</Text>
              <Text style={[styles.unitPriceText, { color: theme.primary }]}>
                R {singlePortionTotal.toFixed(2)} each
              </Text>

              {/* Description */}
              <Text style={[styles.dishDescription, { color: theme.textSecondary }]}>
                {activeDish.description}
              </Text>
              {activeDish.ingredients ? (
                <Text style={[styles.dishIngredients, { color: theme.textMuted }]}>
                  <Text style={{ fontWeight: '700' }}>Ingredients: </Text>
                  {activeDish.ingredients}
                </Text>
              ) : null}
            </View>

            <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

            {/* 3. Delivery Day Selector (Standard Menu ONLY — Chef's Choice is strictly bound to its rotation date) */}
            {isStandardMenu ? (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                    CHOOSING A DELIVERY DAY
                  </Text>
                  {selectedDates.length > 1 && (
                    <TouchableOpacity onPress={handleClearDates}>
                      <Text style={[styles.clearActionText, { color: theme.primary }]}>Reset to 1 Day</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Week Switcher Pills */}
                {dateWeekGroups.length > 1 && (
                  <View style={[styles.weekSwitcherRow, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}>
                    <TouchableOpacity
                      onPress={() => setActiveWeekTab(0)}
                      style={[
                        styles.weekSwitcherBtn,
                        activeWeekTab === 0 && [styles.weekSwitcherBtnActive, { backgroundColor: theme.primary }],
                      ]}
                    >
                      <Text
                        style={[
                          styles.weekSwitcherText,
                          { color: activeWeekTab === 0 ? theme.textInverse : theme.textSecondary },
                        ]}
                      >
                        Current Week
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setActiveWeekTab(1)}
                      style={[
                        styles.weekSwitcherBtn,
                        activeWeekTab === 1 && [styles.weekSwitcherBtnActive, { backgroundColor: theme.primary }],
                      ]}
                    >
                      <Text
                        style={[
                          styles.weekSwitcherText,
                          { color: activeWeekTab === 1 ? theme.textInverse : theme.textSecondary },
                        ]}
                      >
                        In 2 Weeks
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Orderable Day Pills for active week */}
                <View style={styles.datesPillRow}>
                  {(dateWeekGroups[activeWeekTab]?.days || orderableWeekdays).map((dayOption: DeliveryDateOption) => {
                    const isSelected = selectedDates.includes(dayOption.dateString);
                    return (
                      <TouchableOpacity
                        key={dayOption.dateString}
                        testID={`deliver-date-${dayOption.dateString}`}
                        activeOpacity={0.75}
                        onPress={() => handleToggleDate(dayOption.dateString)}
                        style={[
                          styles.weekdayPill,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.surface,
                            borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.weekdayPillText,
                            {
                              color: isSelected ? theme.textInverse : theme.textPrimary,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {dayOption.dayName}, {dayOption.dayNumber} {dayOption.monthName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                    FIXED ROTATION DELIVERY DAY
                  </Text>
                </View>
                <View
                  testID="chefs-choice-bound-date-card"
                  style={[
                    styles.boundDateCard,
                    {
                      backgroundColor: theme.primaryMuted,
                      borderColor: theme.primary,
                    },
                  ]}
                >
                  <View style={styles.boundDateHeaderRow}>
                    <Ionicons name="lock-closed" size={15} color={theme.primary} />
                    <Text style={[styles.boundDateTitle, { color: theme.primary }]}>
                      {selectedDateOption
                        ? `${selectedDateOption.dayName}, ${selectedDateOption.dayNumber} ${selectedDateOption.monthName}`
                        : selectedDateFormatted}
                    </Text>
                  </View>
                  <Text style={[styles.boundDateSubtext, { color: theme.textSecondary }]}>
                    Chef&apos;s Choice specials are prepared exclusively for this specific rotation day and cannot be ordered across other dates.
                  </Text>
                </View>
              </View>
            )}

            {/* 4. Portion Size Selection */}
            {hasLargeOption && (
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                  SELECT PORTION SIZE
                </Text>
                <View style={styles.sizeRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSelectedSize('standard')}
                    style={[
                      styles.sizeChip,
                      {
                        backgroundColor: selectedSize === 'standard' ? theme.primary : theme.surface,
                        borderColor: selectedSize === 'standard' ? theme.primary : theme.surfaceBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sizeChipTitle,
                        { color: selectedSize === 'standard' ? theme.textInverse : theme.textPrimary },
                      ]}
                    >
                      Standard Size
                    </Text>
                    <Text
                      style={[
                        styles.sizeChipPrice,
                        { color: selectedSize === 'standard' ? theme.textInverse : theme.textSecondary },
                      ]}
                    >
                      R {standardPrice.toFixed(2)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSelectedSize('large')}
                    style={[
                      styles.sizeChip,
                      {
                        backgroundColor: selectedSize === 'large' ? theme.primary : theme.surface,
                        borderColor: selectedSize === 'large' ? theme.primary : theme.surfaceBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sizeChipTitle,
                        { color: selectedSize === 'large' ? theme.textInverse : theme.textPrimary },
                      ]}
                    >
                      Large Size
                    </Text>
                    <Text
                      style={[
                        styles.sizeChipPrice,
                        { color: selectedSize === 'large' ? theme.textInverse : theme.textSecondary },
                      ]}
                    >
                      R {largePrice.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 5. Add-Ons Checklist */}
            {availableAddOns.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                    AVAILABLE ADD-ONS
                  </Text>
                  <Text style={[styles.optionalTag, { color: theme.textMuted }]}>Optional</Text>
                </View>

                <View style={styles.addOnsGrid}>
                  {availableAddOns.map((addOn) => {
                    const isChecked = selectedAddOns.some((a) => a.name === addOn.name);
                    return (
                      <TouchableOpacity
                        key={addOn.name}
                        activeOpacity={0.75}
                        onPress={() => handleToggleAddOn(addOn)}
                        style={[
                          styles.addOnItem,
                          {
                            backgroundColor: isChecked ? theme.primaryMuted : theme.surface,
                            borderColor: isChecked ? theme.primary : theme.surfaceBorder,
                          },
                        ]}
                      >
                        <View style={styles.addOnLeft}>
                          <Ionicons
                            name={isChecked ? 'checkbox' : 'square-outline'}
                            size={18}
                            color={isChecked ? theme.primary : theme.textMuted}
                          />
                          <Text style={[styles.addOnName, { color: theme.textPrimary }]}>{addOn.name}</Text>
                        </View>
                        <Text style={[styles.addOnPrice, { color: theme.primary }]}>
                          + R {addOn.price.toFixed(2)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 6. Special Instructions & Allergies */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                SPECIAL INSTRUCTIONS &amp; ALLERGIES
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Nut allergy, dressing on the side, extra crispy..."
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
                style={[
                  styles.notesInput,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary,
                  },
                ]}
              />
            </View>

            {/* 7. Quantity Stepper */}
            <View style={[styles.stepperSection, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <View>
                <Text style={[styles.stepperLabel, { color: theme.textPrimary }]}>Quantity</Text>
                <Text style={[styles.stepperSublabel, { color: theme.textSecondary }]}>
                  {selectedDates.length > 1 ? `${selectedDates.length} days selected` : 'Per drop-off'}
                </Text>
              </View>
              <View style={styles.stepperControls}>
                <TouchableOpacity
                  onPress={handleDecrement}
                  disabled={quantity <= 1}
                  style={[styles.stepButton, { borderColor: theme.surfaceBorder }, quantity <= 1 && styles.stepButtonDisabled]}
                >
                  <Ionicons name="remove" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.quantityValue, { color: theme.textPrimary }]}>{quantity}</Text>
                <TouchableOpacity
                  onPress={handleIncrement}
                  disabled={quantity >= 20}
                  style={[styles.stepButton, { borderColor: theme.surfaceBorder }]}
                >
                  <Ionicons name="add" size={16} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 8. Add to Basket Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleAdd}
              style={[styles.confirmButton, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.confirmButtonText, { color: theme.textInverse }]}>
                ADD TO BASKET — R {totalCalculated}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* ═══════════════════════════════════════════════
          POP-UP 1: 9:00 AM CUTOFF REMINDER
         ═══════════════════════════════════════════════ */}
      <Modal visible={showCutoffNotice} transparent animationType="fade">
        <View style={styles.cutoffOverlay}>
          <View style={[styles.cutoffCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={styles.cutoffIconCircle}>
              <Ionicons name="time" size={28} color="#D53220" />
            </View>

            <Text style={[styles.cutoffTitle, { color: theme.textPrimary }]}>
              Order cutoff: 9:00 AM
            </Text>

            <Text style={[styles.cutoffMessage, { color: theme.textSecondary }]}>
              Orders must be placed by 9:00 AM to make the earliest available delivery slot. Anything placed after 9:00 AM rolls over to the next cutoff window.
            </Text>

            <TouchableOpacity
              onPress={() => setShowCutoffNotice(false)}
              style={[styles.cutoffBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.cutoffBtnText, { color: theme.textInverse }]}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════
          POP-UP 2: POST-ADD 3-CHOICE BOTTOM ACTION MODAL
         ═══════════════════════════════════════════════ */}
      <Modal visible={showPostAddChoice} transparent animationType="slide">
        <View style={styles.postAddOverlay}>
          <View style={[styles.postAddSheet, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            {/* Same category image shown on the top when the meal is added */}
            <View style={styles.postAddHeroContainer}>
              <Image source={{ uri: heroImageUrl }} style={styles.postAddHeroImage} resizeMode="cover" />
              <View style={styles.postAddHeroOverlay}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.postAddHeroBadgeText}>Added to Basket</Text>
              </View>
            </View>

            <View style={styles.postAddHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.postAddTitle, { color: theme.textPrimary }]}>{activeDish.name}</Text>
                <Text style={[styles.postAddSubtitle, { color: theme.textSecondary }]}>
                  {quantity}x portion · Scheduled for {addedDeliveryDayName}
                </Text>
              </View>
            </View>

            <View style={styles.postAddChoicesList}>
              {/* Choice 1: Continue to checkout */}
              <TouchableOpacity
                onPress={() => {
                  setShowPostAddChoice(false);
                  onClose();
                  if (onNavigateToCheckout) onNavigateToCheckout();
                }}
                activeOpacity={0.8}
                style={[styles.choiceBtnPrimary, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.choiceBtnPrimaryText, { color: theme.textInverse }]}>
                  Continue to checkout
                </Text>
                <Ionicons name="arrow-forward" size={16} color={theme.textInverse} />
              </TouchableOpacity>

              {/* Choice 2: Order for a different day */}
              <TouchableOpacity
                onPress={() => {
                  setShowPostAddChoice(false);
                  onClose();
                  if (onOpenDateSelector) onOpenDateSelector();
                }}
                activeOpacity={0.8}
                style={[styles.choiceBtnSecondary, { borderColor: theme.surfaceBorder, backgroundColor: theme.chipBg }]}
              >
                <Ionicons name="calendar-outline" size={16} color={theme.textPrimary} />
                <Text style={[styles.choiceBtnSecondaryText, { color: theme.textPrimary }]}>
                  Order for a different day
                </Text>
              </TouchableOpacity>

              {/* Choice 3: Keep ordering for this day */}
              <TouchableOpacity
                onPress={() => {
                  setShowPostAddChoice(false);
                  onClose();
                }}
                activeOpacity={0.8}
                style={styles.choiceBtnTertiary}
              >
                <Text style={[styles.choiceBtnTertiaryText, { color: theme.textSecondary }]}>
                  Keep ordering for {addedDeliveryDayName}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdropTouchArea: {
    flex: 1,
  },
  bottomSheet: {
    height: '93%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  heroImageWrapper: {
    width: '100%',
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 14,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  floatingCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    marginBottom: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  dishTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: typography.heading,
    lineHeight: 28,
  },
  unitPriceText: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  dishDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  dishIngredients: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  divider: {
    height: 1,
    marginBottom: 16,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  optionalTag: {
    fontSize: 11,
  },
  clearActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  weekSwitcherRow: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 3,
    marginBottom: 10,
  },
  weekSwitcherBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekSwitcherBtnActive: {},
  weekSwitcherText: {
    fontSize: 12,
    fontWeight: '700',
  },
  datesPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayPillText: {
    fontSize: 12,
  },
  boundDateCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 4,
  },
  boundDateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  boundDateTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  boundDateSubtext: {
    fontSize: 11,
    lineHeight: 16,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sizeChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  sizeChipTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  sizeChipPrice: {
    fontSize: 12,
    fontWeight: '600',
  },
  addOnsGrid: {
    gap: 8,
  },
  addOnItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  addOnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  addOnName: {
    fontSize: 13,
    fontWeight: '600',
  },
  addOnPrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  notesInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  stepperSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  stepperLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepperSublabel: {
    fontSize: 11,
    marginTop: 2,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'center',
  },
  confirmButton: {
    borderRadius: 24,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cutoffOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cutoffCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  cutoffIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(213, 50, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cutoffTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: typography.heading,
    marginBottom: 8,
  },
  cutoffMessage: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  cutoffBtn: {
    width: '100%',
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutoffBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  postAddOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  postAddSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  postAddHeroContainer: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
  },
  postAddHeroImage: {
    width: '100%',
    height: '100%',
  },
  postAddHeroOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  postAddHeroBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  postAddHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAddTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  postAddSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  postAddChoicesList: {
    gap: 10,
  },
  choiceBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 23,
    gap: 8,
  },
  choiceBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  choiceBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
  },
  choiceBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  choiceBtnTertiary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  choiceBtnTertiaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { BrandLogo } from './BrandLogo';
import { DeliveryDateOption } from '../types';
import { generateWeekdayOptions } from '../utils/sastTime';

interface DeliveryDateModalProps {
  visible: boolean;
  deliveryDates: DeliveryDateOption[];
  selectedDate: string;
  onConfirm: (dateString: string) => void;
  onClose?: () => void;
  canDismiss?: boolean;
  /** Shows a Skip button under Confirm: closes the picker and keeps the current day. */
  onSkip?: () => void;
  /** Shows an Orders button under Confirm: closes the picker and opens the Orders screen. */
  onViewOrders?: () => void;
}

export const DeliveryDateModal: React.FC<DeliveryDateModalProps> = ({
  visible,
  deliveryDates,
  selectedDate,
  onConfirm,
  onClose,
  canDismiss = true,
  onSkip,
  onViewOrders,
}) => {
  const { theme, isDark } = useTheme();
  // Sized from the live window so the card always fits; on short screens the dates scroll
  // and Confirm stays pinned in view.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Resolve available orderable weekdays (matching AllergyModal "Choosing a delivery day")
  const orderableDates = useMemo(() => {
    const source =
      deliveryDates && deliveryDates.length > 0
        ? deliveryDates
        : generateWeekdayOptions(undefined, 14);
    const available = source.filter((d) => d.isAvailable && !d.isLocked);
    return available.length > 0 ? available.slice(0, 10) : source.slice(0, 10);
  }, [deliveryDates]);

  const [tentativeDate, setTentativeDate] = useState<string>(selectedDate);

  // Sync tentative selection whenever modal opens or active date changes
  useEffect(() => {
    const matchedValid = orderableDates.find(
      (d) => d.dateString === selectedDate && d.isAvailable && !d.isLocked
    );
    if (matchedValid) {
      setTentativeDate(matchedValid.dateString);
    } else if (orderableDates.length > 0) {
      const firstAvailable = orderableDates.find((d) => d.isAvailable) || orderableDates[0];
      if (firstAvailable) {
        setTentativeDate(firstAvailable.dateString);
      }
    }
  }, [selectedDate, visible, orderableDates]);

  const handleSelect = (option: DeliveryDateOption) => {
    if (option.isLocked) {
      return;
    }
    setTentativeDate(option.dateString);
  };

  const handleConfirm = () => {
    if (tentativeDate) {
      onConfirm(tentativeDate);
    }
  };

  const selectedOption =
    orderableDates.find((d) => d.dateString === tentativeDate) ||
    deliveryDates.find((d) => d.dateString === tentativeDate) ||
    orderableDates[0];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (canDismiss && onClose) onClose();
      }}
    >
      <View style={styles.overlayContainer}>
        {/* Native Frosted Blur Background */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 45 : 85}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />

        {/* Semi-transparent Tint Overlay */}
        <TouchableWithoutFeedback onPress={() => canDismiss && onClose && onClose()}>
          <View style={[styles.backdropTint, { backgroundColor:theme.overlay}]} />
        </TouchableWithoutFeedback>

        {/* Centered Modal Card */}
        <View
          style={[
            styles.cardContainer,
            {
              width: Math.min(windowWidth - 32, 380),
              maxHeight: windowHeight - 48,
              backgroundColor:theme.surface,
              borderColor:theme.surfaceBorder,
            },
          ]}
        >
          {/* Optional Top Close Button */}
          {canDismiss && onClose && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.closeBtn, { backgroundColor:theme.surfaceHighlight}]}
            >
              <Ionicons name="close" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyScrollContent}
            showsVerticalScrollIndicator={false}
          >
          {/* 1. Header Banner / Brand Logo (themed, so no white box in dark mode) */}
          <View style={styles.headerBannerWrapper}>
            <BrandLogo variant="compact" />
          </View>

          {/* 2. Modal Title & Subtitle */}
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Which day are you ordering for?
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            This sets the default delivery day for everything you add to your basket. You can change it any time.
          </Text>

          {/* 3. 2-Column Responsive Grid of Available Dates (Up to 2 Weeks in Advance) */}
          <View style={styles.datesGrid}>
            {orderableDates.map((option) => {
              const isSelected = tentativeDate === option.dateString;
              const isLocked = option.isLocked;

              // Format date label as "Wed, 11 Nov"
              const dayPadded = String(option.dayNumber).padStart(2, '0');
              const formattedLabel = `${option.dayName}, ${dayPadded} ${option.monthName}`;

              return (
                <TouchableOpacity
                  key={option.dateString}
                  testID={`date-pill-${option.dateString}`}
                  activeOpacity={isLocked ? 1 : 0.8}
                  onPress={() => handleSelect(option)}
                  style={[
                    styles.datePill,
                    {
                      backgroundColor: isSelected
                        ? theme.primary
                        :theme.surfaceElevated,
                      borderColor: isSelected
                        ? theme.primary
                        :theme.surfaceBorderLight,
                    },
                    isLocked && styles.datePillLocked,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.datePillText,
                      {
                        color: isSelected
                          ? theme.onPrimary
                          : isLocked
                          ? theme.textMuted
                          : theme.textPrimary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {formattedLabel}
                  </Text>
                  {option.isHoliday && (
                    <Text style={styles.holidaySubText}>Holiday</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 4. Cutoff Notice for Tentative Day */}
          {selectedOption && (
            <View style={[styles.noticeWrapper, { backgroundColor:theme.surfaceHighlight}]}>
              <Ionicons
                name={selectedOption.isAvailable ? 'time-outline' : 'alert-circle'}
                size={14}
                color={selectedOption.isAvailable ? theme.textSecondary : theme.error}
              />
              <Text
                style={[
                  styles.noticeText,
                  { color: selectedOption.isAvailable ? theme.textSecondary : theme.error },
                ]}
                numberOfLines={2}
              >
                {selectedOption.isAvailable
                  ? `Cutoff: ${selectedOption.cutoffDeadlineFormatted}`
                  : selectedOption.isHoliday
                  ? `Closed for South African Public Holiday: ${selectedOption.holidayName}`
                  : 'Orders for this date have closed (9:00 AM cutoff, two business days before delivery, has passed).'}
              </Text>
            </View>
          )}
          </ScrollView>

          {/* 5. Primary Confirm Button */}
          <TouchableOpacity
            testID="confirm-date-button"
            activeOpacity={0.85}
            onPress={handleConfirm}
            disabled={!tentativeDate || selectedOption?.isLocked}
            style={[
              styles.confirmButton,
              {
                backgroundColor: !tentativeDate || selectedOption?.isLocked
                  ? theme.buttonDisabled
                  : theme.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.confirmButtonText,
                {
                  color: !tentativeDate || selectedOption?.isLocked
                    ? theme.textMuted
                    : theme.onPrimary,
                },
              ]}
            >
              Confirm
            </Text>
          </TouchableOpacity>

          {/* 6. Secondary actions: leave without picking a day, or go straight to Orders */}
          {(onSkip || onViewOrders) && (
            <View style={styles.secondaryRow}>
              {onSkip && (
                <TouchableOpacity
                  testID="skip-date-button"
                  activeOpacity={0.8}
                  onPress={onSkip}
                  style={[styles.secondaryButton, { borderColor: theme.surfaceBorderLight, backgroundColor: theme.surfaceElevated }]}
                >
                  <Text numberOfLines={1} style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>Skip</Text>
                </TouchableOpacity>
              )}
              {onViewOrders && (
                <TouchableOpacity
                  testID="view-orders-button"
                  activeOpacity={0.8}
                  onPress={onViewOrders}
                  style={[styles.secondaryButton, { borderColor: theme.surfaceBorderLight, backgroundColor: theme.surfaceElevated }]}
                >
                  <Text numberOfLines={1} style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>Orders</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backdropTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bodyScroll: {
    alignSelf: 'stretch',
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyScrollContent: {
    alignItems: 'center',
  },
  cardContainer: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 15,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerBannerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    // Clears the close button in the card's top-right corner.
    paddingHorizontal: 36,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  datesScroll: {
    width: '100%',
    alignSelf: 'stretch',
    maxHeight: 295,
    flexGrow: 0,
  },
  datesGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  datePill: {
    width: '48.5%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  datePillLocked: {
    opacity: 0.45,
  },
  datePillText: {
    fontSize: 12.5,
  },
  holidaySubText: {
    fontSize: 9,
    color: '#E53E3E',
    marginTop: 1,
    fontWeight: '600',
  },
  noticeWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '500',
    lineHeight: 15,
  },
  confirmButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  // Deliberately small: these are side exits, Confirm is the main action.
  secondaryButton: {
    height: 30,
    paddingHorizontal: 16,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

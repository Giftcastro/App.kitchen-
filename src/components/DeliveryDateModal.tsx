import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { DeliveryDateOption } from '../types';
import { generateWeekdayOptions } from '../utils/sastTime';

interface DeliveryDateModalProps {
  visible: boolean;
  deliveryDates: DeliveryDateOption[];
  selectedDate: string;
  onConfirm: (dateString: string) => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const DeliveryDateModal: React.FC<DeliveryDateModalProps> = ({
  visible,
  deliveryDates,
  selectedDate,
  onConfirm,
  onClose,
  canDismiss = true,
}) => {
  const { theme, isDark } = useTheme();

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
          <View style={[styles.backdropTint, { backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.35)' }]} />
        </TouchableWithoutFeedback>

        {/* Centered Modal Card */}
        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FDFBF7',
              borderColor: isDark ? '#2C2C2E' : '#E2E8F0',
            },
          ]}
        >
          {/* Optional Top Close Button */}
          {canDismiss && onClose && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#2C2C2E' : '#EDF2F7' }]}
            >
              <Ionicons name="close" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}

          {/* 1. Header Banner / CSG Logo */}
          <View style={styles.headerBannerWrapper}>
            <Image
              source={require('../../assets/docs/img.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
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
                        ? (isDark ? '#FFFFFF' : '#121212')
                        : isDark
                        ? '#262628'
                        : '#FFFFFF',
                      borderColor: isSelected
                        ? (isDark ? '#FFFFFF' : '#121212')
                        : isDark
                        ? '#3A3A3C'
                        : '#CBD5E1',
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
                          ? (isDark ? '#121212' : '#FFFFFF')
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
            <View style={[styles.noticeWrapper, { backgroundColor: isDark ? '#262628' : '#F1F5F9' }]}>
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
                  ? (isDark ? '#3A3A3C' : '#E2E8F0')
                  : (isDark ? '#FFFFFF' : '#121212'),
              },
            ]}
          >
            <Text
              style={[
                styles.confirmButtonText,
                {
                  color: !tentativeDate || selectedOption?.isLocked
                    ? theme.textMuted
                    : (isDark ? '#121212' : '#FFFFFF'),
                },
              ]}
            >
              Confirm
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

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
  cardContainer: {
    width: Math.min(width - 32, 380),
    maxHeight: height * 0.88,
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
  },
  headerLogo: {
    width: 170,
    height: 44,
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
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

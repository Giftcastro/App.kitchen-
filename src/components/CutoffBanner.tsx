import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeliveryDateOption } from '../types';
import { useTheme } from '../theme/ThemeContext';

interface CutoffBannerProps {
  selectedOption?: DeliveryDateOption;
  isCollapsed?: boolean;
}

export const CutoffBanner: React.FC<CutoffBannerProps> = ({ selectedOption, isCollapsed = false }) => {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(isCollapsed ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isCollapsed ? 0 : 1,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [isCollapsed]);

  if (!selectedOption) return null;

  const isHoliday = selectedOption.isHoliday;
  const isLocked = selectedOption.isLocked;

  const animatedStyle = {
    opacity: anim,
    maxHeight: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 115],
    }),
    marginVertical: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 6],
    }),
    overflow: 'hidden' as const,
  };

  const renderContent = () => {
    if (isHoliday) {
      return (
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.errorSurface,
              borderColor: theme.errorBorder,
            },
          ]}
        >
          <Ionicons name="alert-circle" size={18} color={theme.error} />
          <View style={styles.textWrapper}>
            <Text style={[styles.title, { color: theme.error }]}>
              Delivery Unavailable — {selectedOption.holidayName || 'Public Holiday'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Kitchen Co. central kitchens are closed on official South African statutory holidays.
            </Text>
          </View>
        </View>
      );
    }

    if (isLocked) {
      return (
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.surfaceHighlight,
              borderColor: theme.surfaceBorder,
            },
          ]}
        >
          <Ionicons name="lock-closed" size={18} color={theme.textMuted} />
          <View style={styles.textWrapper}>
            <Text style={[styles.title, { color: theme.textSecondary }]}>
              Ordering Closed for this Date
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              The ordering deadline (9:00 AM SAST, two business days before delivery) has passed for {selectedOption.dayName}, {selectedOption.dayNumber} {selectedOption.monthName}.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.goldWarningSurface,
            borderColor: theme.goldWarningBorder,
          },
        ]}
      >
        <View style={styles.iconBadge}>
          <Ionicons name="time" size={16} color={theme.goldWarning} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={[styles.title, { color: theme.goldWarning }]}>9:00 AM SAST Cutoff Notice</Text>
          <Text style={[styles.noticeText, { color: theme.textPrimary }]}>{selectedOption.noticeBannerText}</Text>
        </View>
      </View>
    );
  };

  return <Animated.View style={animatedStyle}>{renderContent()}</Animated.View>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 10,
    gap: 10,
  },
  iconBadge: {
    marginTop: 2,
  },
  textWrapper: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 15,
  },
});

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeliveryDateOption } from '../types';
import { useTheme } from '../theme/ThemeContext';

interface DateSelectorProps {
  deliveryDates: DeliveryDateOption[];
  selectedDate: string;
  onSelectDate: (dateString: string) => void;
  isCompact?: boolean;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  deliveryDates,
  selectedDate,
  onSelectDate,
  isCompact = false,
}) => {
  const { theme, isDark } = useTheme();
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  // Auto-scroll to selected index on mount or change
  useEffect(() => {
    const selectedIndex = deliveryDates.findIndex((d) => d.dateString === selectedDate);
    if (selectedIndex > 0 && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: Math.max(0, (selectedIndex - 1) * (isCompact ? 48 : 68)),
        animated: true,
      });
    }
  }, [selectedDate, deliveryDates, isCompact]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          borderBottomColor: theme.surfaceBorder,
        },
        isCompact && styles.containerCompact,
      ]}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isCompact && styles.scrollContentCompact]}
      >
        {deliveryDates.map((item) => {
          const isSelected = item.dateString === selectedDate;
          const isLocked = item.isLocked;
          const isHoliday = item.isHoliday;

          if (isCompact) {
            return (
              <TouchableOpacity
                key={item.dateString}
                activeOpacity={isLocked ? 0.9 : 0.7}
                disabled={isLocked}
                onPress={() => onSelectDate(item.dateString)}
                style={[
                  styles.chipCompact,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.surfaceBorder,
                  },
                  isSelected && {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                  },
                  isLocked && {
                    backgroundColor: theme.surfaceHighlight,
                    opacity: 0.4,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayNumberCompact,
                    { color: theme.textPrimary },
                    isSelected && { color: theme.onPrimary, fontWeight: '900' },
                    isLocked && { color: theme.textMuted },
                  ]}
                >
                  {item.dayNumber}
                </Text>
                <Text
                  style={[
                    styles.dayInitialCompact,
                    { color: theme.textSecondary },
                    isSelected && { color: theme.onPrimary, opacity: 0.9, fontWeight: '700' },
                    isLocked && { color: theme.textMuted },
                  ]}
                >
                  {item.dayName[0]}
                </Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={item.dateString}
              activeOpacity={isLocked ? 0.9 : 0.7}
              disabled={isLocked}
              onPress={() => onSelectDate(item.dateString)}
              style={[
                styles.chip,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.surfaceBorder,
                },
                isSelected && {
                  backgroundColor: theme.primary,
                  borderColor: theme.primary,
                },
                isLocked && {
                  backgroundColor: theme.surfaceHighlight,
                  borderColor: theme.surfaceBorder,
                  opacity: 0.45,
                },
              ]}
            >
              {/* Day Name */}
              <Text
                style={[
                  styles.dayName,
                  { color: theme.textSecondary },
                  isSelected && { color: theme.onPrimary, opacity: 0.9, fontWeight: '800' },
                  isLocked && { color: theme.textMuted },
                ]}
              >
                {item.dayName.toUpperCase()}
              </Text>

              {/* Date Number */}
              <Text
                style={[
                  styles.dayNumber,
                  { color: theme.textPrimary },
                  isSelected && { color: theme.onPrimary, fontWeight: '900' },
                  isLocked && { color: theme.textMuted },
                ]}
              >
                {item.dayNumber}
              </Text>

              {/* Month */}
              <Text
                style={[
                  styles.monthName,
                  { color: theme.textMuted },
                  isSelected && { color: theme.onPrimary, opacity: 0.8 },
                ]}
              >
                {item.monthName}
              </Text>

              {/* Minimal Status Indicator */}
              {isHoliday ? (
                <View style={[styles.statusDot, { backgroundColor: theme.error }]} />
              ) : isLocked ? (
                <Ionicons name="lock-closed" size={8} color={theme.textMuted} style={styles.lockIcon} />
              ) : isSelected ? (
                <View style={[styles.selectedIndicator, { backgroundColor: theme.onPrimary }]} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  containerCompact: {
    paddingVertical: 3,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 6,
    alignItems: 'center',
  },
  scrollContentCompact: {
    paddingHorizontal: 12,
    gap: 5,
    alignItems: 'center',
  },
  chip: {
    width: 60,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  chipCompact: {
    width: 42,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  dayNumberCompact: {
    fontSize: 14,
    fontWeight: '800',
  },
  dayInitialCompact: {
    fontSize: 10,
    fontWeight: '600',
  },
  dayName: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 1,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 22,
  },
  monthName: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginTop: 1,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 3,
  },
  lockIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  selectedIndicator: {
    width: 14,
    height: 2,
    borderRadius: 1,
    position: 'absolute',
    bottom: 3,
  },
});

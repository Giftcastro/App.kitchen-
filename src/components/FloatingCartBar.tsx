import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

interface FloatingCartBarProps {
  itemCount: number;
  formattedTotal?: string;
  formattedTotalZar?: string;
  deliveryDateFormatted?: string;
  deliveryDateLabel?: string;
  onPress?: () => void;
  onReviewPress?: () => void;
}

export const FloatingCartBar: React.FC<FloatingCartBarProps> = ({
  itemCount,
  formattedTotal,
  formattedTotalZar,
  deliveryDateFormatted,
  deliveryDateLabel,
  onPress,
  onReviewPress,
}) => {
  const { theme, isDark } = useTheme();

  if (itemCount <= 0) return null;

  const total = formattedTotal || formattedTotalZar || 'R 0.00';
  const dateText = deliveryDateFormatted || deliveryDateLabel;
  const handleAction = onPress || onReviewPress || (() => {});

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleAction}
        style={[
          styles.innerBar,
          {
            backgroundColor:theme.primary,
            borderColor: theme.primaryGlow,
            shadowColor: isDark ? '#000000' : '#09090B',
          },
        ]}
      >
        {/* Left Side: Badge + Count + Total */}
        <View style={styles.leftContent}>
          <View style={[styles.countBadge, { backgroundColor:theme.surface}]}>
            <Text style={[styles.countText, { color:theme.textPrimary}]}>{itemCount}</Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[styles.totalPrice, { color:theme.onPrimary}]}>{total}</Text>
            {dateText ? (
              <Text style={[styles.dateLabel, { color: theme.onPrimary, opacity: 0.65 }]} numberOfLines={1}>
                {dateText}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Right Side: Action CTA */}
        <View style={styles.rightContent}>
          <Text style={[styles.actionText, { color:theme.onPrimary}]}>Review Order</Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color={theme.onPrimary}
            style={styles.arrowIcon}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 84 : 76, // Sits comfortably above bottom nav
    left: 16,
    right: 16,
    zIndex: 99,
  },
  innerBar: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
  },
  leftContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  countText: {
    fontSize: 13,
    fontWeight: '900',
  },
  priceContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  totalPrice: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  arrowIcon: {
    marginLeft: 2,
  },
});

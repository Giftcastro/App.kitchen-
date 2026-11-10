import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

interface RatingBarProps {
  rating: number;
  onRatingChange?: (newRating: number) => void;
  readOnly?: boolean;
  size?: number;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Fair',
  3: 'Good Quality',
  4: 'Great Meal',
  5: 'Exceptional!',
};

export const RatingBar: React.FC<RatingBarProps> = ({
  rating,
  onRatingChange,
  readOnly = false,
  size = 28,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= rating;

          return (
            <TouchableOpacity
              key={star}
              disabled={readOnly}
              activeOpacity={0.7}
              onPress={() => onRatingChange && onRatingChange(star)}
              style={styles.starButton}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Ionicons
                name={isFilled ? 'star' : 'star-outline'}
                size={size}
                color={isFilled ? theme.goldWarning : theme.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {rating > 0 && (
        <Text style={[styles.ratingLabel, { color: theme.goldWarning }]}>
          {RATING_LABELS[rating] || ''}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starButton: {
    padding: 2,
  },
  ratingLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

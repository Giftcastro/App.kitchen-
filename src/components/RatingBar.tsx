/**
 * Five-star rating control.
 *
 * Ported from JoTsav/kicthenCoV1 `main` (src/components/RatingBar.tsx) — same
 * star sizes, gaps, hitSlop and the same 1-5 caption wording. Two adaptations:
 * the theme comes from `useKitchen()` rather than his `useTheme()`, and the
 * filled-star colour reads `theme.warning` (our palette has no `goldWarning`
 * token). Star colour is one of the semantic pops of colour the black-and-white
 * palette deliberately keeps — see src/utils/theme.ts.
 */
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './AppText';
import { useKitchen } from '../context/KitchenCoContext';

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
  const { theme } = useKitchen();

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
              accessibilityRole="button"
              accessibilityLabel={`Rate ${star} star${star === 1 ? '' : 's'}`}
              accessibilityState={{ selected: isFilled, disabled: readOnly }}
            >
              <Ionicons
                name={isFilled ? 'star' : 'star-outline'}
                size={size}
                color={isFilled ? theme.warning : theme.textTertiary}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {rating > 0 && (
        <Text style={[styles.ratingLabel, { color: theme.warning }]}>
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

export default RatingBar;

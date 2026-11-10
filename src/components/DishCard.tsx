import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuItem } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme';

interface DishCardProps {
  item: MenuItem;
  onAddPress: (item: MenuItem) => void;
  disabled?: boolean;
}

export const DishCard: React.FC<DishCardProps> = ({
  item,
  onAddPress,
  disabled = false,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.surfaceBorder,
        },
        disabled && styles.cardDisabled,
      ]}
    >
      {/* Left Column: Title, Ingredients & Tags */}
      <View style={styles.leftColumn}>
        <Text style={[styles.title, { color: theme.textPrimary, fontFamily: typography.heading }]}>{item.name}</Text>
        {Boolean(item.description && item.description.trim()) && (
          <Text style={[styles.description, { color: theme.textSecondary, fontFamily: typography.body }]}>{item.description}</Text>
        )}

        {Boolean(item.ingredients && item.ingredients.trim()) && (
          <Text style={[styles.ingredientsLabel, { color: theme.textMuted, fontFamily: typography.body }]}>
            <Text style={[styles.ingredientsPrefix, { color: theme.textSecondary, fontFamily: typography.bodyBold }]}>Ingredients: </Text>
            {item.ingredients}
          </Text>
        )}

        {/* Dietary Tag Badges */}
        {item.dietaryTags && item.dietaryTags.length > 0 && (
          <View style={styles.tagsRow}>
            {item.dietaryTags.map((tag) => (
              <View
                key={tag}
                style={[
                  styles.tagBadge,
                  {
                    backgroundColor: theme.tagBackground,
                    borderColor: theme.tagBorder,
                  },
                ]}
              >
                <Text style={[styles.tagText, { color: theme.tagText }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Right Column: Price & Add Button */}
      <View style={styles.rightColumn}>
        <Text style={[styles.price, { color: theme.primary }]}>
          R {item.price.toFixed(2)}
        </Text>
        {item.prices?.large && (
          <Text style={[styles.largeSubPrice, { color: theme.textSecondary }]}>
            Large R {item.prices.large.toFixed(2)}
          </Text>
        )}

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          onPress={() => onAddPress(item)}
          style={[
            styles.addButton,
            { backgroundColor: theme.primary },
            disabled && { backgroundColor: theme.buttonDisabled, shadowOpacity: 0 },
          ]}
        >
          <Ionicons
            name="add"
            size={22}
            color={disabled ? theme.buttonDisabledText : theme.textInverse}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 8,
  },
  ingredientsLabel: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginBottom: 8,
  },
  ingredientsPrefix: {
    fontWeight: '600',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 78,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  largeSubPrice: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 8,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
});

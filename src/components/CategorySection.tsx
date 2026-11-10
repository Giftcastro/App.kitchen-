import React from 'react';
import { View, Text, ImageBackground, StyleSheet } from 'react-native';
import { MenuCategory, MenuItem } from '../types';
import { DishCard } from './DishCard';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme';

interface CategorySectionProps {
  category: MenuCategory;
  items?: MenuItem[];
  dishes?: MenuItem[];
  onAddItem?: (item: MenuItem) => void;
  onAddToCart?: (item: MenuItem) => void;
  disabled?: boolean;
  isOrderable?: boolean;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  items,
  dishes,
  onAddItem,
  onAddToCart,
  disabled = false,
  isOrderable,
}) => {
  const { theme } = useTheme();

  const mealList = dishes || items || [];
  const handleAdd = onAddToCart || onAddItem || (() => {});
  const isDisabled = isOrderable !== undefined ? !isOrderable : disabled;

  if (!mealList || mealList.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Category Hero Banner */}
      <View style={styles.bannerContainer}>
        <ImageBackground
          source={{ uri: category.heroImage }}
          style={styles.bannerImage}
          imageStyle={styles.bannerImageStyle}
        >
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerTitle} numberOfLines={2}>
              {category.name}
            </Text>
          </View>
        </ImageBackground>
      </View>

      {/* Item List */}
      <View style={styles.itemsList}>
        {mealList.map((dish) => (
          <DishCard
            key={dish.id}
            item={dish}
            onAddPress={handleAdd}
            disabled={isDisabled}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  bannerContainer: {
    height: 120,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  bannerImageStyle: {
    borderRadius: 16,
  },
  bannerOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 22,
    fontFamily: typography.bodyBold,
    color: '#FFFFFF',
    lineHeight: 28,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  itemsList: {
    gap: 4,
  },
});

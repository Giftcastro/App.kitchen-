import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { MenuCategory } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme';

interface CategorySliderProps {
  categories: MenuCategory[];
  selectedCategoryId: string; // 'all' or category.id
  onSelectCategory: (categoryId: string) => void;
}

export const CategorySlider: React.FC<CategorySliderProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View style={[styles.container, { borderBottomColor: theme.surfaceBorder }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* "All" Tab */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => onSelectCategory('all')}
          style={[
            styles.tabItem,
            selectedCategoryId === 'all' && styles.tabItemActive,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.tabText,
              { color: theme.textSecondary, fontFamily: typography.bodyBold },
              selectedCategoryId === 'all' && { color: theme.textPrimary },
            ]}
          >
            All
          </Text>
          {selectedCategoryId === 'all' && (
            <View
              style={[
                styles.activeIndicatorBar,
                { backgroundColor: isDark ? '#F7F2E8' : '#121212' },
              ]}
            />
          )}
        </TouchableOpacity>

        {/* Category Tabs */}
        {categories.map((category) => {
          const isActive = selectedCategoryId === category.id;
          return (
            <TouchableOpacity
              key={category.id}
              activeOpacity={0.75}
              onPress={() => onSelectCategory(category.id)}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.tabText,
                  { color: theme.textSecondary, fontFamily: typography.bodyBold },
                  isActive && { color: theme.textPrimary },
                ]}
              >
                {category.name}
              </Text>
              {isActive && (
                <View
                  style={[
                    styles.activeIndicatorBar,
                    { backgroundColor: isDark ? '#F7F2E8' : '#121212' },
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingVertical: 2,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'center',
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {},
  tabText: {
    fontSize: 13.5,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  tabTextActive: {},
  activeIndicatorBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    borderRadius: 1.5,
  },
});

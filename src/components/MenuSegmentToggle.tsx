import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MenuType } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme';

interface MenuSegmentToggleProps {
  activeMenuType: MenuType;
  onMenuTypeChange: (menuType: MenuType) => void;
}

export const MenuSegmentToggle: React.FC<MenuSegmentToggleProps> = ({
  activeMenuType,
  onMenuTypeChange,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.surfaceBorder,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onMenuTypeChange('standard')}
        style={[
          styles.button,
          activeMenuType === 'standard' && [
            styles.buttonActive,
            {
              backgroundColor: isDark ? '#242426' : '#121212',
              borderColor: isDark ? '#3C3C42' : '#000000',
            },
          ],
        ]}
      >
        <Text
          style={[
            styles.text,
            { color: theme.textSecondary, fontFamily: typography.bodyBold },
            activeMenuType === 'standard' && [
              styles.textActive,
              { color: isDark ? '#F7F2E8' : '#FFFFFF' },
            ],
          ]}
        >
          Standard Classics
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onMenuTypeChange('chefs_choice')}
        style={[
          styles.button,
          activeMenuType === 'chefs_choice' && [
            styles.buttonActive,
            {
              backgroundColor: isDark ? '#242426' : '#121212',
              borderColor: isDark ? '#3C3C42' : '#000000',
            },
          ],
        ]}
      >
        <View style={styles.chefButtonContent}>
          <Text
            style={[
              styles.text,
              { color: theme.textSecondary, fontFamily: typography.bodyBold },
              activeMenuType === 'chefs_choice' && [
                styles.textActive,
                { color: isDark ? '#F7F2E8' : '#FFFFFF' },
              ],
            ]}
          >
            Chef's Choice
          </Text>
          <View
            style={[
              styles.cycleBadge,
              {
                backgroundColor: activeMenuType === 'chefs_choice' ? (isDark ? '#333336' : '#2A2A2E') : theme.surfaceHighlight,
                borderColor: theme.surfaceBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.cycleBadgeText,
                {
                  color: activeMenuType === 'chefs_choice' ? '#FFFFFF' : theme.textPrimary,
                  fontFamily: typography.bodyBold,
                },
              ]}
            >
              Week Cycle
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  buttonActive: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  chefButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
  textActive: {
    fontWeight: '700',
  },
  cycleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  cycleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

export type TabScreen = 'home' | 'orders' | 'profile';

interface BottomNavBarProps {
  currentTab: TabScreen;
  onTabChange: (tab: TabScreen) => void;
  cartItemCount?: number;
  unreadMessageCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentTab,
  onTabChange,
  cartItemCount = 0,
  unreadMessageCount = 0,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View style={styles.outerWrapper}>
      <View
        style={[
          styles.glassContainer,
          {
            backgroundColor: theme.glassBackground,
            borderColor: theme.glassBorder,
            shadowColor: isDark ? '#000000' : '#09090B',
          },
        ]}
      >
        {/* 1. Home Tab (Home Icon) */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => onTabChange('home')}
          style={[
            styles.tabButton,
            currentTab === 'home' && [
              styles.tabButtonActive,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' },
            ],
          ]}
        >
          <Ionicons
            name={currentTab === 'home' ? 'home' : 'home-outline'}
            size={18}
            color={currentTab === 'home' ? theme.textPrimary : theme.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: currentTab === 'home' ? theme.textPrimary : theme.textMuted },
              currentTab === 'home' && styles.tabLabelActive,
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        {/* 2. Orders Tab (Sheet/Document Icon matching dev-gift) */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => onTabChange('orders')}
          style={[
            styles.tabButton,
            currentTab === 'orders' && [
              styles.tabButtonActive,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' },
            ],
          ]}
        >
          <View style={styles.iconWithDot}>
            <Ionicons
              name={currentTab === 'orders' ? 'document-text' : 'document-text-outline'}
              size={18}
              color={currentTab === 'orders' ? theme.textPrimary : theme.textMuted}
            />
            {cartItemCount > 0 ? (
              <View style={[styles.cartBadge, { backgroundColor: theme.primary }]}>
                <Text style={[styles.cartBadgeText, { color: theme.textInverse }]}>{cartItemCount}</Text>
              </View>
            ) : (
              <View style={[styles.liveDot, { backgroundColor: theme.textPrimary }]} />
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              { color: currentTab === 'orders' ? theme.textPrimary : theme.textMuted },
              currentTab === 'orders' && styles.tabLabelActive,
            ]}
          >
            Orders
          </Text>
        </TouchableOpacity>

        {/* 3. Profile Tab */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => onTabChange('profile')}
          style={[
            styles.tabButton,
            currentTab === 'profile' && [
              styles.tabButtonActive,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' },
            ],
          ]}
        >
          <View style={styles.iconWithDot}>
            <Ionicons
              name={currentTab === 'profile' ? 'person' : 'person-outline'}
              size={18}
              color={currentTab === 'profile' ? theme.textPrimary : theme.textMuted}
            />
            {unreadMessageCount > 0 ? (
              <View style={[styles.cartBadge, { backgroundColor: theme.error }]}>
                <Text style={[styles.cartBadgeText, { color: '#FFFFFF' }]}>{unreadMessageCount}</Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[
              styles.tabLabel,
              { color: currentTab === 'profile' ? theme.textPrimary : theme.textMuted },
              currentTab === 'profile' && styles.tabLabelActive,
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  glassContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 36,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
    maxWidth: 420,
    width: '100%',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 24,
  },
  tabButtonActive: {},
  iconWithDot: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
});

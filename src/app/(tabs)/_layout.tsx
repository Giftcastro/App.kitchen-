/**
 * AppShell.xaml — the customer TabBar: Menu, Orders (Active / History),
 * Profile. Settings and Help have no tab; they're pushed from Profile.
 * Selected tab tint is BrandPop, one of its three reserved spots.
 */
import React from 'react';
import { ColorValue, Image } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../state/AppState';

const ICONS = {
  home: require('../../../assets/images/icons/home.png'),
  orders: require('../../../assets/images/icons/orders.png'),
  user: require('../../../assets/images/icons/user.png'),
};

export default function TabsLayout() {
  const { colors, isDark } = useApp();
  const insets = useSafeAreaInsets();
  const icon = (name: keyof typeof ICONS) =>
    function TabIcon({ color }: { color: ColorValue }) {
      return <Image source={ICONS[name]} style={{ width: 24, height: 24, tintColor: color }} />;
    };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brandPop,
        tabBarInactiveTintColor: isDark ? '#6B6B6B' : '#9E9E9E',
        tabBarStyle: {
          backgroundColor: colors.cardBg,
          borderTopColor: colors.surfaceBorder,
          height: 72 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: 'OpenSans_400Regular', fontSize: 12, lineHeight: 16 },
        headerStyle: { backgroundColor: colors.pageBg },
        headerTitleStyle: { fontFamily: 'OpenSans_600SemiBold', fontSize: 18, color: colors.text },
        headerTintColor: colors.text,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Menu', headerShown: false, tabBarIcon: icon('home') }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', headerShown: false, tabBarIcon: icon('orders') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', headerTitle: 'My Profile', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}

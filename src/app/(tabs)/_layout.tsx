/**
 * AppShell.xaml — the customer TabBar: Menu, Orders, Profile, each with its
 * own page stack (detail pages push inside the tab, the bar stays). Tab bar
 * colours are the theme's TabBarBg / TabBarText / TabBarUnselected.
 *
 * AppShell.OnNavigated pops every *other* tab back to its root when the tab
 * changes, so tapping a tab never resurrects a stale product / basket /
 * settings page — popToTopOnBlur does the same here.
 */
import React, { useEffect } from 'react';
import { AppState as RNAppState, ColorValue, Image } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../state/AppState';
import { refreshUnreadMessages, useUnreadMessages } from '../../state/unreadMessages';

const ICONS = {
  home: require('../../../assets/images/icons/home.png'),
  orders: require('../../../assets/images/icons/orders.png'),
  user: require('../../../assets/images/icons/user.png'),
};

export default function TabsLayout() {
  const { colors, user } = useApp();
  const insets = useSafeAreaInsets();
  const unread = useUnreadMessages();

  // New admin messages show as a badge on Profile: checked on sign-in and whenever the app comes back to the foreground.
  const userId = user?.id;
  useEffect(() => {
    refreshUnreadMessages(userId);
    const sub = RNAppState.addEventListener('change', state => {
      if (state === 'active') refreshUnreadMessages(userId);
    });
    return () => sub.remove();
  }, [userId]);
  const icon = (name: keyof typeof ICONS) =>
    function TabIcon({ color }: { color: ColorValue }) {
      return <Image source={ICONS[name]} style={{ width: 24, height: 24, tintColor: color }} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        popToTopOnBlur: true,
        tabBarActiveTintColor: colors.tabBarText,
        tabBarInactiveTintColor: colors.tabBarUnselected,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBg,
          height: 72 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: 'OpenSans_400Regular', fontSize: 12, lineHeight: 16 },
      }}
    >
      <Tabs.Screen name="(menu)" options={{ title: 'Menu', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: icon('orders') }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: icon('user'),
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,        }}
      />
    </Tabs>
  );
}

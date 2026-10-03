/**
 * AdminShell.xaml — flyout disabled; every section is its own page with the
 * admin nav strip at its top, and the title bar shows the page's Title.
 */
import React from 'react';
import { Stack } from 'expo-router';
import { useApp } from '../../state/AppState';

export default function AdminLayout() {
  const { colors } = useApp();
  return (
    <Stack
      screenOptions={{
        animation: 'none',
        headerBackVisible: false,
        headerStyle: { backgroundColor: colors.pageBg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: 'OpenSans_600SemiBold', fontSize: 18, color: colors.text },
        contentStyle: { backgroundColor: colors.pageBg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Kitchen Operations Hub' }} />
      <Stack.Screen name="active-orders" options={{ title: 'Active Orders' }} />
      <Stack.Screen name="companies" options={{ title: 'Companies & Locations' }} />
      <Stack.Screen name="discounts" options={{ title: 'Discount Codes' }} />
      <Stack.Screen name="notifications" options={{ title: 'Broadcast Notifications' }} />
      <Stack.Screen name="menu" options={{ title: 'Menu Catalog' }} />
      <Stack.Screen name="users" options={{ title: 'User Management' }} />
      <Stack.Screen name="reports" options={{ title: 'Reports & Analytics' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}

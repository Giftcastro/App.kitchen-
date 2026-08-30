import React from 'react';
import { Slot, Redirect, useSegments } from 'expo-router';
import { View, StyleSheet, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KitchenProvider, useKitchen } from '../context/KitchenCoContext';
import { useResponsive } from '../utils/responsive';

// This app only ever schedules LOCAL notifications (order reminders / payment
// confirmations) — never remote push. Expo Go on SDK 53+ logs a console.error
// heads-up about remote push being unsupported there regardless, which
// React Native's dev LogBox otherwise surfaces as a blocking overlay.
LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

// 1. This component manages state-aware routing redirects. Declarative
// <Redirect> (rendered as part of the tree) rather than an imperative
// router.replace() in a useEffect — the latter can fire before the root
// navigator has finished mounting and throws.
function RootLayoutNavigation() {
  const { user, theme } = useKitchen();
  const segments = useSegments();

  // Determine if the user is currently looking at the login page
  const inAuthGroup = segments[0] === 'login';

  // Render the active route/page template inside a responsive centered frame.
  // Phones stay at mobile width; tablets widen the frame (TABLET_MAX_WIDTH)
  // so multi-column layouts have room.
  const { contentMaxWidth } = useResponsive();
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.frame, { maxWidth: contentMaxWidth }]}>
        {/* <Redirect> renders alongside <Slot>, never instead of it — Slot is
            what keeps the file-based route tree (including the (tabs) group)
            mounted and registered; swapping it out for Redirect would tear
            down the very navigator the redirect target lives in. */}
        {!user && !inAuthGroup && <Redirect href="/login" />}
        {user && inAuthGroup && (
          // Logged in but still sitting on the login page — send them to
          // their home screen. Admins go straight to Kitchen Controls since
          // the customer Menu tab isn't part of their account.
          <Redirect href={user.role === 'admin' ? '/admin' : '/'} />
        )}
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    root: { flex: 1, alignItems: 'center' },
  frame: { flex: 1, width: '100%', position: 'relative' },
});

// 2. The main export wraps the entire app contextually
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <KitchenProvider>
        <RootLayoutNavigation />
      </KitchenProvider>
    </SafeAreaProvider>
  );
}
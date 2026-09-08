import React, { useEffect } from 'react';
import { Slot, Redirect, useSegments } from 'expo-router';
import { View, StyleSheet, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Montserrat_300Light,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  Montserrat_900Black,
} from '@expo-google-fonts/montserrat';
import {
  RobotoCondensed_400Regular,
  RobotoCondensed_500Medium,
  RobotoCondensed_700Bold,
} from '@expo-google-fonts/roboto-condensed';
import { KitchenProvider, useKitchen } from '../context/KitchenCoContext';
import { useResponsive } from '../utils/responsive';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
  const { user, orderingForDate, theme } = useKitchen();
  const segments = useSegments();

  // Determine if the user is currently looking at the login page
  const inAuthGroup = segments[0] === 'login';
  const inDatePicker = segments[0] === 'select-date';

  // A customer must choose the day they're ordering for before the menu will
  // show them anything (client review, Sep 2026) — the menu no longer carries
  // a date row of its own, so this is the only place that choice gets made.
  // Admins are exempt: they reach the customer Menu tab via "Preview App" to
  // check their own menu edits, not to order, and shouldn't be stopped by a
  // delivery-day prompt on the way in.
  const needsDeliveryDay =
    !!user && user.role !== 'admin' && !orderingForDate && !inAuthGroup && !inDatePicker;

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
        {needsDeliveryDay && <Redirect href="/select-date" />}
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

// 2. The main export wraps the entire app contextually.
// Brand typeface (2026-09-05): loads Montserrat here; every screen actually
// switches to it via src/components/AppText.tsx (a Text/TextInput wrapper
// every file now imports instead of importing those two from 'react-native'
// directly) — a global Text.defaultProps patch was tried first but doesn't
// reach react-native-web's rendered output on this RN/React version, hence
// the wrapper. Each screen's own fontWeight (300-900) still applies on top.
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Montserrat_300Light,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    Montserrat_900Black,
    // Menu/Activity/Profile-only typeface (see legacyTypography.ts) — the
    // rest of the app stays on Montserrat above.
    RobotoCondensed_400Regular,
    RobotoCondensed_500Medium,
    RobotoCondensed_700Bold,
    GotchaGothic: require('../../assets/fonts/Gotcha Gothic Regular.ttf'),
    'GotchaGothic-Light': require('../../assets/fonts/Gotcha Gothic Light.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // Keep the splash screen up (native) / render nothing (web) until
  // Montserrat is actually available — otherwise the very first frame
  // flashes the system font before swapping, every single launch.
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <KitchenProvider>
        <RootLayoutNavigation />
      </KitchenProvider>
    </SafeAreaProvider>
  );
}
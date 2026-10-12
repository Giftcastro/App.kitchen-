/**
 * Root — what MAUI's App.xaml.cs + MauiProgram set up: Open Sans, the
 * singleton services (AppStateProvider), the branded popup host, and the
 * page stack.
 *
 * Routing mirrors the MAUI flow: signed out -> LoginPage; an Admin signs in
 * to AdminShell (/admin) — or, after "Customer View", into the customer
 * tabs (AdminCustomerSwitch); everyone else picks a delivery day
 * (SelectDeliveryDayPage) before reaching AppShell's tabs.
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  OpenSans_300Light,
  OpenSans_300Light_Italic,
  OpenSans_400Regular,
  OpenSans_400Regular_Italic,
  OpenSans_500Medium,
  OpenSans_600SemiBold,
  OpenSans_700Bold,
  OpenSans_700Bold_Italic,
  OpenSans_800ExtraBold,
} from '@expo-google-fonts/open-sans';
import { PlayfairDisplay_400Regular, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { AppStateProvider, useApp } from '../state/AppState';
import { AlertHost } from '../components/Alerts';
import { useResponsive } from '../utils/responsive';
import { native } from '../utils/theme';
import { stackHeader } from '../utils/stackHeader';

SplashScreen.preventAutoHideAsync().catch(() => {});

const PUBLIC_ROUTES = ['login', 'register'];

function RootNavigator() {
  const { user, authLoading, selectedOrderingDate, colors, isAdminPreview, isDark } = useApp();

  // Web: tell the browser the page's scheme so its scrollbars and form controls aren't bright white in dark mode.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark]);
  const segments = useSegments();
  const { contentMaxWidth } = useResponsive();
  const top = segments[0] ?? '';
  const isAdmin = user?.role === 'Admin';

  let redirect: string | null = null;
  if (!authLoading) {
    if (!user) {
      if (!PUBLIC_ROUTES.includes(top)) redirect = '/login';
    } else if (isAdmin && !isAdminPreview) {
      if (top !== 'admin') redirect = '/admin';
    } else if (top === 'admin') {
      redirect = '/';
    } else if (!selectedOrderingDate && top !== 'select-date') {
      redirect = '/select-date';
    } else if (PUBLIC_ROUTES.includes(top)) {
      redirect = '/';
    }
  }


  return (
    <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
      {/* Android paints the status bar in colorPrimaryDark (#2B0B98), as the MAUI app does; iOS keeps the page's own colours. */}
      <StatusBar
        barStyle={Platform.OS === 'android' ? 'light-content' : colors.statusBarStyle}
        backgroundColor={native.androidPrimary}
      />
      <View style={[styles.frame, { maxWidth: contentMaxWidth }]}>
        {redirect && <Redirect href={redirect as never} />}
        {authLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <Stack screenOptions={stackHeader(colors)}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ title: '' }} />
            <Stack.Screen name="select-date" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack>
        )}
      </View>
      <AlertHost />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    OpenSans_300Light,
    OpenSans_300Light_Italic,
    OpenSans_400Regular,
    OpenSans_400Regular_Italic,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    OpenSans_700Bold_Italic,
    OpenSans_800ExtraBold,
    // The brand wordmark (components/BrandLogo).
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <RootNavigator />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  frame: { flex: 1, width: '100%' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

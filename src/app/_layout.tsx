/**
 * Root — what MAUI's App.xaml.cs + MauiProgram set up: Open Sans, the
 * singleton services (AppStateProvider), the branded popup host, and the
 * page stack.
 *
 * Routing mirrors the MAUI flow: signed out -> LoginPage; an Admin signs in
 * to AdminShell (/admin); everyone else picks a delivery day
 * (SelectDeliveryDayPage) before reaching AppShell's tabs.
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, LogBox, StatusBar, StyleSheet, View } from 'react-native';
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
import { AppStateProvider, useApp } from '../state/AppState';
import { AlertHost } from '../components/Alerts';
import { useResponsive } from '../utils/responsive';

SplashScreen.preventAutoHideAsync().catch(() => {});
LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

const PUBLIC_ROUTES = ['login', 'register'];

function RootNavigator() {
  const { user, authLoading, selectedOrderingDate, colors } = useApp();
  const segments = useSegments();
  const { contentMaxWidth } = useResponsive();
  const top = segments[0] ?? '';
  const isAdmin = user?.role === 'Admin';

  let redirect: string | null = null;
  if (!authLoading) {
    if (!user) {
      if (!PUBLIC_ROUTES.includes(top)) redirect = '/login';
    } else if (isAdmin) {
      if (top !== 'admin') redirect = '/admin';
    } else if (top === 'admin') {
      redirect = '/';
    } else if (!selectedOrderingDate && top !== 'select-date') {
      redirect = '/select-date';
    } else if (PUBLIC_ROUTES.includes(top)) {
      redirect = '/';
    }
  }

  const header = {
    headerStyle: { backgroundColor: colors.pageBg },
    headerTintColor: colors.text,
    headerTitleStyle: { fontFamily: 'OpenSans_600SemiBold', fontSize: 18, color: colors.text },
    headerBackTitle: '',
    contentStyle: { backgroundColor: colors.pageBg },
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.pageBg} />
      <View style={[styles.frame, { maxWidth: contentMaxWidth }]}>
        {redirect && <Redirect href={redirect as never} />}
        {authLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <Stack screenOptions={header}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ title: '' }} />
            <Stack.Screen name="select-date" options={{ title: 'Delivery Day' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="product" options={{ title: "" }} />
            <Stack.Screen name="cart" options={{ title: 'Your Basket' }} />
            <Stack.Screen name="payment" options={{ title: 'Payment' }} />
            <Stack.Screen name="order-confirmation" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="tax-invoice" options={{ title: 'Tax Invoice' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="help" options={{ title: 'Help & Support' }} />
            <Stack.Screen name="cancellation-policy" options={{ title: 'Cancellation Policy' }} />
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

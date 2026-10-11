/**
 * The Menu tab's own stack (MAUI Shell pushes detail pages inside the active
 * tab, with the tab bar still showing): dashboard, product, basket,
 * payment, confirmation, invoice.
 */
import React from 'react';
import { Stack } from 'expo-router';
import { useApp } from '../../../state/AppState';
import { stackHeader } from '../../../utils/stackHeader';

export default function MenuStackLayout() {
  const { colors } = useApp();
  return (
    <Stack screenOptions={stackHeader(colors)}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="product" options={{ title: '' }} />
      <Stack.Screen name="cart" options={{ title: 'Your Basket' }} />
      <Stack.Screen name="payment" options={{ title: 'Payment' }} />
      <Stack.Screen name="order-confirmation" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="tax-invoice" options={{ title: 'Invoice' }} />
    </Stack>
  );
}

/** The Orders tab's own stack: ActiveOrdersPage (titled "Orders") and the invoice it opens. */
import React from 'react';
import { Stack } from 'expo-router';
import { useApp } from '../../../state/AppState';
import { stackHeader } from '../../../utils/stackHeader';

export default function OrdersStackLayout() {
  const { colors } = useApp();
  return (
    <Stack screenOptions={stackHeader(colors)}>
      <Stack.Screen name="index" options={{ title: 'Orders' }} />
      <Stack.Screen name="tax-invoice" options={{ title: 'Invoice' }} />
    </Stack>
  );
}

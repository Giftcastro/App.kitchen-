/** The Profile tab's own stack: My Profile, then Settings / Help & Support / Cancellation Policy pushed from it. */
import React from 'react';
import { Stack } from 'expo-router';
import { useApp } from '../../../state/AppState';
import { stackHeader } from '../../../utils/stackHeader';

export default function ProfileStackLayout() {
  const { colors } = useApp();
  return (
    <Stack screenOptions={stackHeader(colors)}>
      <Stack.Screen name="index" options={{ title: 'My Profile' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="help" options={{ title: 'Help & Support' }} />
      <Stack.Screen name="cancellation-policy" options={{ title: 'Cancellation Policy' }} />
    </Stack>
  );
}

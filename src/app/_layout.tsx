import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { KitchenProvider, useKitchen } from '../context/KitchenCoContext';

// 1. This component manages state-aware routing redirects
function RootLayoutNavigation() {
  const { user } = useKitchen();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Determine if the user is currently looking at the login page
    const inAuthGroup = segments[0] === 'login';

    // If the user is NOT logged in and not on the login page, redirect them to login
    if (!user && !inAuthGroup) {
      router.replace('/login');
    } 
    // If the user IS logged in but still sitting on the login page, push them to the home Menu
    else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, segments, router]);

  // Render the active route/page template
  return <Slot />;
}

// 2. The main export wraps the entire app contextually
export default function RootLayout() {
  return (
    <KitchenProvider>
      <RootLayoutNavigation />
    </KitchenProvider>
  );
}
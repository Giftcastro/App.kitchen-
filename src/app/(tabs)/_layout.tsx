import React, { useEffect, useRef } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKitchen } from '../../context/KitchenCoContext';
import { Animated, TouchableOpacity, Text, View, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlyToCartOverlay, FlyToCartOverlayHandle } from '../../components/FlyToCartOverlay';

export default function TabsLayout() {
  const { user, cart, theme, cartPulseSignal, registerCartFlyHandler } = useKitchen();
  const router = useRouter();
  // Android gesture/back-button nav bar sits below the tab bar's fixed
  // content height — without adding this inset, tab icons/labels render
  // partially behind that system UI on devices with gesture navigation.
  const insets = useSafeAreaInsets();
  // Admins manage the kitchen, they don't place personal orders — so the
  // customer ordering surface (Menu/cart, past-order Activity, order Tracker)
  // isn't part of their account. Only Admin + Profile apply to them.
  const isAdmin = user?.role === 'admin';

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Header cart badge pulses whenever something is added anywhere in the
  // app (see KitchenCoContext.addToCart), and the fly-to-cart animation
  // (triggered from the Menu screen's customizer) lands on this icon's own
  // measured position — this is the one screen that actually knows where it is.
  const cartIconRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const flyOverlayRef = useRef<FlyToCartOverlayHandle>(null);
  const badgeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (cartPulseSignal === 0) return;
    Animated.sequence([
      Animated.spring(badgeScale, { toValue: 1.35, friction: 3, tension: 200, useNativeDriver: true }),
      Animated.spring(badgeScale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
    ]).start();
  }, [cartPulseSignal, badgeScale]);

  useEffect(() => {
    registerCartFlyHandler((fromX, fromY) => {
      cartIconRef.current?.measureInWindow((toX, toY, width, height) => {
        flyOverlayRef.current?.trigger(fromX, fromY, toX + width / 2, toY + height / 2);
      });
    });
    return () => registerCartFlyHandler(null);
  }, [registerCartFlyHandler]);

  return (
    <>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
      <FlyToCartOverlay ref={flyOverlayRef} theme={theme} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textTertiary,
          tabBarStyle: {
            backgroundColor: theme.tabBar,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            height: 72 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 8,
          },
          headerStyle: {
            backgroundColor: theme.headerBg,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          },
          headerTitleStyle: {
            fontWeight: '900',
            fontSize: 20,
            color: theme.text,
          },
          headerTintColor: theme.text,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Menu',
            href: isAdmin ? null : undefined,
            headerTitle: () => (
              <View style={styles.headerTitleContainer}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Kitchen Co.</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>powered by CSG Group</Text>
              </View>
            ),
            headerRight: () => (
              <View style={styles.headerRightContainer}>
                <TouchableOpacity
                  ref={cartIconRef}
                  style={styles.cartButton}
                  onPress={() => router.push('/cart')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  testID="cart-button"
                  accessibilityRole="button"
                  accessibilityLabel={totalItems > 0 ? `Cart, ${totalItems} item${totalItems === 1 ? '' : 's'}` : 'Cart, empty'}
                >
                  <View style={[styles.cartIconContainer, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                    <Ionicons name="cart" size={26} color={theme.text} />
                    {totalItems > 0 && (
                      <Animated.View style={[styles.cartBadge, { backgroundColor: theme.accent, borderColor: theme.background, transform: [{ scale: badgeScale }] }]}>
                        <Text style={[styles.cartBadgeText, { color: theme.onAccent }]}>{totalItems}</Text>
                      </Animated.View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            ),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="fast-food" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: 'Activity',
            headerTitle: 'Past Orders',
            href: user && !isAdmin ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tracker"
          options={{
            title: 'Orders',
            headerTitle: 'Order Status',
            href: user && !isAdmin ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="receipt" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: user ? 'Profile' : 'Sign In',
            headerTitle: user ? 'My Profile' : 'Welcome',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={user ? "person" : "log-in"} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Admin',
            // admin.tsx renders its own shell header (with the Preview App
            // action) — the native header would just duplicate the title.
            headerShown: false,
            href: user?.role === 'admin' ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="options" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  cartButton: {
    position: 'relative',
  },
  cartIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#000000',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
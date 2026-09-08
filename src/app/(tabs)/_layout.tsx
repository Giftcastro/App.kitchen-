import React, { useEffect, useRef, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKitchen } from '../../context/KitchenCoContext';
import { Animated, TouchableOpacity, View, StyleSheet, StatusBar } from 'react-native';
import { Text } from '../../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlyToCartOverlay, FlyToCartOverlayHandle } from '../../components/FlyToCartOverlay';
import { BrandLogo } from '../../components/BrandLogo';

export default function TabsLayout() {
  const { user, cart, theme, isDark, cartPulseSignal, registerCartFlyHandler } = useKitchen();
  const router = useRouter();
  // Menu/Orders/Profile now sit on a warm cream backdrop instead of stark
  // white (see legacyTypography.ts) — this shared native header would
  // otherwise read as a jarring white seam above it. Admin hides this header
  // entirely (headerShown: false) and renders its own, so this only ever
  // touches the three screens that already carry the warm background.
  const headerBackground = isDark ? theme.headerBg : '#F7F2E8';
  // Android gesture/back-button nav bar sits below the tab bar's fixed
  // content height — without adding this inset, tab icons/labels render
  // partially behind that system UI on devices with gesture navigation.
  const insets = useSafeAreaInsets();
  // Admins manage the kitchen, they don't place personal orders — so the
  // customer ordering surface (Menu/cart, Orders — active tracking + past
  // history combined) isn't part of their account. Only Admin + Profile
  // apply to them.
  const isAdmin = user?.role === 'admin';

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Header cart badge pulses whenever something is added anywhere in the
  // app (see KitchenCoContext.addToCart), and the fly-to-cart animation
  // (triggered from the Menu screen's customizer) lands on this icon's own
  // measured position — this is the one screen that actually knows where it is.
  const cartIconRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const flyOverlayRef = useRef<FlyToCartOverlayHandle>(null);
  // Lazy useState, not useRef(new Animated.Value(x)).current: that form
  // built a throwaway Animated.Value on every render and read a ref during
  // render. useState guarantees the instance is created once and kept.
  const [badgeScale] = useState(() => new Animated.Value(1));

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
          // react-navigation's bottom-tabs/header render their own internal
          // Text, not one of ours — AppText's wrapper can't reach them, so
          // the family has to be set directly on these style options instead.
          tabBarLabelStyle: { fontFamily: 'Montserrat_500Medium', fontSize: 11 },
          tabBarStyle: {
            backgroundColor: theme.tabBar,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            height: 72 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 8,
          },
          headerStyle: {
            backgroundColor: headerBackground,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          },
          headerTitleStyle: {
            // Only ever visible on Orders/Profile (Menu supplies its own
            // custom headerTitle; Admin hides this header) — both already
            // carry the GotchaGothic/cream look, so this matches instead of
            // sitting out as a leftover Montserrat title above it.
            fontFamily: 'GotchaGothic',
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
            // Centred, not the platform-default left alignment: the logo
            // reads as a brand mark rather than a page title. Scoped to this
            // screen — Orders/Profile keep left-aligned plain page titles.
            headerTitleAlign: 'center',
            // The official logo artwork (JoTsav/kicthenCoV1 main renders the
            // header the same way: <BrandLogo variant="compact" /> centred,
            // cart icon on the right). The rule under the wordmark that used
            // to be drawn in JSX here is part of the image now.
            headerTitle: () => <BrandLogo variant="compact" />,
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
                  <View style={[styles.cartIconContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="cart-outline" size={22} color={theme.text} />
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
          name="orders"
          options={{
            title: 'Orders',
            // orders.tsx renders its own "Order History & Invoices" header bar
            // (ported from JoTsav/kicthenCoV1 main's OrderHistoryScreen, which
            // has no navigator above it) — the native header would sit on top
            // of it as a second title. Same arrangement the Admin tab uses.
            headerShown: false,
            href: user && !isAdmin ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="receipt" size={size} color={color} />
            ),
          }}
        />
        {/* Admin sits before Profile so an admin's two-tab bar reads
            Admin | Profile — the kitchen controls they actually work in come
            first. Customers are unaffected: `admin` is href:null for them, so
            their bar stays Menu | Orders | Profile. */}
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
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
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
    borderWidth: 1,
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
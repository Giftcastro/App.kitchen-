import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  RobotoCondensed_400Regular,
  RobotoCondensed_500Medium,
  RobotoCondensed_700Bold,
} from '@expo-google-fonts/roboto-condensed';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { installGlobalErrorReporting } from './src/services/errorReporting';
import { installWebAlert } from './src/utils/webAlert';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider, useCart } from './src/context/CartContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { MenuBrowserScreen } from './src/screens/MenuBrowserScreen';
import { CheckoutScreen } from './src/screens/CheckoutScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { OrdersScreen } from './src/screens/OrdersScreen';
import { AdminPortalScreen } from './src/screens/AdminPortalScreen';
import { BottomNavBar, TabScreen } from './src/components/BottomNavBar';
import { Ionicons } from '@expo/vector-icons';
import {
  getAppEndpointPath,
  parseAppViewFromPath,
  syncBrowserHistoryPath,
} from './src/utils/authSecurity';

type ActiveView = 'home' | 'checkout' | 'orders' | 'profile' | 'admin';

/**
 * @author jotshava@icloud.com
 * @constructor
 */

const MainNavigator: React.FC = () => {
  const { theme, isDark } = useTheme();
  const { currentUser, isLoading, isPasswordRecoveryMode, pendingOAuthUser } = useAuth();
  const { cartItems, unreadBroadcastCount, corporateAccounts } = useCart();
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'chef';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return parseAppViewFromPath(window.location.pathname, isStaff);
    }
    return isStaff ? 'admin' : 'home';
  });
  const [isAdminPreview, setIsAdminPreview] = useState<boolean>(false);
  const [isAdminPreviewCollapsed, setIsAdminPreviewCollapsed] = useState<boolean>(false);

  // Set initial view according to role and URL route guard
  useEffect(() => {
    if (currentUser && !isPasswordRecoveryMode && !pendingOAuthUser) {
      const isStaff = currentUser.role === 'admin' || currentUser.role === 'chef';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        setActiveView(parseAppViewFromPath(window.location.pathname, isStaff));
        return;
      }
      setActiveView(isStaff ? 'admin' : 'home');
    }
  }, [currentUser?.id, currentUser?.role, isPasswordRecoveryMode, pendingOAuthUser]);

  // Synchronize authenticated activeView with distinct browser URL endpoints (/home, /checkout, /orders, /profile, /admin)
  useEffect(() => {
    if (!currentUser || isPasswordRecoveryMode || pendingOAuthUser) return;
    const isStaff = currentUser.role === 'admin' || currentUser.role === 'chef';
    const guardedView: ActiveView = activeView === 'admin' && !isStaff ? 'home' : activeView;
    syncBrowserHistoryPath(getAppEndpointPath(guardedView));
  }, [activeView, currentUser, isPasswordRecoveryMode, pendingOAuthUser]);

  // Listen to browser Back / Forward buttons when authenticated on Web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!currentUser || isPasswordRecoveryMode || pendingOAuthUser) return;

    const handlePopState = () => {
      const isStaff = currentUser.role === 'admin' || currentUser.role === 'chef';
      const parsedView = parseAppViewFromPath(window.location.pathname, isStaff);
      setActiveView(parsedView);
      syncBrowserHistoryPath(getAppEndpointPath(parsedView), true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, isPasswordRecoveryMode, pendingOAuthUser]);

  const [fontsLoaded] = useFonts({
    GotchaGothic: require('./assets/fonts/Gotcha Gothic Regular.ttf'),
    'GotchaGothic-Light': require('./assets/fonts/Gotcha Gothic Light.ttf'),
    'GotchaGothic-StampBasic': require('./assets/fonts/Gotcha Gothic Stamp Basic.ttf'),
    RobotoCondensed_400Regular,
    RobotoCondensed_500Medium,
    RobotoCondensed_700Bold,
  });

  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading || !fontsLoaded) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Screen 1: Route Guard -> AuthScreen when unauthenticated, in password recovery, or completing OAuth profile
  if (!currentUser || isPasswordRecoveryMode || Boolean(pendingOAuthUser)) {
    return <AuthScreen />;
  }

  // Active tab mapping for customer 3-tab liquid glass bottom bar
  const currentBottomTab: TabScreen =
    activeView === 'orders'
      ? 'orders'
      : activeView === 'profile'
      ? 'profile'
      : 'home';

  const simulatedCompanyName =
    currentUser.companyName ||
    corporateAccounts.find((c) => c.id === currentUser.companyId)?.companyName ||
    corporateAccounts[0]?.companyName ||
    'Customer';

  return (
    <View style={[styles.appContainer, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Retractable Floating Admin Preview Widget */}
      {isAdminPreview && activeView !== 'admin' && (
        isAdminPreviewCollapsed ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setIsAdminPreviewCollapsed(false)}
            style={[
              styles.adminPreviewBall,
              { backgroundColor: theme.primary, borderColor: theme.brandGold },
            ]}
          >
            <Text style={{ fontSize: 18 }}>⚙️</Text>
            <View style={[styles.adminPreviewBallDot, { backgroundColor: theme.brandGold }]} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.adminPreviewBanner, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveView('profile')}
              style={styles.adminPreviewTextGroup}
            >
              <Text style={{ fontSize: 14 }}>👤</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.adminPreviewTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  Admin Preview • {simulatedCompanyName}
                </Text>
                <Text style={[styles.adminPreviewSub, { color: theme.textSecondary }]} numberOfLines={1}>
                  Tap to simulate another company in Profile
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.adminPreviewActionRow}>
              <TouchableOpacity
                onPress={() => {
                  setIsAdminPreview(false);
                  setActiveView('admin');
                }}
                activeOpacity={0.8}
                style={[styles.adminPreviewBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.adminPreviewBtnText, { color: theme.textInverse }]}>Back to Admin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsAdminPreviewCollapsed(true)}
                activeOpacity={0.7}
                style={[styles.adminPreviewRetractBtn, { backgroundColor: theme.chipBg }]}
              >
                <Ionicons name="chevron-forward" size={13} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )
      )}

      <View style={styles.screenContainer}>
        {/* Screen 2: Menu Browser (Home) */}
        {activeView === 'home' && (
          <MenuBrowserScreen
            onNavigateToCheckout={() => setActiveView('checkout')}
          />
        )}

        {/* Screen 3: Cart, Order Review & PayFast Checkout */}
        {activeView === 'checkout' && (
          <CheckoutScreen
            onNavigateToMenu={() => setActiveView('home')}
            onNavigateToProfile={() => setActiveView('profile')}
            onNavigateToTracker={() => setActiveView('orders')}
          />
        )}

        {/* Screen 4: Unified Orders (Active Orders & Order History) */}
        {activeView === 'orders' && (
          <OrdersScreen
            onNavigateToMenu={() => setActiveView('home')}
          />
        )}

        {/* Screen 5: User Profile & Workplace Settings */}
        {activeView === 'profile' && (
          <ProfileScreen
            onNavigateToOrders={() => setActiveView('orders')}
            onNavigateToAdmin={() => setActiveView('admin')}
          />
        )}

        {/* Screen 6: Central Command Admin Portal (Top Navigation Strip) */}
        {activeView === 'admin' && (
          <AdminPortalScreen
            onEnterCustomerView={() => {
              setIsAdminPreview(true);
              setActiveView('home');
            }}
          />
        )}
      </View>

      {/* Liquid Glass Bottom Navigation Bar (Hidden in Admin Mode) */}
      {activeView !== 'admin' && (
        <BottomNavBar
          currentTab={currentBottomTab}
          onTabChange={(tab) => setActiveView(tab)}
          cartItemCount={totalCartCount}
          unreadMessageCount={unreadBroadcastCount}
        />
      )}
    </View>
  );
};

installGlobalErrorReporting();
installWebAlert();

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <MainNavigator />
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminPreviewBall: {
    position: 'absolute',
    top: 50,
    right: 14,
    zIndex: 9999,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  adminPreviewBallDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  adminPreviewBanner: {
    position: 'absolute',
    top: 48,
    left: 14,
    right: 14,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 9,
  },
  adminPreviewTextGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminPreviewTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  adminPreviewSub: {
    fontSize: 10,
  },
  adminPreviewActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  adminPreviewBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  adminPreviewBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  adminPreviewRetractBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

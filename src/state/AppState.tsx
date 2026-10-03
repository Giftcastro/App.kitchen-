/**
 * App-wide state — what MAUI registers as singletons in MauiProgram:
 * SessionService (signed-in user, chosen delivery day, cutoff notice),
 * CartService (the basket), plus the persisted Settings preferences.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem, Company, CompanyLocation, UserAccount } from '../models';
import { lineTotal } from '../models';
import { getThemeColors, ThemeColors } from '../utils/theme';
import * as auth from '../services/auth';

const NOTIFICATIONS_PREF_KEY = 'settings.notifications_enabled';
const DARK_MODE_PREF_KEY = 'settings.dark_mode_enabled';
/** Set when "Remember me" was ticked at login — the only case a saved session is resumed on launch. */
const REMEMBER_ME_KEY = 'session.remember_me';

interface AppStateValue {
  // Session
  user: UserAccount | null;
  authLoading: boolean;
  signIn: (email: string, password: string, rememberMe: boolean) => Promise<UserAccount>;
  register: (fullName: string, email: string, password: string, company: Company, location: CompanyLocation) => Promise<UserAccount>;
  signOut: () => Promise<void>;
  setUser: (user: UserAccount) => void;
  /** The delivery day picked after login (or changed later) — ISO yyyy-mm-dd. */
  selectedOrderingDate: string | null;
  setSelectedOrderingDate: (iso: string) => void;
  hasSeenCutoffNotice: boolean;
  markCutoffNoticeSeen: () => void;

  // Cart
  cartItems: CartItem[];
  addCartItem: (item: CartItem) => void;
  removeCartItem: (key: string) => void;
  setCartQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;

  // Settings
  colors: ThemeColors;
  isDark: boolean;
  setDarkMode: (dark: boolean) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [user, setUserState] = useState<UserAccount | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedOrderingDate, setSelectedOrderingDate] = useState<string | null>(null);
  const [hasSeenCutoffNotice, setHasSeenCutoffNotice] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [darkPref, setDarkPref] = useState<boolean | null>(null);
  const [notificationsEnabled, setNotificationsState] = useState(true);

  useEffect(() => {
    // MAUI always opens on the Login page; a saved session is only resumed
    // when the person ticked "Remember me" the last time they signed in.
    (async () => {
      try {
        const remember = await AsyncStorage.getItem(REMEMBER_ME_KEY).catch(() => null);
        if (remember === 'true') {
          setUserState(await auth.restoreSession());
        } else {
          await auth.signOut().catch(() => {});
        }
      } finally {
        setAuthLoading(false);
      }
    })();
    (async () => {
      try {
        const [dark, notifications] = await Promise.all([
          AsyncStorage.getItem(DARK_MODE_PREF_KEY),
          AsyncStorage.getItem(NOTIFICATIONS_PREF_KEY),
        ]);
        if (dark !== null) setDarkPref(dark === 'true');
        if (notifications !== null) setNotificationsState(notifications === 'true');
      } catch {
        // Storage unavailable (private window) — keep defaults.
      }
    })();
  }, []);

  /** A fresh login session re-asks for the delivery day and re-shows the cutoff reminder. */
  const startSession = (signedIn: UserAccount) => {
    setUserState(signedIn);
    setHasSeenCutoffNotice(false);
    setSelectedOrderingDate(null);
  };

  const signIn = async (email: string, password: string, rememberMe: boolean) => {
    const signedIn = await auth.signIn(email, password);
    AsyncStorage.setItem(REMEMBER_ME_KEY, String(rememberMe)).catch(() => {});
    startSession(signedIn);
    return signedIn;
  };

  const register = async (fullName: string, email: string, password: string, company: Company, location: CompanyLocation) => {
    const created = await auth.register(fullName, email, password, company, location);
    startSession(created);
    return created;
  };

  const signOut = async () => {
    await auth.signOut();
    AsyncStorage.removeItem(REMEMBER_ME_KEY).catch(() => {});
    setUserState(null);
    setSelectedOrderingDate(null);
    setCartItems([]);
  };

  const addCartItem = useCallback((item: CartItem) => setCartItems(items => [...items, item]), []);
  const removeCartItem = useCallback((key: string) => setCartItems(items => items.filter(i => i.key !== key)), []);
  const setCartQuantity = useCallback(
    (key: string, quantity: number) => setCartItems(items => items.map(i => (i.key === key ? { ...i, quantity } : i))),
    []
  );
  const clearCart = useCallback(() => setCartItems([]), []);

  const isDark = darkPref ?? systemScheme === 'dark';
  const colors = useMemo(() => getThemeColors(isDark ? 'dark' : 'light'), [isDark]);

  const setDarkMode = (dark: boolean) => {
    setDarkPref(dark);
    AsyncStorage.setItem(DARK_MODE_PREF_KEY, String(dark)).catch(() => {});
  };
  const setNotificationsEnabled = (enabled: boolean) => {
    setNotificationsState(enabled);
    AsyncStorage.setItem(NOTIFICATIONS_PREF_KEY, String(enabled)).catch(() => {});
  };

  const value: AppStateValue = {
    user,
    authLoading,
    signIn,
    register,
    signOut,
    setUser: setUserState,
    selectedOrderingDate,
    setSelectedOrderingDate,
    hasSeenCutoffNotice,
    markCutoffNoticeSeen: () => setHasSeenCutoffNotice(true),
    cartItems,
    addCartItem,
    removeCartItem,
    setCartQuantity,
    clearCart,
    cartCount: cartItems.reduce((sum, i) => sum + i.quantity, 0),
    cartTotal: cartItems.reduce((sum, i) => sum + lineTotal(i), 0),
    colors,
    isDark,
    setDarkMode,
    notificationsEnabled,
    setNotificationsEnabled,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useApp(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useApp must be used inside AppStateProvider');
  return ctx;
}

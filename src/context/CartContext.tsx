import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CartItem,
  MenuItem,
  MenuCategory,
  OrderHistoryItem,
  OrderStatus,
  CycleWeekConfig,
  CycleWeekPlan,
  CorporateAccount,
  AggregatedPrepItem,
  BatchSiteGroup,
  MenuAddOn,
  CycleDayPlan,
  BroadcastNotification,
} from '../types';
import {
  getDeliveryFeeForDistance,
  EIGHT_WEEK_CYCLE_DATA,
} from '../data/mockData';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import {
  fetchCategoriesFromDb,
  fetchMenuItemsFromDb,
  fetchCycleRotationsFromDb,
  fetchAllCycleDayPlansFromDb,
  fetchUserOrdersFromDb,
  fetchAllOrdersFromDb,
  fetchCorporateAccountsFromDb,
  updateOrderStatusInDb,
  updateBatchOrderStatusesInDb,
  submitOrderRatingInDb,
  reportOrderDisputeInDb,
  adminAddMenuItemToDb,
  adminUpdateMenuItemInDb,
  adminArchiveMenuItemInDb,
  adminAddCategoryToDb,
  adminUpdateCategoryInDb,
  updateCycleDayPlanInDb,
  updateCycleRotationInDb,
  setActiveCycleWeekInDb,
  fetchBroadcastMessagesFromDb,
  adminAddCompanyToDb,
  adminUpdateCompanyInDb,
  adminAddDomainToCompanyInDb,
} from '../services/supabaseDataService';

const ORDER_HISTORY_STORAGE_KEY = '@kitchen_co_order_history_v3';
const MENU_ITEMS_STORAGE_KEY = '@kitchen_co_menu_items_v3';
const CATEGORIES_STORAGE_KEY = '@kitchen_co_categories_v3';
const CYCLE_STORAGE_KEY = '@kitchen_co_cycles_v3';
const CYCLE_PLANS_STORAGE_KEY = '@kitchen_co_cycle_plans_v3';
const CORPORATE_STORAGE_KEY = '@kitchen_co_corporate_accounts_v3';
const READ_BROADCASTS_STORAGE_KEY = '@kitchen_co_read_broadcasts_v3';

interface CartContextType {
  cartItems: CartItem[];
  orderHistory: OrderHistoryItem[];
  menuItems: MenuItem[];
  categories: MenuCategory[];
  cycleWeeks: CycleWeekConfig[];
  cyclePlans: CycleWeekPlan[];
  corporateAccounts: CorporateAccount[];
  activeCycleWeekNumber: number;
  isAdvanceCycleLocked: boolean;
  latestPlacedOrder: OrderHistoryItem | null;
  activeTrackerOrder: OrderHistoryItem | null;
  activeDateCartItems: (deliveryDate: string) => CartItem[];
  addItem: (
    menuItem: MenuItem,
    quantity: number,
    allergyNotes?: string,
    deliveryDate?: string,
    size?: 'standard' | 'large',
    selectedAddOns?: MenuAddOn[]
  ) => void;
  updateQuantity: (itemId: string, newQuantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCartForDate: (deliveryDate: string) => void;
  clearAllCart: () => void;
  isCartModalOpen: boolean;
  openCartModal: () => void;
  closeCartModal: () => void;
  getActiveDateTotals: (deliveryDate: string) => {
    itemCount: number;
    subtotalZar: number;
    discountType: 'percentage' | 'fixed_zar';
    discountValue: number;
    discountPercentage: number;
    discountZar: number;
    discountedSubtotalZar: number;
    deliveryFee: number;
    vatAmount: number;
    totalZar: number;
    formattedTotalZar: string;
    formattedSubtotalZar: string;
    formattedDiscountZar: string;
    formattedDiscountLabel: string;
    formattedVatZar: string;
  };
  getCartTotals: () => {
    itemCount: number;
    deliveryDates: string[];
    subtotalZar: number;
    discountZar: number;
    deliveryFee: number;
    totalZar: number;
  };
  completePaidCheckout: () => Promise<OrderHistoryItem | null>;
  submitOrderRating: (orderId: string, rating: number, feedback?: string) => Promise<void>;
  reportOrderNonDelivery: (orderId: string, reason?: string) => Promise<void>;
  advanceTrackerStage: (orderId: string, stage: 1 | 2 | 3 | 4) => Promise<void>;
  clearLatestOrder: () => void;

  // --- Admin Portal & Dispatch Actions ---
  getAggregatedPrepSheet: (targetDate: string) => AggregatedPrepItem[];
  getBatchSiteGroups: (targetDate: string) => BatchSiteGroup[];
  updateBatchStatus: (siteLocation: string, newStatus: OrderStatus) => Promise<void>;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => Promise<MenuItem>;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => Promise<void>;
  archiveMenuItem: (id: string) => Promise<void>;
  addCategory: (cat: Omit<MenuCategory, 'id'>) => Promise<MenuCategory>;
  updateCategory: (id: string, updates: Partial<MenuCategory>) => Promise<void>;
  setActiveCycleWeek: (weekNumber: number) => Promise<void>;
  toggleAdvanceCycleLock: () => Promise<void>;
  addCorporateAccount: (
    name: string,
    domain: string,
    locations: string[],
    distanceKm?: number,
    discountType?: 'percentage' | 'fixed_zar',
    discountValue?: number,
    billingEmail?: string,
    deliveryFeeMode?: 'free' | 'flat' | 'distance',
    flatFeeAmount?: number
  ) => Promise<CorporateAccount>;
  updateCorporateAccountDistance: (accountId: string, distanceKm: number) => Promise<void>;
  updateCorporateAccountDiscount: (
    accountId: string,
    discountType: 'percentage' | 'fixed_zar',
    discountValue: number
  ) => Promise<void>;
  updateCorporateAccountDetails: (
    accountId: string,
    updates: Partial<CorporateAccount>
  ) => Promise<void>;
  addDomainToAccount: (accountId: string, domain: string) => Promise<void>;
  updateCycleDayPlan: (weekNumber: number, dayName: string, updates: Partial<CycleDayPlan>) => Promise<void>;
  updateCycleRotation: (weekNumber: number, updates: { title?: string; description?: string }) => Promise<void>;
  broadcastMessages: BroadcastNotification[];
  unreadBroadcastCount: number;
  markBroadcastsAsRead: () => Promise<void>;
  refreshBroadcasts: () => Promise<void>;
  ensureCorporateAccountsLoaded: (force?: boolean) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [cycleWeeks, setCycleWeeks] = useState<CycleWeekConfig[]>([]);
  const [cyclePlans, setCyclePlans] = useState<CycleWeekPlan[]>(EIGHT_WEEK_CYCLE_DATA);
  const [corporateAccounts, setCorporateAccounts] = useState<CorporateAccount[]>([]);
  const [activeCycleWeekNumber, setActiveCycleWeekNumber] = useState<number>(1);
  const [isAdvanceCycleLocked, setIsAdvanceCycleLocked] = useState<boolean>(false);
  const [latestPlacedOrder, setLatestPlacedOrder] = useState<OrderHistoryItem | null>(null);
  const [isCartModalOpen, setIsCartModalOpen] = useState<boolean>(false);
  const [broadcastMessages, setBroadcastMessages] = useState<BroadcastNotification[]>([]);
  const [unreadBroadcastCount, setUnreadBroadcastCount] = useState<number>(0);

  const ensureCorporateAccountsLoaded = async (force = false) => {
    if ((corporateAccounts.length > 0 && !force) || !isSupabaseConfigured()) return;
    try {
      const dbCorps = await fetchCorporateAccountsFromDb();
      if (dbCorps.length > 0) {
        setCorporateAccounts(dbCorps);
        await AsyncStorage.setItem(CORPORATE_STORAGE_KEY, JSON.stringify(dbCorps));
      }
    } catch (e) {
      console.warn('Error loading corporate accounts:', e);
    }
  };

  // Restore stored session & menu states on mount, then hydrate strictly from live Supabase tables ONCE authenticated
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        // Fast parallel read from local cache so UI paints immediately
        const [storedMenu, storedCats, storedCorporate, storedCyclePlans] = await Promise.all([
          AsyncStorage.getItem(MENU_ITEMS_STORAGE_KEY),
          AsyncStorage.getItem(CATEGORIES_STORAGE_KEY),
          AsyncStorage.getItem(CORPORATE_STORAGE_KEY),
          AsyncStorage.getItem(CYCLE_PLANS_STORAGE_KEY),
        ]);

        if (storedMenu) {
          const parsed = JSON.parse(storedMenu);
          if (Array.isArray(parsed) && parsed.length > 0) setMenuItems(parsed);
        }
        if (storedCats) {
          const parsed = JSON.parse(storedCats);
          if (Array.isArray(parsed) && parsed.length > 0) setCategories(parsed);
        }
        if (storedCorporate) {
          const parsed = JSON.parse(storedCorporate);
          if (Array.isArray(parsed) && parsed.length > 0) setCorporateAccounts(parsed);
        }
        if (storedCyclePlans) {
          const parsed = JSON.parse(storedCyclePlans);
          if (Array.isArray(parsed) && parsed.length > 0) setCyclePlans(parsed);
        }

        // Security & Performance: Do NOT fire unauthenticated DB queries on the Sign-In screen
        if (!currentUser?.id) {
          setOrderHistory([]);
          return;
        }

        // Live Supabase Hydration (Single Parallel Wave — Real-Time DB Overrides Local Cache)
        if (isSupabaseConfigured()) {
          const ordersPromise =
            currentUser.role === 'admin' || currentUser.role === 'chef'
              ? fetchAllOrdersFromDb()
              : fetchUserOrdersFromDb(currentUser.id);

          const [dbCats, dbItems, dbCycles, dbCyclePlans, dbCorps, dbOrders] = await Promise.all([
            fetchCategoriesFromDb(),
            fetchMenuItemsFromDb(),
            fetchCycleRotationsFromDb(),
            fetchAllCycleDayPlansFromDb(),
            fetchCorporateAccountsFromDb(),
            ordersPromise,
            refreshBroadcasts(),
          ]);

          if (dbCats.length > 0) {
            setCategories(dbCats);
            AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(dbCats)).catch(() => {});
          }
          if (dbItems.length > 0) {
            setMenuItems(dbItems);
            AsyncStorage.setItem(MENU_ITEMS_STORAGE_KEY, JSON.stringify(dbItems)).catch(() => {});
          }
          if (dbCycles.length > 0) {
            setCycleWeeks(dbCycles);
            const activeNow = dbCycles.find((c) => c.status === 'active_now');
            if (activeNow) setActiveCycleWeekNumber(activeNow.weekNumber);
          }
          if (dbCyclePlans.length > 0) {
            setCyclePlans(dbCyclePlans);
            AsyncStorage.setItem(CYCLE_PLANS_STORAGE_KEY, JSON.stringify(dbCyclePlans)).catch(() => {});
          }
          if (dbCorps.length > 0) {
            setCorporateAccounts(dbCorps);
            AsyncStorage.setItem(CORPORATE_STORAGE_KEY, JSON.stringify(dbCorps)).catch(() => {});
          }

          setOrderHistory(dbOrders);
          AsyncStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(dbOrders)).catch(() => {});
        }
      } catch (e) {
        console.warn('Error loading persisted / live cart data:', e);
      }
    };
    loadPersistedData();
  }, [currentUser?.id, currentUser?.role, currentUser?.companyName]);

  const refreshBroadcasts = async () => {
    try {
      const allMsgs = await fetchBroadcastMessagesFromDb();
      const relevant = allMsgs.filter((msg) => {
        if (currentUser?.role === 'admin' || currentUser?.role === 'chef') return true;
        const aud = String(msg.targetAudience || 'all');
        if (!aud || aud === 'all' || aud === 'All Customers' || aud === 'All Companies') return true;
        if (currentUser?.companyName && aud.toLowerCase().includes(currentUser.companyName.toLowerCase())) return true;
        if (currentUser?.email && aud.toLowerCase().includes(currentUser.email.toLowerCase())) return true;
        if (currentUser?.fullName && aud.toLowerCase().includes(currentUser.fullName.toLowerCase())) return true;
        if (aud.startsWith('Active')) return true;
        return false;
      });
      setBroadcastMessages(relevant);

      const readRaw = await AsyncStorage.getItem(READ_BROADCASTS_STORAGE_KEY);
      const readIds: string[] = readRaw ? JSON.parse(readRaw) : [];
      const unread = relevant.filter((m) => !readIds.includes(m.id)).length;
      setUnreadBroadcastCount(unread);
    } catch (e) {
      console.warn('Error refreshing broadcasts:', e);
    }
  };

  const markBroadcastsAsRead = async () => {
    try {
      const allIds = broadcastMessages.map((m) => m.id);
      await AsyncStorage.setItem(READ_BROADCASTS_STORAGE_KEY, JSON.stringify(allIds));
      setUnreadBroadcastCount(0);
    } catch (e) {
      console.warn('Error marking broadcasts as read:', e);
    }
  };

  // Real-Time Supabase Multiplexed WebSocket Subscription (ONLY active after user signs in)
  useEffect(() => {
    if (!isSupabaseConfigured() || !currentUser?.id) return;

    const liveSyncChannel = supabase
      .channel(`realtime:kitchenco_sync_${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        async () => {
          const freshItems = await fetchMenuItemsFromDb();
          if (freshItems.length > 0) setMenuItems(freshItems);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_categories' },
        async () => {
          const freshCats = await fetchCategoriesFromDb();
          if (freshCats.length > 0) setCategories(freshCats);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cycle_rotations' },
        async () => {
          const freshCycles = await fetchCycleRotationsFromDb();
          if (freshCycles.length > 0) {
            setCycleWeeks(freshCycles);
            const activeNow = freshCycles.find((c) => c.status === 'active_now');
            if (activeNow) setActiveCycleWeekNumber(activeNow.weekNumber);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cycle_day_plans' },
        async () => {
          const freshPlans = await fetchAllCycleDayPlansFromDb();
          if (freshPlans.length > 0) {
            setCyclePlans(freshPlans);
            AsyncStorage.setItem(CYCLE_PLANS_STORAGE_KEY, JSON.stringify(freshPlans)).catch(() => {});
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async () => {
          const dbOrders =
            currentUser.role === 'admin' || currentUser.role === 'chef'
              ? await fetchAllOrdersFromDb()
              : await fetchUserOrdersFromDb(currentUser.id);
          setOrderHistory(dbOrders);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'companies' },
        async () => {
          const freshCorps = await fetchCorporateAccountsFromDb();
          if (freshCorps.length > 0) setCorporateAccounts(freshCorps);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'broadcast_messages' },
        async () => {
          await refreshBroadcasts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(liveSyncChannel);
    };
  }, [currentUser?.id, currentUser?.role]);

  const activeDateCartItems = (deliveryDate: string): CartItem[] => {
    return cartItems.filter((item) => item.targetDeliveryDate === deliveryDate);
  };

  const addItem = (
    menuItem: MenuItem,
    quantity: number,
    allergyNotes?: string,
    deliveryDate?: string,
    size: 'standard' | 'large' = 'standard',
    selectedAddOns: MenuAddOn[] = []
  ) => {
    if (quantity <= 0 || !deliveryDate) return;

    const basePrice = (size === 'large' && menuItem.prices?.large)
      ? menuItem.prices.large
      : (menuItem.prices?.standard || menuItem.price);
    const addOnsTotal = (selectedAddOns || []).reduce((sum, a) => sum + a.price, 0);
    const unitPrice = basePrice + addOnsTotal;

    const addOnsKey = (selectedAddOns || []).map((a) => a.name).sort().join('|');

    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (item) =>
          item.menuItem.id === menuItem.id &&
          item.targetDeliveryDate === deliveryDate &&
          (item.size || 'standard') === size &&
          ((item.selectedAddOns || []).map((a) => a.name).sort().join('|') === addOnsKey) &&
          (item.allergyNotes || '').trim() === (allergyNotes || '').trim()
      );

      if (existingIndex > -1) {
        const updated = [...prevItems];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + quantity;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          totalPrice: newQty * existing.unitPrice,
        };
        return updated;
      }

      const newItem: CartItem = {
        id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        menuItem,
        quantity,
        size,
        selectedAddOns: selectedAddOns.length > 0 ? selectedAddOns : undefined,
        allergyNotes: allergyNotes?.trim() || undefined,
        targetDeliveryDate: deliveryDate,
        unitPrice,
        totalPrice: quantity * unitPrice,
      };

      return [...prevItems, newItem];
    });
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    setCartItems((prev) => {
      if (newQuantity <= 0) {
        return prev.filter((item) => item.id !== itemId);
      }
      return prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            quantity: newQuantity,
            totalPrice: newQuantity * item.unitPrice,
          };
        }
        return item;
      });
    });
  };

  const removeItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const clearCartForDate = (deliveryDate: string) => {
    setCartItems((prev) => prev.filter((item) => item.targetDeliveryDate !== deliveryDate));
  };

  const clearAllCart = () => {
    setCartItems([]);
  };

  const openCartModal = () => setIsCartModalOpen(true);
  const closeCartModal = () => setIsCartModalOpen(false);

  const getActiveDateTotals = (deliveryDate: string) => {
    const items = activeDateCartItems(deliveryDate);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotalZar = items.reduce((sum, item) => sum + item.totalPrice, 0);

    // Calculate delivery fee based on corporate partner deliveryFeeMode ('free' | 'flat' | 'distance')
    const userCompany = corporateAccounts.find(
      (c) => c.id === currentUser?.companyId || c.companyName === currentUser?.companyName || c.domains.includes(currentUser?.email?.split('@')[1] || '')
    ) || corporateAccounts[0];
    const distanceKm = userCompany?.distanceKm !== undefined ? userCompany.distanceKm : 8.0;
    let deliveryFee = 0.0;
    if (itemCount > 0) {
      if (userCompany?.deliveryFeeMode === 'free') {
        deliveryFee = 0.0;
      } else if (userCompany?.deliveryFeeMode === 'flat') {
        deliveryFee = userCompany.flatFeeAmount !== undefined ? userCompany.flatFeeAmount : 20.0;
      } else {
        deliveryFee = getDeliveryFeeForDistance(distanceKm);
      }
    }

    // Corporate discount per company (Percentage or Fixed Rands)
    const discountType = userCompany?.discountType || 'percentage';
    const discountValue = userCompany?.discountValue !== undefined
      ? userCompany.discountValue
      : (userCompany?.discountPercentage || 0);

    let discountZar = 0;
    if (discountType === 'fixed_zar') {
      discountZar = Math.min(subtotalZar, Math.max(0, discountValue));
    } else {
      discountZar = (subtotalZar * Math.max(0, discountValue)) / 100;
    }

    const discountedSubtotalZar = Math.max(0, subtotalZar - discountZar);
    const totalZar = discountedSubtotalZar + deliveryFee;
    const vatAmount = 0.0; // Strictly zero VAT per client requirements

    const discountLabel = discountType === 'fixed_zar'
      ? `-R ${discountZar.toFixed(2)} (Fixed R${discountValue} Corporate Discount)`
      : `-R ${discountZar.toFixed(2)} (${discountValue}% Corporate Discount)`;

    return {
      itemCount,
      subtotalZar,
      discountType,
      discountValue,
      discountPercentage: discountType === 'percentage' ? discountValue : 0,
      discountZar,
      discountedSubtotalZar,
      deliveryFee,
      vatAmount,
      totalZar,
      formattedTotalZar: `R ${totalZar.toFixed(2)}`,
      formattedSubtotalZar: `R ${subtotalZar.toFixed(2)}`,
      formattedDiscountZar: `-R ${discountZar.toFixed(2)}`,
      formattedDiscountLabel: discountLabel,
      formattedVatZar: `R 0.00`,
    };
  };

  // The whole cart, every delivery day. Each day is its own order with its own delivery fee
  // and discount, the same way the server prices checkout.
  const getCartTotals = () => {
    const deliveryDates = Array.from(new Set(cartItems.map((item) => item.targetDeliveryDate))).sort();
    return deliveryDates.reduce(
      (acc, date) => {
        const day = getActiveDateTotals(date);
        acc.itemCount += day.itemCount;
        acc.subtotalZar += day.subtotalZar;
        acc.discountZar += day.discountZar;
        acc.deliveryFee += day.deliveryFee;
        acc.totalZar += day.totalZar;
        return acc;
      },
      { itemCount: 0, deliveryDates, subtotalZar: 0, discountZar: 0, deliveryFee: 0, totalZar: 0 }
    );
  };

  // Orders are created and marked paid on the server. Once PayFast has
  // confirmed payment, this only reloads them and empties the cart.
  const completePaidCheckout = async (): Promise<OrderHistoryItem | null> => {
    if (!currentUser?.id) return null;
    const dbOrders = await fetchUserOrdersFromDb(currentUser.id);
    const latest = dbOrders[0] || null;
    setOrderHistory(dbOrders);
    setLatestPlacedOrder(latest);
    await AsyncStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(dbOrders));
    clearAllCart();
    return latest;
  };

  const submitOrderRating = async (orderId: string, rating: number, feedback?: string) => {
    if (isSupabaseConfigured()) {
      submitOrderRatingInDb(orderId, rating, feedback).catch((err) =>
        console.warn('Supabase submitOrderRating error:', err)
      );
    }

    const updated = orderHistory.map((ord) => {
      if (ord.id === orderId) {
        return {
          ...ord,
          rating: {
            rating,
            feedback: feedback?.trim() || undefined,
            submittedAt: new Date().toISOString(),
          },
        };
      }
      return ord;
    });

    setOrderHistory(updated);
    await AsyncStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  };

  const reportOrderNonDelivery = async (orderId: string, reason?: string) => {
    const ticketRef = `TCK-${Math.floor(10000 + Math.random() * 90000)}`;
    const resolvedReason = reason || 'Meal not present in designated floor pantry cooler at 12:00 PM';

    if (isSupabaseConfigured()) {
      reportOrderDisputeInDb(orderId, resolvedReason, ticketRef).catch((err) =>
        console.warn('Supabase reportOrderDispute error:', err)
      );
    }

    const updated = orderHistory.map((ord) => {
      if (ord.id === orderId) {
        return {
          ...ord,
          status: 'unfulfilled' as OrderStatus,
          dispute: {
            reportedAt: new Date().toISOString(),
            reason: resolvedReason,
            supportTicketRef: ticketRef,
            status: 'investigating' as const,
          },
        };
      }
      return ord;
    });

    setOrderHistory(updated);
    await AsyncStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  };

  const advanceTrackerStage = async (orderId: string, stage: 1 | 2 | 3 | 4) => {
    const stageStatusMap: Record<1 | 2 | 3 | 4, OrderStatus> = {
      1: 'paid_scheduled',
      2: 'kitchen_prepping',
      3: 'out_for_delivery',
      4: 'delivered',
    };
    const nextStatus = stageStatusMap[stage];

    if (isSupabaseConfigured()) {
      updateOrderStatusInDb(orderId, nextStatus, stage).catch((err) =>
        console.warn('Background Supabase status update failed:', err)
      );
    }

    const updated = orderHistory.map((ord) => {
      if (ord.id === orderId) {
        return {
          ...ord,
          stage,
          status: nextStatus,
        };
      }
      return ord;
    });

    setOrderHistory(updated);
    await AsyncStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  };

  const activeTrackerOrder = useMemo(() => {
    return (
      orderHistory.find((ord) => ord.status === 'kitchen_prepping' || ord.status === 'out_for_delivery' || ord.status === 'paid_scheduled') ||
      latestPlacedOrder ||
      orderHistory[0] ||
      null
    );
  }, [orderHistory, latestPlacedOrder]);

  const clearLatestOrder = () => {
    setLatestPlacedOrder(null);
  };

  // --- Screen 7 Admin Dispatch & Aggregations ---

  const getAggregatedPrepSheet = (targetDate: string): AggregatedPrepItem[] => {
    const ordersForDate = orderHistory.filter(
      (ord) => ord.targetDeliveryDate === targetDate || ord.status === 'kitchen_prepping' || ord.status === 'out_for_delivery'
    );

    const map: Record<string, AggregatedPrepItem> = {};

    ordersForDate.forEach((ord) => {
      ord.items.forEach((item) => {
        const dishId = item.menuItem.id;
        const cat = categories.find((c) => c.id === item.menuItem.categoryId);
        const catName = cat ? cat.name : 'Mains';

        if (!map[dishId]) {
          map[dishId] = {
            dishId,
            dishName: item.menuItem.name,
            categoryName: catName,
            totalQuantity: 0,
            allergyFlagsCount: 0,
            allergyNotesSummary: [],
          };
        }

        map[dishId].totalQuantity += item.quantity;
        if (item.allergyNotes) {
          map[dishId].allergyFlagsCount += item.quantity;
          if (!map[dishId].allergyNotesSummary) {
            map[dishId].allergyNotesSummary = [];
          }
          map[dishId].allergyNotesSummary?.push(item.allergyNotes);
        }
      });
    });

    return Object.values(map);
  };

  const getBatchSiteGroups = (targetDate: string): BatchSiteGroup[] => {
    const ordersForDate = orderHistory.filter(
      (ord) => ord.targetDeliveryDate === targetDate || ord.status === 'kitchen_prepping' || ord.status === 'out_for_delivery' || ord.status === 'delivered'
    );

    const groupsMap: Record<string, BatchSiteGroup> = {};

    ordersForDate.forEach((ord) => {
      const siteKey = `${ord.companyLocation}_${ord.deliveryFloor}`;

      if (!groupsMap[siteKey]) {
        const matchedComp = corporateAccounts.find((c) =>
          ord.companyLocation && ord.companyLocation.includes(c.companyName)
        );
        groupsMap[siteKey] = {
          id: siteKey,
          companyName: ord.companyName || matchedComp?.companyName || 'Corporate Partner',
          locationName: ord.companyLocation || matchedComp?.locations[0] || 'Corporate Campus',
          deliveryFloor: ord.deliveryFloor || 'Corporate Canteen Pantry',
          totalMeals: 0,
          status: ord.status,
          recipients: [],
        };
      }

      const mealQty = ord.items.reduce((s, i) => s + i.quantity, 0);
      groupsMap[siteKey].totalMeals += mealQty;
      groupsMap[siteKey].status = ord.status;

      const summaryText = ord.items.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(', ');
      const allergyNote = ord.items.find((i) => i.allergyNotes)?.allergyNotes;

      groupsMap[siteKey].recipients.push({
        orderNumber: ord.orderNumber,
        clientName: ord.customerName || 'Corporate Client',
        clientEmail: ord.customerEmail || '',
        mealsSummary: summaryText,
        allergyNotes: allergyNote,
      });
    });

    return Object.values(groupsMap);
  };

  const updateBatchStatus = async (siteLocation: string, newStatus: OrderStatus) => {
    const matchingOrderIds: string[] = [];
    const targetStage: 1 | 2 | 3 | 4 =
      newStatus === 'delivered' ? 4 : newStatus === 'out_for_delivery' ? 3 : 2;

    const updated = orderHistory.map((ord) => {
      const ordSite = `${ord.companyLocation}_${ord.deliveryFloor}`;
      if (!siteLocation || ordSite === siteLocation || ord.companyLocation === siteLocation || siteLocation.startsWith('site_')) {
        matchingOrderIds.push(ord.id);
        return {
          ...ord,
          status: newStatus,
          stage: targetStage,
        };
      }
      return ord;
    });

    setOrderHistory(updated);
    await AsyncStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(updated));

    if (isSupabaseConfigured() && matchingOrderIds.length > 0) {
      updateBatchOrderStatusesInDb(matchingOrderIds, newStatus, targetStage).catch((err) =>
        console.warn('Supabase updateBatchStatus error:', err)
      );
    }
  };

const mustSave = async (saving: Promise<boolean>, what: string) => {
    if (isSupabaseConfigured() && !(await saving)) {
      throw new Error(`${what} could not be saved. Please try again.`);
    }
  };

  // --- Menu CRUD Operations (Soft-Delete Architecture) ---

  const addMenuItem = async (itemData: Omit<MenuItem, 'id'>): Promise<MenuItem> => {
    let newItem: MenuItem = {
      ...itemData,
      id: `dish_${Date.now()}`,
    };

    if (isSupabaseConfigured()) {
      const dbId = await adminAddMenuItemToDb(itemData);
      if (!dbId) throw new Error('The dish could not be saved. Please try again.');
      newItem = { ...newItem, id: dbId };
    }

    const updated = [newItem, ...menuItems];
    setMenuItems(updated);
    await AsyncStorage.setItem(MENU_ITEMS_STORAGE_KEY, JSON.stringify(updated));
    return newItem;
  };

  const updateMenuItem = async (id: string, updates: Partial<MenuItem>) => {
    await mustSave(adminUpdateMenuItemInDb(id, updates), 'The dish');
    const updated = menuItems.map((dish) => {
      if (dish.id === id) {
        return { ...dish, ...updates };
      }
      return dish;
    });
    setMenuItems(updated);
    await AsyncStorage.setItem(MENU_ITEMS_STORAGE_KEY, JSON.stringify(updated));
  };

  const archiveMenuItem = async (id: string) => {
    await mustSave(adminArchiveMenuItemInDb(id), 'The dish');
    const updated = menuItems.map((dish) => {
      if (dish.id === id) {
        return { ...dish, isAvailable: false };
      }
      return dish;
    });
    setMenuItems(updated);
    await AsyncStorage.setItem(MENU_ITEMS_STORAGE_KEY, JSON.stringify(updated));
  };

  const addCategory = async (catData: Omit<MenuCategory, 'id'>): Promise<MenuCategory> => {
    let newCat: MenuCategory = {
      ...catData,
      id: `cat_${Date.now()}`,
    };

    if (isSupabaseConfigured()) {
      const dbId = await adminAddCategoryToDb(catData);
      if (!dbId) throw new Error('The category could not be saved. Please try again.');
      newCat = { ...newCat, id: dbId };
    }

    const updated = [...categories, newCat];
    setCategories(updated);
    await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
    return newCat;
  };

  const updateCategory = async (id: string, updates: Partial<MenuCategory>) => {
    await mustSave(adminUpdateCategoryInDb(id, updates), 'The category');
    const updated = categories.map((cat) => {
      if (cat.id === id) {
        return { ...cat, ...updates };
      }
      return cat;
    });
    setCategories(updated);
    await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
  };

  const setActiveCycleWeek = async (weekNumber: number) => {
    await mustSave(setActiveCycleWeekInDb(weekNumber), 'The active week');
    setActiveCycleWeekNumber(weekNumber);
    const updated = cycleWeeks.map((w) => {
      if (w.weekNumber === weekNumber) {
        return { ...w, status: 'active_now' as const };
      }
      if (w.weekNumber === ((weekNumber % 8) + 1)) {
        return { ...w, status: 'scheduled_next' as const };
      }
      return { ...w, status: 'inactive' as const };
    });
    setCycleWeeks(updated);
    await AsyncStorage.setItem(CYCLE_STORAGE_KEY, JSON.stringify(updated));
  };

  const toggleAdvanceCycleLock = async () => {
    setIsAdvanceCycleLocked((prev) => !prev);
  };

  const addCorporateAccount = async (
    name: string,
    domain: string,
    locations: string[],
    distanceKm: number = 8.0,
    discountType: 'percentage' | 'fixed_zar' = 'percentage',
    discountValue: number = 0,
    billingEmail?: string,
    deliveryFeeMode: 'free' | 'flat' | 'distance' = 'distance',
    flatFeeAmount: number = 20.0
  ): Promise<CorporateAccount> => {
    const cleanValue = discountType === 'percentage'
      ? Math.max(0, Math.min(100, discountValue))
      : Math.max(0, discountValue);

    const cleanLocations = locations.map((l) => l.trim()).filter(Boolean);
    const resolvedLocations = cleanLocations.length > 0 ? cleanLocations : ['Head Office Reception'];

    let dbId: string | null = null;
    if (isSupabaseConfigured()) {
      dbId = await adminAddCompanyToDb(
        name,
        domain,
        resolvedLocations,
        distanceKm,
        discountType,
        cleanValue,
        billingEmail,
        deliveryFeeMode,
        flatFeeAmount
      );
      if (!dbId) throw new Error('The company could not be saved. Please try again.');
    }

    const newAccount: CorporateAccount = {
      id: dbId || `corp_${Date.now()}`,
      companyName: name,
      domains: [domain],
      activeUsersCount: 0,
      locations: resolvedLocations,
      distanceKm,
      discountType,
      discountValue: cleanValue,
      discountPercentage: discountType === 'percentage' ? cleanValue : 0,
      billingEmail: billingEmail || `accounts@${domain}`,
      mealSubsidyAmount: 0,
      deliveryFeeMode,
      flatFeeAmount,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    const updated = [...corporateAccounts, newAccount];
    setCorporateAccounts(updated);
    await AsyncStorage.setItem(CORPORATE_STORAGE_KEY, JSON.stringify(updated));
    return newAccount;
  };

  const updateCorporateAccountDetails = async (
    accountId: string,
    updates: Partial<CorporateAccount>
  ) => {
    await mustSave(
      adminUpdateCompanyInDb(accountId, {
        distanceKm: updates.distanceKm,
        discountType: updates.discountType,
        discountValue: updates.discountValue,
        isActive: updates.isActive,
        billingEmail: updates.billingEmail,
        mealSubsidyAmount: updates.mealSubsidyAmount,
        deliveryFeeMode: updates.deliveryFeeMode,
        flatFeeAmount: updates.flatFeeAmount,
        locations: updates.locations,
      }),
      'The company'
    );

    const updated = corporateAccounts.map((acc) => {
      if (acc.id === accountId) {
        return {
          ...acc,
          ...updates,
        };
      }
      return acc;
    });
    setCorporateAccounts(updated);
    await AsyncStorage.setItem(CORPORATE_STORAGE_KEY, JSON.stringify(updated));
  };

  const updateCorporateAccountDistance = async (accountId: string, distanceKm: number) => {
    await mustSave(adminUpdateCompanyInDb(accountId, { distanceKm }), 'The company');
    const updated = corporateAccounts.map((acc) => {
      if (acc.id === accountId) {
        return { ...acc, distanceKm };
      }
      return acc;
    });
    setCorporateAccounts(updated);
    await AsyncStorage.setItem(CORPORATE_STORAGE_KEY, JSON.stringify(updated));
  };

  const updateCorporateAccountDiscount = async (
    accountId: string,
    discountType: 'percentage' | 'fixed_zar',
    discountValue: number
  ) => {
    const cleanValue = discountType === 'percentage'
      ? Math.max(0, Math.min(100, discountValue))
      : Math.max(0, discountValue);

    await mustSave(adminUpdateCompanyInDb(accountId, { discountType, discountValue: cleanValue }), 'The discount');

    const updated = corporateAccounts.map((acc) => {
      if (acc.id === accountId) {
        return {
          ...acc,
          discountType,
          discountValue: cleanValue,
          discountPercentage: discountType === 'percentage' ? cleanValue : 0,
        };
      }
      return acc;
    });
    setCorporateAccounts(updated);
    await AsyncStorage.setItem(CORPORATE_STORAGE_KEY, JSON.stringify(updated));
  };

  const addDomainToAccount = async (accountId: string, domain: string) => {
    await mustSave(adminAddDomainToCompanyInDb(accountId, domain), 'The domain');
    const updated = corporateAccounts.map((acc) => {
      if (acc.id === accountId) {
        return {
          ...acc,
          domains: Array.from(new Set([...acc.domains, domain.toLowerCase().trim()])),
        };
      }
      return acc;
    });
    setCorporateAccounts(updated);
    await AsyncStorage.setItem(CORPORATE_STORAGE_KEY, JSON.stringify(updated));
  };

  const updateCycleDayPlan = async (weekNumber: number, dayName: string, updates: Partial<CycleDayPlan>) => {
    await mustSave(updateCycleDayPlanInDb(weekNumber, dayName, updates), 'The day plan');
    const updatedPlans = cyclePlans.map((w) => {
      if (w.week === weekNumber) {
        return {
          ...w,
          days: w.days.map((d) => (d.day === dayName ? { ...d, ...updates } : d)),
        };
      }
      return w;
    });
    setCyclePlans(updatedPlans);
    await AsyncStorage.setItem(CYCLE_PLANS_STORAGE_KEY, JSON.stringify(updatedPlans));
  };

  const updateCycleRotation = async (weekNumber: number, updates: { title?: string; description?: string }) => {
    await mustSave(updateCycleRotationInDb(weekNumber, updates), 'The week');
    const updatedCycles = cycleWeeks.map((w) => {
      if (w.weekNumber === weekNumber) {
        return {
          ...w,
          ...(updates.title !== undefined ? { title: updates.title } : {}),
          ...(updates.description !== undefined ? { description: updates.description } : {}),
        };
      }
      return w;
    });
    setCycleWeeks(updatedCycles);
    await AsyncStorage.setItem(CYCLE_STORAGE_KEY, JSON.stringify(updatedCycles));
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        orderHistory,
        menuItems,
        categories,
        cycleWeeks,
        cyclePlans,
        corporateAccounts,
        activeCycleWeekNumber,
        isAdvanceCycleLocked,
        latestPlacedOrder,
        activeTrackerOrder,
        activeDateCartItems,
        addItem,
        updateQuantity,
        removeItem,
        clearCartForDate,
        clearAllCart,
        isCartModalOpen,
        openCartModal,
        closeCartModal,
        getActiveDateTotals,
        getCartTotals,
        completePaidCheckout,
        submitOrderRating,
        reportOrderNonDelivery,
        advanceTrackerStage,
        clearLatestOrder,
        getAggregatedPrepSheet,
        getBatchSiteGroups,
        updateBatchStatus,
        addMenuItem,
        updateMenuItem,
        archiveMenuItem,
        addCategory,
        updateCategory,
        setActiveCycleWeek,
        toggleAdvanceCycleLock,
        addCorporateAccount,
        updateCorporateAccountDistance,
        updateCorporateAccountDiscount,
        updateCorporateAccountDetails,
        addDomainToAccount,
        updateCycleDayPlan,
        updateCycleRotation,
        broadcastMessages,
        unreadBroadcastCount,
        markBroadcastsAsRead,
        refreshBroadcasts,
        ensureCorporateAccountsLoaded,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

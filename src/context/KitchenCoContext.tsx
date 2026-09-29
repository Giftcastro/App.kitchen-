import React, { createContext, useContext, useState, Dispatch, SetStateAction, useMemo, useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeColors, ThemeMode, ResolvedScheme, getThemeColors } from '../utils/theme';
import { NormalizedMenuItem, AddOnOption } from '../utils/menuNormalize';
import { syncOrderReminder, cancelOrderReminder, showAnnouncementNotification } from '../utils/orderReminders';
import { calculateDeliveryFee, getItemDueDate, getCycleWeekForDate, getCycleOffsetForWeek } from '../utils/deliveryHelpers';
import { haptics } from '../utils/haptics';
import { signUpWithEmail, signInWithEmail, signOutUser, restoreSessionUser, SignupAddress } from '../lib/supabase/auth';
import { fetchMenuCategories, adminCreateMenuItem, adminUpdateMenuItem, adminSetMenuItemActive, adminDeleteMenuItem } from '../lib/supabase/menu';
import { fetchMyDeliveryAddress, ResolvedAddress } from '../lib/supabase/addresses';
import { placeRealOrder, fetchMyOrders, isRealOrderId, adminUpdateOrderStatus, submitRealOrderRating, reportRealOrderDispute } from '../lib/supabase/orders';
import { fetchUserDirectory } from '../lib/supabase/profiles';
import { fetchCompanies, adminCreateCompany, adminUpdateCompany, adminDeleteCompany } from '../lib/supabase/companies';
import { fetchDiscounts, adminCreateDiscount, adminUpdateDiscount, adminDeleteDiscount } from '../lib/supabase/discounts';

export type { AddOnOption };

const THEME_MODE_STORAGE_KEY = 'kitchenco_theme_mode';
const KITCHEN_EMAIL_STORAGE_KEY = 'kitchenco_kitchen_email';
/**
 * Customer feedback (ratings + non-delivery tickets), keyed by order id.
 *
 * Only the feedback is persisted, not the orders themselves. Orders are seeded
 * demo data that is meant to reset on reload — persisting them would freeze the
 * fixture at whatever the first run produced and make seed edits invisible.
 * Feedback is the one thing a customer would be rightly annoyed to lose, and
 * re-attaching it by order id keeps the seed resettable. Order ids are stable
 * (ORD-#### for seeded demo orders; a real UUID from the database for
 * anything placed for real), so a rating survives either way.
 */
const ORDER_FEEDBACK_STORAGE_KEY = 'kitchenco_order_feedback_v1';

/** What we keep per order between launches. */
type PersistedOrderFeedback = { rating?: OrderRating; dispute?: DisputeInfo };

/**
 * Sequential source for new user ids, for the same reason as
 * nextOrderNumber above — these were also random 4-digit numbers sharing a
 * 9,000-value space with the seeded users (USR-1001..USR-1007). Exported so
 * the admin screen mints ids from the same counter rather than its own.
 */
let nextUserNumber = 1008;
export const createUserId = () => `USR-${nextUserNumber++}`;

/** Sequential id source for company addresses — same reasoning as createUserId above. */
let nextCompanyAddressNumber = 1;
export const createCompanyAddressId = () => `addr-${nextCompanyAddressNumber++}`;

export type AccountType = 'individual' | 'company';

export interface User {
  name?: string;
  email: string;
  role: string;
  accountType?: AccountType;
  companyName?: string;
  /** Real company_id FK — the source of truth for discount eligibility (see isItemEligibleForDiscount), unlike companyName which is display-only. */
  companyId?: string;
  /** Which of the company's registered delivery addresses (see Company.addresses) this employee belongs to — only meaningful when accountType is 'company'. References CompanyAddress.id; falls back to the first registered address when unset or when it no longer matches one (an admin can delete an address after someone signed up against it). */
  companyAddressId?: string;
}

export interface AppUser extends User {
  id: string;
  joinedDate: string;
  orderCount: number;
  companyName?: string;
  accountType?: AccountType;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  image?: string;
  selectedSize?: string;
  notes?: string;
  /** yyyy-mm-dd — set when this item was pre-scheduled for a specific weekday (Main Menu only). */
  deliveryDate?: string;
  /** e.g. "Mon, 8 Sep" — display label for deliveryDate. */
  deliveryDateLabel?: string;
  /** Extras selected for this specific item (e.g. "Extra Bacon") — already folded into `price`; kept here for display/receipt purposes only. */
  addOns?: AddOnOption[];
  /**
   * Structured references for the real place_order RPC (see
   * src/lib/supabase/orders.ts) — separate from `id` above, which is a
   * display/cart-merge key, not a database reference. `source: 'static'`
   * items carry `menuItemId` (the real menu_items UUID); `source: 'cycle'`
   * items carry the week/day/slot instead, since cycle items have no
   * menu_items row at all.
   */
  source?: 'static' | 'cycle';
  menuItemId?: string;
  cycleWeekNumber?: number;
  cycleDayOfWeek?: string;
  cycleSlot?: string;
}

/** A customer's post-delivery rating of one order (ported from JoTsav/kicthenCoV1 main). */
export interface OrderRating {
  /** 1 to 5 stars. */
  rating: number;
  feedback?: string;
  submittedAt: string;
}

/** A logged non-delivery / meal-issue ticket against one order. */
export interface DisputeInfo {
  reportedAt: string;
  reason: string;
  /** e.g. "TCK-88219" — shown to the customer so they can quote it to support. */
  supportTicketRef: string;
  status: 'investigating' | 'refunded' | 'resolved';
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  totalPrice: number;
  status: string;
  date: string;
  timestamp: string;
  userEmail?: string;
  userName?: string;
  deliveryAddress?: DeliveryAddress;
  /** Distance-based delivery fee charged on this order (see deliveryHelpers.ts). Undefined on older demo orders predating this field — treat as R0/"Free". */
  deliveryFee?: number;
  note?: string;
  discount?: Discount;
  discountAmount?: number;
  /** Company meal subsidy deducted from this order, if the customer belonged to a subsidizing company at checkout. */
  subsidyAmount?: number;
  /** Set once the customer rates a delivered order — see submitOrderRating. */
  rating?: OrderRating;
  /** Set when the customer reports their meal missing — see reportOrderNonDelivery. */
  dispute?: DisputeInfo;
  /**
   * PayFast's m_payment_id for this checkout, passed in by payfast.tsx (which
   * mints it) so the order carries its own real reference. Undefined on the
   * seeded demo orders, which never went through a checkout.
   */
  paymentReference?: string;
}

export interface DeliveryAddress {
  id: string;
  label: string;
  street: string;
  suburb: string;
  city: string;
  code: string;
  isDefault: boolean;
  /** Road distance from the kitchen, in km — drives the delivery fee band. */
  distanceKm?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  items: NormalizedMenuItem[];
  addOns?: AddOnOption[];
}

export interface CompanyAddress {
  id: string;
  /** Admin-given name for this site, e.g. "Head Office" or "Sandton Branch" — shown wherever an employee has to tell two of a company's addresses apart (signup, the address picker). Falls back to the street when unset. */
  label?: string;
  street: string;
  /** Floor / suite / unit within the building, e.g. "Floor 4, Suite 402". */
  unit?: string;
  suburb: string;
  city: string;
  code: string;
  /** Standing delivery notes for this address (access code, loading bay, etc.) — shown to the courier on every order to this company. */
  instructions?: string;
  /** Road distance from the kitchen, in km — drives the delivery fee band. */
  distanceKm?: number;
}

/** A corporate client. Users are matched to one by their work-email domain at login. */
export interface Company {
  id: string;
  name: string;
  /** Lowercase domains, no "@" — e.g. "acmelogistics.com". */
  domains: string[];
  /**
   * Registered delivery addresses for bulk/company orders — a company can
   * have any number of sites (client request, Sep 2026: "one company can
   * have many addresses"), not just a primary + one alternate. The first
   * entry is the default/primary address; an employee with more than one to
   * choose from picks one at signup (see User.companyAddressId).
   */
  addresses: CompanyAddress[];
  /** Fixed amount (Rand, VAT-inclusive) the company subsidizes per meal ordered by its employees. Deducted automatically at checkout, capped per item so it can't exceed that item's price. */
  mealSubsidy?: number;
}

export interface SavedCard {
  id: string;
  cardholderName: string;
  cardNumber: string; // Masked - last 4 digits only
  expiryDate: string;
  cardType: 'visa' | 'mastercard' | 'amex' | 'other';
  createdAt: string;
}

export interface Discount {
  id: string;
  code: string;
  percentage: number;
  active: boolean;
  expires?: string;
  // Target specific company/category or item
  /** Real company_id FK — always the source of truth for eligibility (see isItemEligibleForDiscount). Set on create/update from the admin form's company picker. */
  companyId?: string;
  /** Display-only company name (e.g. admin's "X only" badge) — NOT safe to use for eligibility. It's resolved via a join that's itself RLS-scoped to the viewer's own company, so a discount targeting a different company can come back with this unset even though companyId is correct; compare companyId instead. */
  company?: string;
  categoryId?: string;
  itemName?: string;
}

/**
 * A message the kitchen sends to customers — a menu change, a delivery delay,
 * a public holiday closure. Added in the Sep 2026 client review.
 *
 * Delivery is IN-APP: the announcement appears as a banner on the customer's
 * menu. There is no backend in this app (see src/utils/orderReminders.ts —
 * real server push is Stage 2 of the SLA), so nothing is transmitted to other
 * devices; a local notification is also raised on the sending device so the
 * mechanism is visible end to end in a demo.
 */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  /** Company this is addressed to, or null to reach every customer. */
  companyName: string | null;
  sentAt: string;
}

interface KitchenContextType {
  user: User | null;
  cart: CartItem[];
  orders: Order[];
  orderNote: string;
  setOrderNote: Dispatch<SetStateAction<string>>;
  appliedDiscount: Discount | null;
  /** Explicit user action (apply code / remove) — pauses the auto-apply-best-discount effect so it isn't silently undone. */
  setAppliedDiscount: (discount: Discount | null) => void;
  /**
   * Which of the 8 rotation weeks in cycleMenu.json is live right now.
   *
   * Derived from the calendar (see getCycleWeekForDate) rather than stored —
   * the client asked for the cycle menu to rotate on its own instead of only
   * advancing when an admin remembered to click. `setActiveWeek` still works
   * and is what Kitchen Controls → Menu Cycles calls, but it records a shift
   * of the whole rotation rather than pinning one fixed week, so the menu
   * keeps advancing by itself from the corrected position.
   */
  activeWeek: number;
  setActiveWeek: (week: number) => void;
  /** How many weeks an admin has shifted the rotation off its calendar position. 0 = running purely off the calendar. */
  cycleWeekOffset: number;
  /** Drops any manual shift, putting the rotation back on its calendar position. */
  resetCycleRotation: () => void;
  /**
   * ISO date (YYYY-MM-DD) the customer is currently ordering for — the default
   * delivery day stamped onto everything they add to the basket. Chosen up
   * front on the "Which day are you ordering for?" screen so the menu itself
   * no longer has to carry a date row (client review, Sep 2026), and
   * changeable at any time from the menu header or the added-to-basket sheet.
   *
   * `null` only before the first choice is made — screens read that as "ask
   * the customer first". It is never silently defaulted to today, because
   * today is almost always already past the order cutoff.
   */
  orderingForDate: string | null;
  setOrderingForDate: (iso: string | null) => void;
  /** Local-state-only session set — used solely by the __DEV__ "Dev Bypass" button, never touches Supabase. */
  login: (email: string, role: string, name?: string, accountType?: AccountType, companyName?: string, companyAddressId?: string) => void;
  logout: () => void;
  /** Real Supabase Auth sign-in. Throws on bad credentials — the caller shows the error. */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** Real Supabase Auth sign-up. Throws on failure (e.g. email already registered). */
  signUpWithPassword: (email: string, password: string, name: string, address?: SignupAddress, preferredCompanyAddressId?: string) => Promise<void>;
  /** True while the initial session-restore check (app cold start) is still running. */
  authLoading: boolean;
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  placeOrder: (deliveryAddress?: DeliveryAddress, paymentReference?: string) => Promise<void>;
  allUsers: AppUser[];
  menus: MenuCategory[];
  /** True until the first Supabase menu fetch resolves (or fails). */
  menusLoading: boolean;
  /** Re-fetches the catalog from Supabase — wired into the Menu screen's pull-to-refresh. */
  refetchMenus: () => Promise<void>;
  discounts: Discount[];
  discountsLoading: boolean;
  addMenuItem: (categoryId: string, item: { name: string; price: number; description: string; image?: string }) => Promise<void>;
  updateMenuItem: (categoryId: string, itemId: string, item: { name: string; price: number; description: string; image?: string }) => Promise<void>;
  deleteMenuItem: (categoryId: string, itemId: string) => Promise<void>;
  /** Hides/shows a dish on the customer menu without deleting it. */
  setMenuItemActive: (categoryId: string, itemId: string, active: boolean) => Promise<void>;
  addDiscount: (discount: Discount) => Promise<void>;
  updateDiscount: (discountId: string, discount: Partial<Discount>) => Promise<void>;
  deleteDiscount: (discountId: string) => Promise<void>;
  addUser: (user: AppUser) => void;
  updateUser: (userId: string, updates: Partial<AppUser>) => void;
  deleteUser: (userId: string) => void;
  companies: Company[];
  companiesLoading: boolean;
  addCompany: (company: Omit<Company, 'id'>) => Promise<void>;
  /** Resolves with any addresses that couldn't be removed because an employee is still assigned to them (see adminUpdateCompany). */
  updateCompany: (companyId: string, updates: Partial<Omit<Company, 'id'>>) => Promise<{ blockedAddressDeletes: CompanyAddress[] }>;
  /** Throws a friendly error if employees are still linked to this company. */
  deleteCompany: (companyId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  /** Records a delivered order's star rating and optional feedback. */
  submitOrderRating: (orderId: string, rating: number, feedback?: string) => Promise<void>;
  /**
   * Logs a non-delivery ticket against ONE order and returns its reference.
   *
   * Deliberately does not touch `status`, unlike the reference implementation
   * in JoTsav/kicthenCoV1 main (which sets it to 'unfulfilled'): status here is
   * shared by every order in a company+day batch (see updateOrderStatus), so
   * one employee reporting a missing meal would otherwise mark the whole
   * company's delivery unfulfilled. The Orders screen derives its
   * "Unfulfilled / Disputed" pill from `dispute` being set instead.
   */
  reportOrderNonDelivery: (orderId: string, reason?: string) => Promise<string>;
  savedAddresses: DeliveryAddress[];
  addAddress: (address: DeliveryAddress) => void;
  removeAddress: (addressId: string) => void;
  setDefaultAddress: (addressId: string) => void;
  /** Clears any personal default address so a corporate account's deliveryInfo falls back to their company's registered address. */
  useCompanyAddress: () => void;
  /** Auto-resolved delivery destination + distance-based fee for the current user — company address for corporate accounts, default saved address otherwise. */
  deliveryInfo: { distanceKm: number | null; fee: number | null; address: DeliveryAddress | null; addressLabel: string | null; addressId: string | null };
  savedCards: SavedCard[];
  saveCard: (card: Omit<SavedCard, 'id' | 'createdAt'>) => void;
  removeCard: (cardId: string) => void;
  theme: ThemeColors;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  /** Bumped on every addToCart — screens that want a "something was added" pulse (e.g. the header cart badge) watch this. */
  cartPulseSignal: number;
  /** Animates a small icon from (fromX, fromY) to the header cart button, if a handler is currently registered (Menu tab only — see (tabs)/_layout.tsx). No-ops elsewhere. */
  triggerCartFly: (fromX: number, fromY: number) => void;
  /** Registers the fly-to-cart animation implementation — called once by (tabs)/_layout.tsx, which is the only screen that knows where the cart icon actually is. */
  registerCartFlyHandler: (handler: ((fromX: number, fromY: number) => void) | null) => void;
  isItemEligibleForDiscount: (item: CartItem, discount: Discount | null) => boolean;
  calculateDiscountAmount: (cartItems: CartItem[], discount: Discount | null) => number;
  /** Company meal subsidy for the current user, applied automatically (no code needed) — each item's contribution is capped at that item's own price so a meal is never "paid" to order. Zero if the user isn't matched to a subsidizing company. */
  calculateSubsidyAmount: (cartItems: CartItem[]) => number;
  /** Every announcement the kitchen has sent, newest first. */
  announcements: Announcement[];
  sendAnnouncement: (announcement: { title: string; body: string; companyName: string | null }) => void;
  deleteAnnouncement: (id: string) => void;
  /** The announcements the signed-in customer should currently see — addressed to them, and not yet dismissed. */
  visibleAnnouncements: Announcement[];
  dismissAnnouncement: (id: string) => void;
  remindersEnabled: boolean;
  setRemindersEnabled: Dispatch<SetStateAction<boolean>>;
  /** Where the Chef tab's Production Sheet / Delivery Note "Send" dialogs default their recipient to — internal kitchen/back-of-house staff, not the corporate client. Persisted across app restarts. */
  kitchenEmail: string;
  setKitchenEmail: (email: string) => void;
}

interface DemoSeedData {
  users: AppUser[];
  orders: Order[];
}

/**
 * Builds the prototype seed data (demo users and orders — discounts moved to
 * the real database, see fetchDiscounts).
 *
 * This used to be a mount-time useEffect calling setAllUsers/setOrders, so
 * every launch rendered the entire app once against empty state and then
 * immediately re-rendered with the data. It is the initial state now, so the
 * first render already has it — one less full-app render pass on startup,
 * from the provider that re-renders everything.
 */
function buildDemoSeedData(): DemoSeedData {
  const demoUsers: AppUser[] = [
    { id: 'USR-1001', name: 'John Customer', email: 'john@example.com', role: 'customer', joinedDate: '12 Jun 2026', orderCount: 3 },
    { id: 'USR-1002', name: 'Jane Smith', email: 'jane@example.com', role: 'customer', joinedDate: '28 May 2026', orderCount: 7 },
    { id: 'USR-1003', name: 'Mike Johnson', email: 'mike@example.com', role: 'customer', joinedDate: '5 Jun 2026', orderCount: 1 },
    // Demonstrates work-email domain matching — signing in with any
    // @ecogra.org/@tcs.com/@rclfoods.com address auto-detects the matching
    // real corporate client (see `companies`, below). Two Ecogra employees
    // are seeded so the Chef tab's Order Queue has a real multi-order
    // batch to demonstrate, not just a single-order company.
    { id: 'USR-1004', name: 'Thandiwe Mokoena', email: 'thandiwe@ecogra.org', role: 'customer', accountType: 'company', companyName: 'Ecogra', joinedDate: '3 Aug 2026', orderCount: 3 },
    { id: 'USR-1005', name: 'Lerato Nkosi', email: 'lerato@ecogra.org', role: 'customer', accountType: 'company', companyName: 'Ecogra', joinedDate: '10 Aug 2026', orderCount: 2 },
    { id: 'USR-1006', name: 'Raj Naidoo', email: 'raj@tcs.com', role: 'customer', accountType: 'company', companyName: 'TATA', joinedDate: '15 Aug 2026', orderCount: 1 },
    { id: 'USR-1007', name: 'Nomvula Dube', email: 'nomvula@rclfoods.com', role: 'customer', accountType: 'company', companyName: 'RCL', joinedDate: '20 Aug 2026', orderCount: 1 },
  ];
  
  const todayStr = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  // yyyy-mm-dd, for a demo order whose items are pre-scheduled for delivery
  // today — so the admin dashboard's "Due Today" tracking has something
  // real to show regardless of what the actual current date happens to be.
  // Built from local date parts, not toISOString() (UTC) — the due-date
  // comparison this feeds (isSameDay) uses local getFullYear/Month/Date,
  // so a UTC-based string could land on the wrong calendar day depending
  // on the device's timezone offset.
  const _today = new Date();
  const todayISO = `${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, '0')}-${String(_today.getDate()).padStart(2, '0')}`;
  const todayDeliveryLabel = new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });

  const demoOrders: Order[] = [
    {
      // A corporate bulk order placed a few days ago and pre-scheduled for
      // delivery today — the realistic case "Due Today" is meant to catch:
      // items booked for a specific date, not just orders placed today.
      // Paired with ORD-1296 below (same company, same day) so the Chef
      // tab's Order Queue has a real 2-order Ecogra batch to show off, not
      // just a single order that happens to have a company attached.
      id: 'ORD-1295',
      items: [
        { id: 'bulk-1', name: 'Chicken Aglio e Olio Penne', price: 80, category: 'CIAO ITALY', quantity: 15, selectedSize: 'Standard', deliveryDate: todayISO, deliveryDateLabel: todayDeliveryLabel },
        { id: 'bulk-2', name: 'Beef Lasagne', price: 80, category: 'CIAO ITALY', quantity: 10, selectedSize: 'Standard', deliveryDate: todayISO, deliveryDateLabel: todayDeliveryLabel },
      ],
      total: 2100,
      totalPrice: 2000,
      deliveryFee: 100,
      status: 'preparing',
      date: '26 Aug 2026, 09:10',
      timestamp: '26 Aug 2026, 09:10',
      userEmail: 'thandiwe@ecogra.org',
      userName: 'Thandiwe Mokoena',
      deliveryAddress: {
        id: 'company-ecogra',
        label: 'Ecogra',
        street: '160 Jan Smuts Ave',
        suburb: 'Rosebank',
        city: 'Johannesburg',
        code: '',
        isDefault: true,
      },
    },
    {
      id: 'ORD-1296',
      items: [
        { id: 'bulk-3', name: 'Chicken Napolitana Penne', price: 80, category: 'CIAO ITALY', quantity: 8, selectedSize: 'Standard', deliveryDate: todayISO, deliveryDateLabel: todayDeliveryLabel },
      ],
      total: 740,
      totalPrice: 640,
      deliveryFee: 100,
      status: 'preparing',
      date: '27 Aug 2026, 08:50',
      timestamp: '27 Aug 2026, 08:50',
      userEmail: 'lerato@ecogra.org',
      userName: 'Lerato Nkosi',
      deliveryAddress: {
        id: 'company-ecogra',
        label: 'Ecogra',
        street: '160 Jan Smuts Ave',
        suburb: 'Rosebank',
        city: 'Johannesburg',
        code: '',
        isDefault: true,
      },
    },
    {
      id: 'ORD-1297',
      items: [
        { id: 'bulk-4', name: 'Chicken Alfredo Linguini Pasta', price: 80, category: 'CIAO ITALY', quantity: 12, selectedSize: 'Standard', deliveryDate: todayISO, deliveryDateLabel: todayDeliveryLabel },
      ],
      total: 1060,
      totalPrice: 960,
      deliveryFee: 100,
      status: 'pending',
      date: '28 Aug 2026, 10:15',
      timestamp: '28 Aug 2026, 10:15',
      userEmail: 'raj@tcs.com',
      userName: 'Raj Naidoo',
      deliveryAddress: {
        id: 'company-tata',
        label: 'TATA',
        street: '39 Ferguson Road',
        suburb: 'Illovo',
        city: 'Johannesburg',
        code: '',
        isDefault: true,
      },
    },
    {
      id: 'ORD-1298',
      items: [
        { id: 'bulk-5', name: 'Beef Lasagne', price: 80, category: 'CIAO ITALY', quantity: 6, selectedSize: 'Standard', deliveryDate: todayISO, deliveryDateLabel: todayDeliveryLabel },
      ],
      total: 580,
      totalPrice: 480,
      deliveryFee: 100,
      status: 'pending',
      date: '29 Aug 2026, 09:30',
      timestamp: '29 Aug 2026, 09:30',
      userEmail: 'nomvula@rclfoods.com',
      userName: 'Nomvula Dube',
      deliveryAddress: {
        id: 'company-rcl',
        label: 'RCL',
        street: '15 Railey Road',
        suburb: 'Bedfordview',
        city: 'Johannesburg',
        code: '',
        isDefault: true,
      },
    },
    {
      id: 'ORD-1290',
      items: [
        { id: 'today-1', name: 'Grilled Chicken & Mushroom Pasta', price: 140, category: 'CIAO ITALY', quantity: 2, selectedSize: 'Regular' },
        { id: 'today-2', name: 'Caesar Salad', price: 80, category: 'SALADS & BOWLS', quantity: 1 },
        { id: 'today-3', name: 'Garlic Bread', price: 35, category: 'SIDES & SAUCES', quantity: 1 },
      ],
      total: 395,
      totalPrice: 395,
      status: 'on_the_way',
      date: todayStr,
      timestamp: todayStr,
      userEmail: 'john@example.com',
      userName: 'John Customer',
      deliveryAddress: {
        id: 'addr-1',
        label: 'Home',
        street: '12 Oak Avenue',
        suburb: 'Rivonia',
        city: 'Johannesburg',
        code: '2128',
        isDefault: true,
      },
    },
    {
      id: 'ORD-1234',
      items: [
        { id: '1', name: 'Grilled Chicken & Mushroom Pasta', price: 140, category: 'CIAO ITALY', quantity: 1, selectedSize: 'Regular' },
        { id: '2', name: 'Garlic Bread', price: 35, category: 'SIDES & SAUCES', quantity: 1 },
      ],
      total: 175,
      totalPrice: 175,
      status: 'pending',
      date: '17 Jul 2026, 10:30',
      timestamp: '17 Jul 2026, 10:30',
      userEmail: 'john@example.com',
      userName: 'John Customer',
      deliveryAddress: {
        id: 'addr-1',
        label: 'Home',
        street: '12 Oak Avenue',
        suburb: 'Rivonia',
        city: 'Johannesburg',
        code: '2128',
        isDefault: true,
      },
    },
    {
      id: 'ORD-1233',
      items: [
        { id: '3', name: 'Creamy Chicken & Mushroom Pasta', price: 140, category: 'CIAO ITALY', quantity: 1, selectedSize: 'Regular' },
        { id: '4', name: 'Green Salad', price: 20, category: 'SIDES & SAUCES', quantity: 1 },
        // Weekly Menu item (id prefixed "cycle-") — included so Activity has a
        // real example of an order that can't be reordered as a single action.
        { id: 'cycle-Week 1-Monday-MAIN MEAL-TraditionalBeefBobotiewithYellowRice&Sambal', name: 'Traditional Beef Bobotie with Yellow Rice & Sambal', price: 80, category: 'Week 1 • Monday', quantity: 1, selectedSize: 'Regular' },
      ],
      total: 240,
      totalPrice: 240,
      status: 'delivered',
      date: '16 Jul 2026, 14:20',
      timestamp: '16 Jul 2026, 14:20',
      userEmail: 'jane@example.com',
      userName: 'Jane Smith',
      deliveryAddress: {
        id: 'addr-2',
        label: 'Work',
        street: '45 Maude Street',
        suburb: 'Sandton',
        city: 'Johannesburg',
        code: '2196',
        isDefault: true,
      },
    },
    {
      id: 'ORD-1232',
      items: [
        { id: '5', name: 'Beef Lasagne', price: 140, category: 'CIAO ITALY', quantity: 1, selectedSize: 'Regular' },
      ],
      total: 140,
      totalPrice: 140,
      status: 'delivered',
      date: '15 Jul 2026, 12:45',
      timestamp: '15 Jul 2026, 12:45',
      userEmail: 'jane@example.com',
      userName: 'Jane Smith',
    },
    {
      id: 'ORD-1231',
      items: [
        { id: '6', name: 'Chicken Bacon & Avocado Wrap', price: 95, category: 'WRAPS & SANDWICHES', quantity: 2, selectedSize: 'Regular' },
        { id: '7', name: 'Lemon & Herb Chicken Pasta Salad', price: 85, category: 'SALADS & BOWLS', quantity: 1 },
        { id: '8', name: 'Sweet Potato Fries', price: 50, category: 'SIDES & SAUCES', quantity: 1 },
      ],
      total: 325,
      totalPrice: 325,
      status: 'delivered',
      date: '14 Jul 2026, 11:20',
      timestamp: '14 Jul 2026, 11:20',
      userEmail: 'mike@example.com',
      userName: 'Mike Johnson',
      deliveryAddress: {
        id: 'addr-3',
        label: 'Home',
        street: '8 Park Lane',
        suburb: 'Parktown',
        city: 'Johannesburg',
        code: '2193',
        isDefault: true,
      },
    },
    {
      id: 'ORD-1230',
      items: [
        { id: '9', name: 'Grilled Chicken Salad', price: 110, category: 'SALADS & BOWLS', quantity: 1, selectedSize: 'Regular' },
      ],
      total: 110,
      totalPrice: 110,
      status: 'cancelled',
      date: '13 Jul 2026, 09:15',
      timestamp: '13 Jul 2026, 09:15',
      userEmail: 'john@example.com',
      userName: 'John Customer',
      deliveryAddress: {
        id: 'addr-1',
        label: 'Home',
        street: '12 Oak Avenue',
        suburb: 'Rivonia',
        city: 'Johannesburg',
        code: '2128',
        isDefault: true,
      },
    },
    {
      id: 'ORD-1229',
      items: [
        { id: '10', name: 'BBQ Chicken Pizza', price: 135, category: 'CIAO ITALY', quantity: 1, selectedSize: 'Large' },
        { id: '11', name: 'Caesar Salad', price: 80, category: 'SALADS & BOWLS', quantity: 1 },
        { id: '12', name: 'Garlic Bread', price: 35, category: 'SIDES & SAUCES', quantity: 2 },
      ],
      total: 285,
      totalPrice: 285,
      status: 'delivered',
      date: '12 Jul 2026, 18:30',
      timestamp: '12 Jul 2026, 18:30',
      userEmail: 'jane@example.com',
      userName: 'Jane Smith',
      deliveryAddress: {
        id: 'addr-2',
        label: 'Work',
        street: '45 Maude Street',
        suburb: 'Sandton',
        city: 'Johannesburg',
        code: '2196',
        isDefault: true,
      },
    },
  ];
  
  return {
    users: demoUsers,
    orders: demoOrders,
  };
}

// Built once per app load and shared by the three lazy useState initialisers,
// so all three describe the same snapshot (the orders reference the users).
let demoSeedCache: DemoSeedData | null = null;
const getDemoSeedData = (): DemoSeedData => {
  if (!demoSeedCache) demoSeedCache = buildDemoSeedData();
  return demoSeedCache;
};

export const KitchenCoContext = createContext<KitchenContextType | undefined>(undefined);

export function KitchenProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>(() => getDemoSeedData().orders);
  const [allUsers, setAllUsers] = useState<AppUser[]>(() => getDemoSeedData().users);

  // Merges the signed-in customer's real orders (from Supabase) in ahead of
  // the seeded demo ones on login/session-restore, so a real placed order
  // — and any earlier ones from a prior session — actually show up in
  // Orders/Activity instead of only existing in the database.
  useEffect(() => {
    if (!user?.email) return;
    fetchMyOrders()
      .then(realOrders => {
        // No rows = no real session (the DEV skip-login buttons) or an empty
        // database: keep the local demo orders so there's still something to show.
        if (realOrders.length === 0) return;
        // The row's own customer wins — an admin's fetch returns everyone's
        // orders, so stamping the signed-in email on them would attribute
        // every order to the admin. Real data replaces the demo set outright
        // rather than mixing fictional orders into real totals.
        setOrders(realOrders.map(o => ({ ...o, userEmail: o.userEmail ?? user.email, userName: o.userName ?? user.name })));
        if (user.role !== 'admin') return;
        fetchUserDirectory()
          .then(directory => {
            const counts = new Map<string, number>();
            realOrders.forEach(o => { if (o.userEmail) counts.set(o.userEmail, (counts.get(o.userEmail) ?? 0) + 1); });
            setAllUsers(directory.map(u => ({ ...u, orderCount: counts.get(u.email) ?? 0 })));
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, [user?.email]);

  // Re-attach persisted feedback once, on mount. Anything for an order id that
  // no longer exists is simply not applied — it stays in storage harmlessly in
  // case that order comes back (e.g. a seed change).
  useEffect(() => {
    AsyncStorage.getItem(ORDER_FEEDBACK_STORAGE_KEY).then(stored => {
      if (!stored) return;
      const saved: Record<string, PersistedOrderFeedback> = JSON.parse(stored);
      setOrders(prev => prev.map(o => (saved[o.id] ? { ...o, ...saved[o.id] } : o)));
    }).catch(() => {
      // Corrupt or unreadable payload: carry on with unannotated orders rather
      // than failing the whole provider.
    });
  }, []);

  /** Mirrors one order's feedback into storage, merged with what is already there. */
  const persistOrderFeedback = (orderId: string, feedback: PersistedOrderFeedback) => {
    AsyncStorage.getItem(ORDER_FEEDBACK_STORAGE_KEY).then(stored => {
      const saved: Record<string, PersistedOrderFeedback> = stored ? JSON.parse(stored) : {};
      saved[orderId] = { ...saved[orderId], ...feedback };
      return AsyncStorage.setItem(ORDER_FEEDBACK_STORAGE_KEY, JSON.stringify(saved));
    }).catch(() => {});
  };
  // A manual "this week is Week N" choice is stored as an offset from the
  // calendar anchor, not as the week number itself — see getCycleWeekForDate.
  const [cycleWeekOffset, setCycleWeekOffset] = useState<number>(0);
  const activeWeek = getCycleWeekForDate(new Date(), cycleWeekOffset);
  const setActiveWeek = (week: number) => setCycleWeekOffset(getCycleOffsetForWeek(week));
  const resetCycleRotation = () => setCycleWeekOffset(0);
  const [orderingForDate, setOrderingForDate] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  // Per-device, not per-account: dismissing a banner is a UI preference, and
  // there is no server to record it against a user anyway.
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  // Loaded from Supabase (menu_categories/menu_items/menu_item_sizes/
  // menu_item_addons) — replaces the old local staticMenu.json build.
  // Admin's add/edit/delete/setActive still mutate this array locally only
  // (not yet written back to the database — a separate follow-up), so an
  // admin edit persists for the session but a page reload reverts to the
  // real catalog underneath it.
  const [menus, setMenus] = useState<MenuCategory[]>([]);
  const [menusLoading, setMenusLoading] = useState(true);
  const refetchMenus = () => fetchMenuCategories().then(categories => setMenus(categories));
  useEffect(() => {
    refetchMenus().catch(() => {}).finally(() => setMenusLoading(false));
  }, []);
  // Loaded from Supabase (companies/company_domains/company_addresses) —
  // replaces the old locally-seeded Ecogra/TATA/RCL companies. RLS scopes
  // what comes back: an admin sees every real company, an employee sees
  // only their own, matching how `menus` already works for the catalog.
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const refetchCompanies = () => fetchCompanies().then(setCompanies);
  // Re-fetches on login/logout, not just on mount — companies_read_own_or_admin
  // scopes the result to the signed-in account (an anon pre-login fetch just
  // comes back empty), same reasoning as fetchMyOrders() below.
  useEffect(() => {
    refetchCompanies().catch(() => {}).finally(() => setCompaniesLoading(false));
  }, [user?.email]);
  // Loaded from Supabase (discounts) — replaces the old locally-seeded
  // WELCOME10/SAVE20 codes. discounts_read_active_or_admin (0002) scopes
  // this the other way from companies: an admin sees every discount
  // (active or not, for management), everyone else sees only active ones.
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(true);
  const refetchDiscounts = () => fetchDiscounts().then(setDiscounts);
  useEffect(() => {
    refetchDiscounts().catch(() => {}).finally(() => setDiscountsLoading(false));
  }, [user?.email]);
  // The discount in force is DERIVED (see appliedDiscount below), not stored.
  // These two hold only the part that is genuinely event-driven: whether the
  // user has overridden the automatic pick, and what they chose. Overriding
  // has to stick, or the next unrelated cart change (a quantity +/- tap)
  // would silently re-pick the "best" discount and undo what they just did.
  const [discountAutoApplyPaused, setDiscountAutoApplyPaused] = useState(false);
  const [userDiscountChoice, setUserDiscountChoice] = useState<Discount | null>(null);
  const setAppliedDiscount = (discount: Discount | null) => {
    setDiscountAutoApplyPaused(true);
    setUserDiscountChoice(discount);
  };
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [orderNote, setOrderNote] = useState<string>('');
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(true);

  // Theme: defaults to light (matching the reference Uber-style design) until
  // the user picks an explicit override in Profile, which is then persisted
  // so it survives an app restart.
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_STORAGE_KEY).then(stored => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeModeState(stored);
      }
    }).catch(() => {});
  }, []);
  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode).catch(() => {});
  };
  // Internal recipient for production/delivery-note emails — the back
  // kitchen's own inbox (or whoever's watching it), not a per-company
  // contact, since these documents never go to the corporate client
  // themselves. Persisted the same way as themeMode, above.
  const [kitchenEmail, setKitchenEmailState] = useState('');
  useEffect(() => {
    AsyncStorage.getItem(KITCHEN_EMAIL_STORAGE_KEY).then(stored => {
      if (stored) setKitchenEmailState(stored);
    }).catch(() => {});
  }, []);
  const setKitchenEmail = (email: string) => {
    setKitchenEmailState(email);
    AsyncStorage.setItem(KITCHEN_EMAIL_STORAGE_KEY, email).catch(() => {});
  };

  const resolvedScheme: ResolvedScheme = themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const isDark = resolvedScheme === 'dark';
  const theme = useMemo(() => getThemeColors(resolvedScheme), [resolvedScheme]);

  // Fly-to-cart: the Menu tab's header owns the actual cart icon position,
  // so it registers the real animation here; every other screen just calls
  // triggerCartFly and gets a safe no-op if nothing is registered.
  const cartFlyHandlerRef = useRef<((fromX: number, fromY: number) => void) | null>(null);
  const registerCartFlyHandler = (handler: ((fromX: number, fromY: number) => void) | null) => {
    cartFlyHandlerRef.current = handler;
  };
  const triggerCartFly = (fromX: number, fromY: number) => {
    cartFlyHandlerRef.current?.(fromX, fromY);
  };
  const [cartPulseSignal, setCartPulseSignal] = useState(0);

  // Keep the single daily "don't forget to order" reminder in sync with
  // cart/order state — re-evaluated (and re-scheduled/cancelled) whenever
  // any of these change. See src/utils/orderReminders.ts for the actual
  // anti-spam rules.
  React.useEffect(() => {
    if (!user || user.role === 'admin') {
      cancelOrderReminder();
      return;
    }
    const todayKey = new Date().toDateString();
    const hasOrderedToday = orders.some(
      o => o.userEmail === user.email && new Date(o.timestamp).toDateString() === todayKey
    );
    syncOrderReminder({
      now: new Date(),
      remindersEnabled,
      hasOrderedToday,
      cartHasItems: cart.length > 0,
    });
  }, [user, orders, cart, remindersEnabled]);

  // Demo data for orders and users

  const login = (email: string, role: string, name?: string, accountType?: AccountType, companyName?: string, companyAddressId?: string) => {
    const newUser = { email, role, name: name || email.split('@')[0], accountType, companyName, companyAddressId };
    setUser(newUser);

    // Track this user in allUsers for admin view
    setAllUsers(prev => {
      const exists = prev.find(u => u.email === email);
      if (exists) {
        // Refresh accountType/companyName too — a company registered after this
        // user's original signup should still get linked on their next sign-in.
        return prev.map(u =>
          u.email === email ? { ...u, accountType, companyName, companyAddressId } : u
        );
      }
      return [...prev, {
        id: createUserId(),
        email,
        role,
        name: name || email.split('@')[0],
        accountType,
        companyName,
        companyAddressId,
        joinedDate: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }),
        orderCount: 0,
      }];
    });
  };

  const logout = () => {
    setUser(null);
    setCart([]);
    setUserDiscountChoice(null);
    setDiscountAutoApplyPaused(false);
    // The next person to sign in must pick their own delivery day rather than
    // inheriting the previous session's — the picker is skipped once this is set.
    setOrderingForDate(null);
    // Fire-and-forget: local state above already gives instant UI feedback,
    // the actual Supabase session teardown doesn't need to block on it.
    signOutUser().catch(() => {});
  };

  const [authLoading, setAuthLoading] = useState(true);

  // Restores the logged-in user from an existing Supabase session on cold
  // start — without this, closing and reopening the app would always land
  // back on the login screen even though the session itself is still valid.
  useEffect(() => {
    restoreSessionUser()
      .then(authedUser => { if (authedUser) setUser(authedUser); })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    const authedUser = await signInWithEmail(email, password);
    setUser(authedUser);
  };

  const signUpWithPassword = async (email: string, password: string, name: string, address?: SignupAddress, preferredCompanyAddressId?: string) => {
    const authedUser = await signUpWithEmail(email, password, name, address, preferredCompanyAddressId);
    setUser(authedUser);
  };

  // The best discount currently available for this cart. Pure derivation of
  // cart/discounts/user — it used to be a useEffect that wrote the result
  // into state, which meant every cart change rendered once with the stale
  // discount and then again with the new one (and briefly showed the wrong
  // price in between). Computing it during render removes that second pass.
  const autoDiscount = useMemo(() => {
    if (cart.length === 0) return null;

    const now = new Date();
    const validDiscounts = discounts.filter(d => {
      if (!d.active) return false;
      if (d.expires && new Date(d.expires) < now) return false;
      return true;
    });

    let bestDiscount: Discount | null = null;
    for (const d of validDiscounts) {
      const hasEligibleItem = cart.some(item => {
        if (d.itemName) return item.name.toLowerCase() === d.itemName.toLowerCase();
        if (d.categoryId) return item.category.toLowerCase() === d.categoryId.toLowerCase();
        // Compared by companyId, not by the display-only `company` name —
        // see Discount.company's doc comment for why the name isn't safe
        // to use here.
        if (d.companyId) return user?.companyId === d.companyId;
        return true; // global
      });
      if (hasEligibleItem) {
        if (!bestDiscount || d.percentage > bestDiscount.percentage) {
          bestDiscount = d;
        }
      }
    }

    return bestDiscount;
  }, [cart, discounts, user]);

  // An empty cart never carries a discount, and once the user has overridden
  // the automatic pick their choice wins until the cart empties (addToCart
  // clears the override when refilling from empty, so a fresh cart gets a
  // fresh suggestion — the same rule the old effect enforced).
  const appliedDiscount = cart.length === 0
    ? null
    : (discountAutoApplyPaused ? userDiscountChoice : autoDiscount);

  const addToCart = (newItem: CartItem) => {
    haptics.light();
    setCartPulseSignal(n => n + 1);
    // Refilling from empty starts a fresh cart, so drop any override the
    // previous cart left behind and let the auto-pick suggest again.
    if (cart.length === 0) {
      setDiscountAutoApplyPaused(false);
      setUserDiscountChoice(null);
    }
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === newItem.id);
      if (existing) {
        return prevCart.map(item =>
          item.id === newItem.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...newItem, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    haptics.light();
    setCart(prevCart =>
      prevCart
        .map(item => (item.id === itemId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter(item => item.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setUserDiscountChoice(null);
    setDiscountAutoApplyPaused(false);
  };

  // Resolves where an order would deliver to and what that costs, without
  // requiring a picker: a personal address the user has explicitly set as
  // default always wins (lets a corporate employee place a personal order
  // elsewhere, or switch after relocating to a different site); otherwise
  // corporate accounts fall back to their company's registered address, and
  // everyone else falls back to whatever saved address they have. Shared by
  // the cart/checkout previews and by placeOrder itself so all three agree.
  // Real delivery address, fetched from Supabase (individuals' own default
  // address, or their company's assigned site) — replaces the old
  // derivation from local mock `savedAddresses`/`companies` state, which
  // isn't tied to real signed-up accounts. Profile's "add address" screen
  // still only writes to that local state, not here, so it won't affect
  // checkout yet — a separate follow-up.
  const [realAddress, setRealAddress] = useState<ResolvedAddress | null>(null);
  useEffect(() => {
    if (!user) return; // cleared in logout() directly, not here
    fetchMyDeliveryAddress(user.accountType, user.companyAddressId)
      .then(setRealAddress)
      .catch(() => setRealAddress(null));
  }, [user?.email, user?.accountType, user?.companyAddressId]);

  const deliveryInfo = useMemo((): { distanceKm: number | null; fee: number | null; address: DeliveryAddress | null; addressLabel: string | null; addressId: string | null } => {
    if (!realAddress) return { distanceKm: null, fee: null, address: null, addressLabel: null, addressId: null };
    if (realAddress.distanceKm == null) {
      return { distanceKm: null, fee: null, address: null, addressLabel: `${realAddress.label} (missing distance)`, addressId: realAddress.id };
    }
    return {
      distanceKm: realAddress.distanceKm,
      fee: calculateDeliveryFee(realAddress.distanceKm),
      address: {
        id: realAddress.id,
        label: realAddress.label,
        street: realAddress.street,
        suburb: realAddress.suburb,
        city: realAddress.city,
        code: realAddress.code ?? '',
        isDefault: true,
        distanceKm: realAddress.distanceKm,
      },
      addressLabel: `${realAddress.label} — ${realAddress.street}`,
      addressId: realAddress.id,
    };
  }, [realAddress]);

  // Calls the real place_order RPC — server re-validates cutoff, re-prices
  // every line from the catalog, resolves discount/subsidy, and mints a
  // real invoice number, so none of that math is recomputed here any more.
  // Throws (CUTOFF_PASSED, UNDELIVERABLE_DISTANCE, ADDRESS_NOT_FOUND, etc.)
  // on failure instead of silently no-op'ing — payfast.tsx is responsible
  // for catching that and not showing a fake success screen.
  const placeOrder = async (deliveryAddress?: DeliveryAddress, paymentReference?: string) => {
    if (cart.length === 0) return;
    const addressId = deliveryAddress?.id ?? deliveryInfo.addressId;
    if (!addressId) throw new Error('NO_DELIVERY_ADDRESS');

    const newOrder = await placeRealOrder(cart, addressId, orderingForDate, paymentReference);
    setOrders(prev => [{ ...newOrder, userEmail: user?.email, userName: user?.name }, ...prev]);

    if (user?.email) {
      setAllUsers(prev =>
        prev.map(u =>
          u.email === user.email ? { ...u, orderCount: u.orderCount + 1 } : u
        )
      );
    }

    setOrderNote('');
    clearCart(); // also resets appliedDiscount + the auto-apply pause flag
  };

  // Menu editing now hits the real database (menu_items/menu_item_sizes,
  // admin-write-gated by 0002) and refetches, rather than patching local
  // state directly — a reload used to revert every admin edit back to the
  // real catalog underneath it; now the edit IS the real catalog.
  const addMenuItem = async (categoryId: string, item: { name: string; price: number; description: string; image?: string }) => {
    await adminCreateMenuItem(categoryId, item);
    await refetchMenus();
  };

  const updateMenuItem = async (categoryId: string, itemId: string, item: { name: string; price: number; description: string; image?: string }) => {
    await adminUpdateMenuItem(itemId, item);
    await refetchMenus();
  };

  /**
   * Shows or hides a dish on the customer menu without deleting it (client
   * review, Sep 2026). Kept separate from `updateMenuItem` because that one
   * rewrites name/description/price from the edit form and would clobber the
   * flag — and because switching a dish off is a one-tap action from the list,
   * not something that should require opening the editor.
   */
  const setMenuItemActive = async (categoryId: string, itemId: string, active: boolean) => {
    await adminSetMenuItemActive(itemId, active);
    await refetchMenus();
  };

  const deleteMenuItem = async (categoryId: string, itemId: string) => {
    await adminDeleteMenuItem(itemId);
    await refetchMenus();
  };

  const sendAnnouncement = ({ title, body, companyName }: { title: string; body: string; companyName: string | null }) => {
    const announcement: Announcement = {
      id: `ann-${Date.now()}`,
      title,
      body,
      companyName,
      sentAt: new Date().toISOString(),
    };
    setAnnouncements(prev => [announcement, ...prev]);
    // Raise it on this device's notification tray too. No-ops on web and
    // whenever permission is refused — the in-app banner is the delivery that
    // always happens, this is the visible confirmation on top of it.
    showAnnouncementNotification(title, body);
  };

  const deleteAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  const dismissAnnouncement = (id: string) => {
    setDismissedAnnouncements(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  // What the signed-in customer should see: announcements addressed to
  // everyone, plus those addressed to their own employer, minus anything they
  // have already dismissed. Admins are excluded — they send these, and seeing
  // their own announcement banner over the menu preview is just noise.
  const visibleAnnouncements = useMemo(() => {
    if (!user || user.role === 'admin') return [];
    return announcements.filter(a =>
      !dismissedAnnouncements.includes(a.id) &&
      (a.companyName === null || a.companyName === user.companyName)
    );
  }, [announcements, dismissedAnnouncements, user]);

  // Discount edits now hit the real database (discounts_write_admin in
  // 0002) and refetch, same pattern as companies/menu items above.
  const addDiscount = async (discount: Discount) => {
    await adminCreateDiscount(discount);
    await refetchDiscounts();
  };

  // Check if a cart item is eligible for a specific discount
  const isItemEligibleForDiscount = (item: CartItem, discount: Discount | null): boolean => {
    if (!discount) return false;
    // If discount has specific itemName, only apply to items with matching name
    if (discount.itemName) {
      return item.name.toLowerCase() === discount.itemName.toLowerCase();
    }
    // If discount has categoryId, only apply to items in that category
    if (discount.categoryId) {
      return item.category.toLowerCase() === discount.categoryId.toLowerCase();
    }
    // If discount targets a specific corporate client, only the matching user's items qualify.
    // Compared by companyId, not the display-only `company` name — see
    // Discount.company's doc comment for why the name isn't safe to use here.
    if (discount.companyId) {
      return user?.companyId === discount.companyId;
    }
    // No targeting specified - apply to all items (global discount)
    return true;
  };

  // Calculate total discount amount for eligible items only
  const calculateDiscountAmount = (cartItems: CartItem[], discount: Discount | null): number => {
    if (!discount) return 0;
    const eligibleTotal = cartItems
      .filter(item => isItemEligibleForDiscount(item, discount))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
    return eligibleTotal * discount.percentage / 100;
  };

  // Company meal subsidy — automatic, no code required. Matched via the same
  // user.companyName the company-targeted discount above uses, so it only
  // kicks in once a user is actually attached to a company (domain
  // auto-match at signup, or companyName set some other way).
  const calculateSubsidyAmount = (cartItems: CartItem[]): number => {
    if (!user?.companyName) return 0;
    const company = companies.find(c => c.name.toLowerCase() === user.companyName!.toLowerCase());
    const subsidy = company?.mealSubsidy;
    if (!subsidy) return 0;
    return cartItems.reduce((sum, item) => sum + Math.min(subsidy, item.price) * item.quantity, 0);
  };

  const updateDiscount = async (discountId: string, discount: Partial<Discount>) => {
    await adminUpdateDiscount(discountId, discount);
    await refetchDiscounts();
  };

  const deleteDiscount = async (discountId: string) => {
    await adminDeleteDiscount(discountId);
    await refetchDiscounts();
  };

  const addUser = (newUser: AppUser) => {
    setAllUsers(prev => [...prev, newUser]);
  };

  const updateUser = (userId: string, updates: Partial<AppUser>) => {
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
  };

  const deleteUser = (userId: string) => {
    setAllUsers(prev => prev.filter(u => u.id !== userId));
  };

  // Corporate client management — companies are matched to users by work-email
  // domain at login. Writes hit the real database (adminCreateCompany etc.,
  // security-checked by companies_write_admin & co. in 0002) and then
  // refetch, rather than optimistically patching local state — the
  // company_addresses diff in adminUpdateCompany can partially fail (an
  // address still assigned to an employee can't be deleted) and the caller
  // needs the server's actual resulting shape, not a guess.
  const addCompany = async (company: Omit<Company, 'id'>) => {
    await adminCreateCompany(company);
    await refetchCompanies();
  };

  const updateCompany = async (companyId: string, updates: Partial<Omit<Company, 'id'>>) => {
    const current = companies.find(c => c.id === companyId);
    const merged = { ...current, ...updates } as Company;
    const result = await adminUpdateCompany(companyId, {
      name: merged.name,
      domains: merged.domains,
      addresses: merged.addresses,
      mealSubsidy: merged.mealSubsidy,
    });
    await refetchCompanies();
    return result;
  };

  const deleteCompany = async (companyId: string) => {
    await adminDeleteCompany(companyId);
    await refetchCompanies();
  };

  // Corporate clients get one physical delivery per batch — every employee
  // at the same company whose order is due the same day rides in that same
  // batch, so their status (preparing/on the way/delivered) is one shared
  // fact, not N individually-tracked orders that happen to match. Guest/
  // individual orders (no matched company) still update alone, since they
  // really are delivered separately.
  const getOrderBatchKey = (order: Order): string | null => {
    if (!order.userEmail) return null;
    const companyName = allUsers.find(u => u.email === order.userEmail)?.companyName;
    if (!companyName) return null;
    const placedAt = new Date(order.timestamp);
    const dueDates = order.items.map(item => {
      const d = getItemDueDate(item, placedAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    return `${companyName}::${dueDates.sort()[0]}`;
  };

  // A real order's batch membership is decided server-side, from the
  // customer's real company_id (see update_order_status in 0003) — the
  // client can't safely re-derive it (getOrderBatchKey depends on
  // `allUsers`, which never contains a real signed-up customer, only the
  // seeded demo roster). So a real order's status update goes through the
  // RPC and patches local state by the id's it actually returns; a demo
  // order (no database row to update) keeps the old local-only simulation
  // so existing seeded scenarios still behave.
  const updateOrderStatus = async (orderId: string, status: string) => {
    if (isRealOrderId(orderId)) {
      const updatedIds = await adminUpdateOrderStatus(orderId, status);
      const idSet = new Set(updatedIds);
      setOrders(prev => prev.map(o => idSet.has(o.id) ? { ...o, status } : o));
      return;
    }
    setOrders(prev => {
      const target = prev.find(o => o.id === orderId);
      if (!target) return prev;
      const batchKey = getOrderBatchKey(target);
      if (!batchKey) {
        return prev.map(o => o.id === orderId ? { ...o, status } : o);
      }
      // A sibling order that's already cancelled opted out of the batch
      // individually — leave it alone rather than reviving it via someone
      // else's status change.
      return prev.map(o => (o.status !== 'cancelled' && getOrderBatchKey(o) === batchKey) ? { ...o, status } : o);
    });
  };

  const submitOrderRating = async (orderId: string, rating: number, feedback?: string) => {
    const trimmedFeedback = feedback?.trim() || undefined;
    const entry: OrderRating = {
      rating,
      feedback: trimmedFeedback,
      submittedAt: new Date().toISOString(),
    };
    if (isRealOrderId(orderId)) {
      await submitRealOrderRating(orderId, rating, trimmedFeedback);
    } else {
      persistOrderFeedback(orderId, { rating: entry });
    }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, rating: entry } : o));
  };

  const reportOrderNonDelivery = async (orderId: string, reason?: string) => {
    const trimmedReason = reason?.trim() || 'Meal not present in designated floor pantry cooler at 12:00 PM';
    // Real orders get the ticket reference the database actually minted
    // (order_disputes.ticket_ref, a real sequence) rather than a locally
    // guessed one, so the reference shown to the customer and quoted in the
    // escalation email is the one support can actually look up.
    const supportTicketRef = isRealOrderId(orderId)
      ? await reportRealOrderDispute(orderId, trimmedReason)
      : `TCK-${Math.floor(10000 + Math.random() * 90000)}`;
    const entry: DisputeInfo = {
      reportedAt: new Date().toISOString(),
      reason: trimmedReason,
      supportTicketRef,
      status: 'investigating',
    };
    if (!isRealOrderId(orderId)) {
      persistOrderFeedback(orderId, { dispute: entry });
    }
    // Per-order only — see the note on the context type: a batch's shared
    // status must not flip because one person's meal went missing.
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, dispute: entry } : o));
    return supportTicketRef;
  };

  // Delivery address management
  const addAddress = (address: DeliveryAddress) => {
    setSavedAddresses(prev => {
      // If this is the first address, make it default
      if (prev.length === 0) {
        return [{ ...address, isDefault: true }];
      }
      // If this new address is set as default, unset others
      if (address.isDefault) {
        return [...prev.map(a => ({ ...a, isDefault: false })), address];
      }
      return [...prev, address];
    });
  };

  const removeAddress = (addressId: string) => {
    setSavedAddresses(prev => {
      const filtered = prev.filter(a => a.id !== addressId);
      // If we removed the default, make the first remaining one default
      if (filtered.length > 0 && !filtered.some(a => a.isDefault)) {
        filtered[0].isDefault = true;
      }
      return filtered;
    });
  };

  const setDefaultAddress = (addressId: string) => {
    setSavedAddresses(prev =>
      prev.map(a => ({ ...a, isDefault: a.id === addressId }))
    );
  };

  // Clears any personal default so a corporate account's deliveryInfo falls
  // back to their company's registered address again (see deliveryInfo).
  const useCompanyAddress = () => {
    setSavedAddresses(prev => prev.map(a => ({ ...a, isDefault: false })));
  };

  // Card management functions
  const saveCard = (card: Omit<SavedCard, 'id' | 'createdAt'>) => {
    const newCard: SavedCard = {
      ...card,
      id: `card-${Date.now()}`,
      createdAt: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
    setSavedCards(prev => [newCard, ...prev]);
  };

  const removeCard = (cardId: string) => {
    setSavedCards(prev => prev.filter(card => card.id !== cardId));
  };

  return (
    <KitchenCoContext.Provider
      value={{
        user,
        cart,
        orders,
        activeWeek,
        setActiveWeek,
        cycleWeekOffset,
        resetCycleRotation,
        orderingForDate,
        setOrderingForDate,
        login,
        logout,
        signInWithPassword,
        signUpWithPassword,
        authLoading,
        addToCart,
        removeFromCart,
        clearCart,
        placeOrder,
        allUsers,
        menus,
        menusLoading,
        refetchMenus,
        discounts,
        discountsLoading,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        setMenuItemActive,
        addDiscount,
        updateDiscount,
        deleteDiscount,
        addUser,
        updateUser,
        deleteUser,
        companies,
        companiesLoading,
        addCompany,
        updateCompany,
        deleteCompany,
        updateOrderStatus,
        submitOrderRating,
        reportOrderNonDelivery,
        savedAddresses,
        addAddress,
        removeAddress,
        setDefaultAddress,
        useCompanyAddress,
        deliveryInfo,
        savedCards,
        saveCard,
        removeCard,
        orderNote,
        setOrderNote,
        appliedDiscount,
        setAppliedDiscount,
        theme,
        themeMode,
        setThemeMode,
        isDark,
        cartPulseSignal,
        triggerCartFly,
        registerCartFlyHandler,
        isItemEligibleForDiscount,
        calculateDiscountAmount,
        calculateSubsidyAmount,
        announcements,
        sendAnnouncement,
        deleteAnnouncement,
        visibleAnnouncements,
        dismissAnnouncement,
        remindersEnabled,
        setRemindersEnabled,
        kitchenEmail,
        setKitchenEmail,
      }}
    >
      {children}
    </KitchenCoContext.Provider>
  );
}

export function useKitchen() {
  const context = useContext(KitchenCoContext);
  if (!context) throw new Error('useKitchen must be used within a KitchenProvider');
  return context;
}
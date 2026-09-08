import React, { createContext, useContext, useState, Dispatch, SetStateAction, useMemo, useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeColors, ThemeMode, ResolvedScheme, getThemeColors } from '../utils/theme';
import { buildMenuFromStaticData, NormalizedMenuItem, AddOnOption } from '../utils/menuNormalize';
import { syncOrderReminder, cancelOrderReminder, showAnnouncementNotification } from '../utils/orderReminders';
import { calculateDeliveryFee, getItemDueDate, getCycleWeekForDate, getCycleOffsetForWeek } from '../utils/deliveryHelpers';
import { haptics } from '../utils/haptics';
import staticMenuData from '../data/staticMenu.json';

export type { AddOnOption };

const THEME_MODE_STORAGE_KEY = 'kitchenco_theme_mode';
const KITCHEN_EMAIL_STORAGE_KEY = 'kitchenco_kitchen_email';

/**
 * Sequential source for new order numbers.
 *
 * These used to be a random 4-digit number (Math.random) — a
 * 9,000-value space that the seeded demo orders already sit inside, giving a
 * ~50% chance of a duplicate within ~112 orders. A duplicate is not cosmetic:
 * updateOrderStatus maps over *every* order matching the id, so one customer's
 * status change would silently move a stranger's order too, and the id is also
 * the FlatList key on the History screen.
 *
 * Starts above the highest seeded id (ORD-1298). Orders are in-memory only
 * today, so this resets per session — when they move server-side, take the id
 * from the backend instead of this counter.
 */
let nextOrderNumber = 1299;

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
  login: (email: string, role: string, name?: string, accountType?: AccountType, companyName?: string, companyAddressId?: string) => void;
  logout: () => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  placeOrder: (deliveryAddress?: DeliveryAddress, paymentReference?: string) => void;
  allUsers: AppUser[];
  menus: MenuCategory[];
  discounts: Discount[];
  addMenuItem: (categoryId: string, item: { name: string; price: number; description: string; image?: string }) => void;
  updateMenuItem: (categoryId: string, itemId: string, item: { name: string; price: number; description: string; image?: string }) => void;
  deleteMenuItem: (categoryId: string, itemId: string) => void;
  /** Hides/shows a dish on the customer menu without deleting it. */
  setMenuItemActive: (categoryId: string, itemId: string, active: boolean) => void;
  addDiscount: (discount: Discount) => void;
  updateDiscount: (discountId: string, discount: Partial<Discount>) => void;
  deleteDiscount: (discountId: string) => void;
  addUser: (user: AppUser) => void;
  updateUser: (userId: string, updates: Partial<AppUser>) => void;
  deleteUser: (userId: string) => void;
  companies: Company[];
  addCompany: (company: Omit<Company, 'id'>) => void;
  updateCompany: (companyId: string, updates: Partial<Omit<Company, 'id'>>) => void;
  deleteCompany: (companyId: string) => void;
  updateOrderStatus: (orderId: string, status: string) => void;
  /** Records a delivered order's star rating and optional feedback. */
  submitOrderRating: (orderId: string, rating: number, feedback?: string) => void;
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
  reportOrderNonDelivery: (orderId: string, reason?: string) => string;
  savedAddresses: DeliveryAddress[];
  addAddress: (address: DeliveryAddress) => void;
  removeAddress: (addressId: string) => void;
  setDefaultAddress: (addressId: string) => void;
  /** Clears any personal default address so a corporate account's deliveryInfo falls back to their company's registered address. */
  useCompanyAddress: () => void;
  /** Auto-resolved delivery destination + distance-based fee for the current user — company address for corporate accounts, default saved address otherwise. */
  deliveryInfo: { distanceKm: number | null; fee: number | null; address: DeliveryAddress | null; addressLabel: string | null };
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
  discounts: Discount[];
}

/**
 * Builds the prototype seed data (demo users, orders and discounts).
 *
 * This used to be a mount-time useEffect calling setAllUsers/setOrders/
 * setDiscounts, so every launch rendered the entire app once against empty
 * state and then immediately re-rendered with the data. It is the initial
 * state now, so the first render already has it — one less full-app render
 * pass on startup, from the provider that re-renders everything.
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
    discounts: [
      { id: '1', code: 'WELCOME10', percentage: 10, active: true, expires: '31 Dec 2026' },
      { id: '2', code: 'SAVE20', percentage: 20, active: true, expires: '30 Aug 2026' },
    ],
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
  const [allUsers, setAllUsers] = useState<AppUser[]>(() => getDemoSeedData().users);
  // Seeded from the same normalized shape the Menu screen renders, so admin
  // edits here are the actual data the customer-facing menu reads — not a
  // parallel array nothing ever displays.
  const [menus, setMenus] = useState<MenuCategory[]>(() => buildMenuFromStaticData(staticMenuData));
  const [discounts, setDiscounts] = useState<Discount[]>(() => getDemoSeedData().discounts);
  const [companies, setCompanies] = useState<Company[]>([
    {
      id: 'co-ecogra',
      name: 'Ecogra',
      domains: ['ecogra.org'],
      // Two seeded sites — demo data proving the multi-address signup
      // picker actually has something to pick between out of the box,
      // rather than only working once an admin adds a second address by
      // hand (which doesn't persist across a reload; this app has no
      // backend yet).
      addresses: [
        {
          id: 'addr-ecogra-1',
          label: 'Head Office',
          street: '160 Jan Smuts Ave',
          suburb: 'Rosebank',
          city: 'Johannesburg',
          code: '',
        },
        {
          id: 'addr-ecogra-2',
          label: 'Sandton Branch',
          street: '1 Sandton Drive',
          suburb: 'Sandton',
          city: 'Johannesburg',
          code: '',
        },
      ],
      mealSubsidy: 80.0,
    },
    {
      id: 'co-tata',
      name: 'TATA',
      domains: ['tcs.com'],
      addresses: [{
        id: 'addr-tata-1',
        label: 'Head Office',
        street: '39 Ferguson Road',
        suburb: 'Illovo',
        city: 'Johannesburg',
        code: '',
      }],
      mealSubsidy: 85.0,
    },
    {
      id: 'co-rcl',
      name: 'RCL',
      domains: ['rclfoods.com'],
      addresses: [{
        id: 'addr-rcl-1',
        label: 'Head Office',
        street: '15 Railey Road',
        suburb: 'Bedfordview',
        city: 'Johannesburg',
        code: '',
      }],
      mealSubsidy: 40.0,
    },
  ]);
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
        if (d.company) return user?.companyName?.toLowerCase() === d.company.toLowerCase();
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
  const deliveryInfo = useMemo((): { distanceKm: number | null; fee: number | null; address: DeliveryAddress | null; addressLabel: string | null } => {
    if (!user) return { distanceKm: null, fee: null, address: null, addressLabel: null };

    const personalDefault = savedAddresses.find(a => a.isDefault) || (!user.companyName ? savedAddresses[0] : null) || null;
    if (personalDefault) {
      if (personalDefault.distanceKm != null) {
        return {
          distanceKm: personalDefault.distanceKm,
          fee: calculateDeliveryFee(personalDefault.distanceKm),
          address: personalDefault,
          addressLabel: `${personalDefault.label} — ${personalDefault.street}`,
        };
      }
      return { distanceKm: null, fee: null, address: null, addressLabel: `${personalDefault.label} (missing distance)` };
    }

    if (user.companyName) {
      const company = companies.find(c => c.name === user.companyName);
      // A company with more than one registered site has each employee pick
      // one at signup (User.companyAddressId) — fall back to the first
      // registered address for anyone signed up before that choice existed,
      // whose company only has the one site, or whose picked address an
      // admin has since deleted.
      const companyAddress = company?.addresses.find(a => a.id === user.companyAddressId) ?? company?.addresses[0];
      if (companyAddress?.distanceKm != null) {
        const resolvedAddress: DeliveryAddress = {
          id: `company-${company!.id}-${companyAddress.id}`,
          label: company!.name,
          street: companyAddress.unit ? `${companyAddress.unit}, ${companyAddress.street}` : companyAddress.street,
          suburb: companyAddress.suburb,
          city: companyAddress.city,
          code: companyAddress.code,
          isDefault: true,
          distanceKm: companyAddress.distanceKm,
        };
        return {
          distanceKm: companyAddress.distanceKm,
          fee: calculateDeliveryFee(companyAddress.distanceKm),
          address: resolvedAddress,
          addressLabel: `${company!.name} — ${companyAddress.street}`,
        };
      }
      return { distanceKm: null, fee: null, address: null, addressLabel: company ? `${company.name} (no delivery address on file)` : null };
    }

    return { distanceKm: null, fee: null, address: null, addressLabel: null };
  }, [user, companies, savedAddresses]);

  const placeOrder = (deliveryAddress?: DeliveryAddress, paymentReference?: string) => {
    if (cart.length === 0) return;
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = calculateDiscountAmount(cart, appliedDiscount);
    const subsidyAmount = calculateSubsidyAmount(cart);
    const resolvedAddress = deliveryAddress ?? deliveryInfo.address ?? undefined;
    const deliveryFee = deliveryAddress ? calculateDeliveryFee(deliveryAddress.distanceKm ?? -1) ?? 0 : (deliveryInfo.fee ?? 0);
    // Floored in case a promo discount and the company subsidy overlap on the
    // same cheap item and would otherwise combine past its price.
    const finalTotal = Math.max(0, totalAmount - discountAmount - subsidyAmount) + deliveryFee;
    const nowStr = new Date().toLocaleString();

    const newOrder: Order = {
      id: `ORD-${nextOrderNumber++}`,
      items: [...cart],
      total: finalTotal,
      totalPrice: totalAmount,
      status: 'pending',
      date: nowStr,
      timestamp: nowStr,
      userEmail: user?.email,
      userName: user?.name,
      deliveryAddress: resolvedAddress,
      deliveryFee: deliveryFee || undefined,
      note: orderNote || undefined,
      discount: appliedDiscount || undefined,
      discountAmount: discountAmount || undefined,
      subsidyAmount: subsidyAmount || undefined,
      paymentReference,
    };
    setOrders(prev => [newOrder, ...prev]);
    
    // Increment user order count
    if (user?.email) {
      setAllUsers(prev =>
        prev.map(u =>
          u.email === user.email ? { ...u, orderCount: u.orderCount + 1 } : u
        )
      );
    }
    
    setOrderNote(''); // Clear note after order is placed
    clearCart(); // also resets appliedDiscount + the auto-apply pause flag
  };

  const addMenuItem = (categoryId: string, item: { name: string; price: number; description: string; image?: string }) => {
    setMenus(prev => prev.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: [...cat.items, {
            id: `item-${Date.now()}`,
            name: item.name,
            description: item.description,
            image: item.image,
            sizes: [{ label: 'Regular', price: item.price }],
            // A newly added dish goes live immediately — an admin who wants it
            // held back can switch it off from the same list they added it in.
            active: true,
          }] }
        : cat
    ));
  };

  const updateMenuItem = (categoryId: string, itemId: string, item: { name: string; price: number; description: string; image?: string }) => {
    setMenus(prev => prev.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: cat.items.map(i => i.id === itemId ? {
            ...i,
            name: item.name,
            description: item.description,
            image: item.image,
            // The admin edit form only ever collects a single price, so an
            // edit collapses multi-size items (e.g. Small/Large) to one size.
            sizes: [{ label: 'Regular', price: item.price }],
          } : i) }
        : cat
    ));
  };

  /**
   * Shows or hides a dish on the customer menu without deleting it (client
   * review, Sep 2026). Kept separate from `updateMenuItem` because that one
   * rewrites name/description/price from the edit form and would clobber the
   * flag — and because switching a dish off is a one-tap action from the list,
   * not something that should require opening the editor.
   */
  const setMenuItemActive = (categoryId: string, itemId: string, active: boolean) => {
    setMenus(prev => prev.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: cat.items.map(i => i.id === itemId ? { ...i, active } : i) }
        : cat
    ));
  };

  const deleteMenuItem = (categoryId: string, itemId: string) => {
    setMenus(prev => prev.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: cat.items.filter(i => i.id !== itemId) }
        : cat
    ));
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

  const addDiscount = (discount: Discount) => {
    setDiscounts(prev => [...prev, { ...discount, id: `disc-${Date.now()}` }]);
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
    // If discount targets a specific corporate client, only the matching user's items qualify
    if (discount.company) {
      return user?.companyName?.toLowerCase() === discount.company.toLowerCase();
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

  const updateDiscount = (discountId: string, discount: Partial<Discount>) => {
    setDiscounts(prev => prev.map(d => d.id === discountId ? { ...d, ...discount } : d));
  };

  const deleteDiscount = (discountId: string) => {
    setDiscounts(prev => prev.filter(d => d.id !== discountId));
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

  // Corporate client management — companies are matched to users by work-email domain at login.
  const addCompany = (company: Omit<Company, 'id'>) => {
    setCompanies(prev => [...prev, { ...company, id: `co-${Date.now()}` }]);
  };

  const updateCompany = (companyId: string, updates: Partial<Omit<Company, 'id'>>) => {
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, ...updates } : c));
  };

  const deleteCompany = (companyId: string) => {
    setCompanies(prev => prev.filter(c => c.id !== companyId));
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

  const updateOrderStatus = (orderId: string, status: string) => {
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

  const submitOrderRating = (orderId: string, rating: number, feedback?: string) => {
    setOrders(prev => prev.map(o => o.id === orderId
      ? { ...o, rating: { rating, feedback: feedback?.trim() || undefined, submittedAt: new Date().toISOString() } }
      : o));
  };

  const reportOrderNonDelivery = (orderId: string, reason?: string) => {
    const supportTicketRef = `TCK-${Math.floor(10000 + Math.random() * 90000)}`;
    // Per-order only — see the note on the context type: a batch's shared
    // status must not flip because one person's meal went missing.
    setOrders(prev => prev.map(o => o.id === orderId
      ? {
          ...o,
          dispute: {
            reportedAt: new Date().toISOString(),
            reason: reason?.trim() || 'Meal not present in designated floor pantry cooler at 12:00 PM',
            supportTicketRef,
            status: 'investigating' as const,
          },
        }
      : o));
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
        addToCart,
        removeFromCart,
        clearCart,
        placeOrder,
        allUsers,
        menus,
        discounts,
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
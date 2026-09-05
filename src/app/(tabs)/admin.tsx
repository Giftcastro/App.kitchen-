import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, StatusBar, ScrollView, Modal, Dimensions, RefreshControl, Linking, Platform } from 'react-native';
import { Text, TextInput } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useKitchen, createUserId, Order, AppUser, Company, AddOnOption } from '../../context/KitchenCoContext';
import { Ionicons } from '@expo/vector-icons';
import { calculateDeliveryFee, getItemDueDate, isSameDay } from '../../utils/deliveryHelpers';
import { ThemeColors } from '../../utils/theme';
import { useSimulatedLoad } from '../../utils/useSimulatedLoad';
import { haptics } from '../../utils/haptics';
import * as Print from 'expo-print';
import * as MailComposer from 'expo-mail-composer';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9500',
  preparing: '#5AC8FA',
  on_the_way: '#22C55E',
  delivered: '#6B6B6B',
  cancelled: '#FF453A',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Received',
  preparing: 'Preparing',
  on_the_way: 'On The Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Forward progression a kitchen order moves through — cancelled is a separate, manual action. */
const STATUS_FLOW = ['pending', 'preparing', 'on_the_way', 'delivered'];

/**
 * Rows of the dashboard's Order Status Breakdown. Colors come from
 * STATUS_COLORS so this chart can never drift from the status badges shown
 * elsewhere. The labels are spelled out here rather than read from
 * STATUS_LABELS because this chart has always said "Pending" where the order
 * badges say "Received" — worth reconciling one day, but not by silently
 * relabelling the chart underneath whoever reads it.
 */
const BREAKDOWN_STATUSES: { status: string; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'on_the_way', label: 'On The Way' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'cancelled', label: 'Cancelled' },
];

/** Most columns the revenue trend will draw, and the plot height in px. */
const MAX_TREND_BUCKETS = 12;
const TREND_PLOT_HEIGHT = 88;

// Deterministic pastel tag per menu category (SANDWICHES, SALAD BAR, ...) for
// the Special Requests manifest — same category always gets the same color
// within a session without maintaining a name->color lookup table, since
// categories are admin-editable/dynamic (menus tab + ad-hoc cycle-menu
// "Week N • Day" categories).
const CATEGORY_PALETTE = [
  { bg: '#FCE4EC', text: '#AD1457' },
  { bg: '#FFF3E0', text: '#E65100' },
  { bg: '#E8F5E9', text: '#2E7D32' },
  { bg: '#E0F7FA', text: '#00838F' },
  { bg: '#EDE7F6', text: '#5E35B1' },
  { bg: '#FFFDE7', text: '#F9A825' },
  { bg: '#E3F2FD', text: '#1565C0' },
  { bg: '#FBE9E7', text: '#D84315' },
];
function getCategoryColor(category: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface ManifestRow {
  customerName: string;
  category: string;
  itemName: string;
  qty: number;
  notes?: string;
}

/** Branded, color-coded HTML table for Print.printToFileAsync — mirrors the printed delivery/special-request sheets the kitchen already hands out (client name + date header, "your kitchen co." brand mark, one row per person/item with a colored category tag and a Notes column). */
function buildDeliveryNoteHtml(clientName: string, dateLabel: string, addressLine: string | undefined, rows: ManifestRow[]): string {
  const rowsHtml = rows.map(row => {
    const [firstName, ...rest] = row.customerName.trim().split(/\s+/);
    const lastName = rest.join(' ') || '—';
    const colors = getCategoryColor(row.category);
    return `<tr>
      <td>${escapeHtml(firstName || '—')}</td>
      <td>${escapeHtml(lastName)}</td>
      <td>${escapeHtml(addressLine || '—')}</td>
      <td><span class="cat" style="background:${colors.bg};color:${colors.text}">${escapeHtml(row.category)}</span></td>
      <td>${escapeHtml(row.itemName)}</td>
      <td class="qty">${row.qty}</td>
      <td>${row.notes ? escapeHtml(row.notes) : '—'}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 28px; color: #111111; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111111; padding-bottom: 12px; margin-bottom: 18px; }
  h1 { font-size: 19px; margin: 0 0 4px; letter-spacing: -0.3px; }
  .meta { font-size: 12px; color: #444444; }
  .brand { font-weight: 800; font-size: 14px; text-align: right; }
  .brand-sub { font-size: 8px; color: #666666; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #111111; color: #ffffff; padding: 7px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e2e2; vertical-align: top; }
  td.qty { font-weight: 800; text-align: center; }
  .cat { display: inline-block; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: 0.2px; white-space: nowrap; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(clientName.toUpperCase())} DELIVERY NOTE</h1>
      <div class="meta">${escapeHtml(dateLabel)}${addressLine ? ' · ' + escapeHtml(addressLine) : ''}</div>
    </div>
    <div>
      <div class="brand">your kitchen co.</div>
      <div class="brand-sub">POWERED BY CSG FOODS</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>First Name</th><th>Last Name</th><th>Delivery Address</th><th>Category</th><th>Item</th><th>Qty</th><th>Notes</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;
}

/** Whole-day, all-clients HTML for Print.printToFileAsync — the kitchen's own cooking-quantity reference (Grand Total + each client's aggregate category totals), as distinct from a single client's per-person Delivery Note above: this is one document covering every company at once, grouped by company, for the back kitchen to cook from — not something any corporate client receives. */
function buildProductionSheetHtml(
  dateLabel: string,
  grandTotal: { name: string; qty: number }[],
  clients: { name: string; address?: string; total: number; categories: { category: string; items: { name: string; qty: number }[] }[] }[]
): string {
  const grandRows = grandTotal.map(g => `<tr><td>${escapeHtml(g.name)}</td><td class="qty">${g.qty}</td></tr>`).join('');
  const clientSections = clients.map(client => {
    const rows = client.categories.flatMap(cat => cat.items.map(item => {
      const colors = getCategoryColor(cat.category);
      return `<tr><td><span class="cat" style="background:${colors.bg};color:${colors.text}">${escapeHtml(cat.category)}</span></td><td>${escapeHtml(item.name)}</td><td class="qty">${item.qty}</td></tr>`;
    })).join('');
    return `
    <div class="client-section">
      <h2>${escapeHtml(client.name)} <span class="client-total">${client.total}x</span></h2>
      ${client.address ? `<div class="meta">${escapeHtml(client.address)}</div>` : ''}
      <table>
        <thead><tr><th>Category</th><th>Item</th><th>Qty</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 28px; color: #111111; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111111; padding-bottom: 12px; margin-bottom: 18px; }
  h1 { font-size: 19px; margin: 0 0 4px; letter-spacing: -0.3px; }
  h2 { font-size: 14px; margin: 22px 0 2px; }
  .client-total { font-weight: 400; color: #666666; font-size: 12px; }
  .meta { font-size: 12px; color: #444444; }
  .brand { font-weight: 800; font-size: 14px; text-align: right; }
  .brand-sub { font-size: 8px; color: #666666; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  th { text-align: left; background: #111111; color: #ffffff; padding: 7px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e2e2; vertical-align: top; }
  td.qty { font-weight: 800; text-align: center; }
  .cat { display: inline-block; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: 0.2px; white-space: nowrap; }
  .client-section { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>PRODUCTION SHEET</h1>
      <div class="meta">${escapeHtml(dateLabel)} · All Clients</div>
    </div>
    <div>
      <div class="brand">your kitchen co.</div>
      <div class="brand-sub">POWERED BY CSG FOODS</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Qty</th></tr></thead>
    <tbody>${grandRows}</tbody>
  </table>
  ${clientSections}
</body>
</html>`;
}

/** Sentinel `sendModalClient` value meaning "the whole day's Production Sheet", not one specific client's Delivery Note — both flows share the same Send modal/state. */
const PRODUCTION_SHEET_SENTINEL = '__PRODUCTION_SHEET__';

// Dashboard reporting-period filter — scopes the revenue/order stats below
// "Today at a Glance" (which stays live/unfiltered, since "due today" and
// "awaiting acceptance" are operational right-now facts, not historical
// reporting). `days` is undefined for the two presets that aren't a fixed
// lookback window.
type DateFilterKey = '7d' | '14d' | '30d' | '90d' | '180d' | 'all' | 'custom';
const DATE_FILTER_PRESETS: { key: DateFilterKey; label: string; days?: number }[] = [
  { key: 'all', label: 'All Time' },
  { key: '7d', label: '7 Days', days: 7 },
  { key: '14d', label: '2 Weeks', days: 14 },
  { key: '30d', label: '1 Month', days: 30 },
  { key: '90d', label: '3 Months', days: 90 },
  { key: '180d', label: '6 Months', days: 180 },
  { key: 'custom', label: 'Custom' },
];

type TabType = 'dashboard' | 'users' | 'orders' | 'chef' | 'weeks' | 'meals' | 'discounts' | 'companies';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_ICONS: Record<TabType, string> = {
  dashboard: 'speedometer',
  users: 'people',
  orders: 'receipt',
  chef: 'restaurant-outline',
  weeks: 'calendar',
  meals: 'restaurant',
  discounts: 'pricetag',
  companies: 'business',
};

export default function AdminScreen() {
    const { orders, activeWeek, setActiveWeek, allUsers, discounts, addDiscount, updateDiscount, deleteDiscount, deleteUser, addUser, menus, companies, addCompany, deleteCompany, updateOrderStatus, theme, kitchenEmail, setKitchenEmail } = useKitchen();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { refreshing, refresh } = useSimulatedLoad();
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<TabType>('dashboard');
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountExpiry, setDiscountExpiry] = useState('');
  const [discountExpiryError, setDiscountExpiryError] = useState('');
  const [discountCompany, setDiscountCompany] = useState('');
  const [discountCategory, setDiscountCategory] = useState<string | null>(null);
  const [discountItem, setDiscountItem] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDomains, setNewCompanyDomains] = useState('');
  const [newCompanyStreet, setNewCompanyStreet] = useState('');
  const [newCompanyUnit, setNewCompanyUnit] = useState('');
  const [newCompanySuburb, setNewCompanySuburb] = useState('');
  const [newCompanyCity, setNewCompanyCity] = useState('');
  const [newCompanyCode, setNewCompanyCode] = useState('');
  const [newCompanyDistance, setNewCompanyDistance] = useState('');
  const [newCompanyInstructions, setNewCompanyInstructions] = useState('');
  const [newCompanySubsidy, setNewCompanySubsidy] = useState('');
  // Second registered site (optional) — some companies deliver to two
  // locations, and each employee picks between them at signup.
  const [showSecondLocation, setShowSecondLocation] = useState(false);
  const [newCompanyStreet2, setNewCompanyStreet2] = useState('');
  const [newCompanyUnit2, setNewCompanyUnit2] = useState('');
  const [newCompanySuburb2, setNewCompanySuburb2] = useState('');
  const [newCompanyCity2, setNewCompanyCity2] = useState('');
  const [newCompanyCode2, setNewCompanyCode2] = useState('');
  const [newCompanyDistance2, setNewCompanyDistance2] = useState('');
  const [showKitchenEmailModal, setShowKitchenEmailModal] = useState(false);
  const [kitchenEmailDraft, setKitchenEmailDraft] = useState('');
  const [kitchenEmailError, setKitchenEmailError] = useState('');
  // Which revenue-trend column is currently being read. Held as an index
  // rather than a bucket key and validated at render time, so switching the
  // reporting period just falls back to the summary caption — no reset needed.
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  // Scroll target for the Chef tab's "show this client in the sheet" jump.
  const scrollRef = useRef<ScrollView>(null);
  // Shared by the Dashboard's Kitchen Notifications card and the Chef tab's
  // "no kitchen email set" warning, so both open the editor the same way.
  const openKitchenEmailModal = () => {
    setKitchenEmailDraft(kitchenEmail);
    setKitchenEmailError('');
    setShowKitchenEmailModal(true);
  };
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [customDateError, setCustomDateError] = useState('');

  const handleSaveKitchenEmail = () => {
    const email = kitchenEmailDraft.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setKitchenEmailError('Enter a valid email address');
      return;
    }
    setKitchenEmail(email);
    haptics.success();
    setShowKitchenEmailModal(false);
  };

  const handleApplyCustomDate = () => {
    const start = new Date(customStart.trim());
    const end = new Date(customEnd.trim());
    if (!customStart.trim() || !customEnd.trim() || isNaN(start.getTime()) || isNaN(end.getTime())) {
      setCustomDateError('Enter valid dates, e.g. 1 Aug 2026');
      return;
    }
    if (start > end) {
      setCustomDateError('Start date must be before end date');
      return;
    }
    setDateFilter('custom');
    setShowCustomDateModal(false);
  };

  // Resolved [start, end] window for the active preset — null means "All
  // Time" (no filtering). Computed once here and reused by every stat below
  // instead of each one re-deriving "N days ago" independently.
  const dateRange = useMemo(() => {
    if (dateFilter === 'all') return null;
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (dateFilter === 'custom') {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
      return {
        start: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0),
        end: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999),
      };
    }
    const preset = DATE_FILTER_PRESETS.find(p => p.key === dateFilter);
    if (!preset?.days) return null;
    const start = new Date(now);
    start.setDate(start.getDate() - preset.days);
    start.setHours(0, 0, 0, 0);
    return { start, end: endOfToday };
  }, [dateFilter, customStart, customEnd]);

  // Orders placed within the reporting window — feeds every stat/report
  // section on the Dashboard except "Today at a Glance" (deliberately live/
  // unfiltered). A malformed/legacy timestamp is kept rather than silently
  // dropped, so old demo data never vanishes from "All Time".
  const filteredOrders = useMemo(() => {
    if (!dateRange) return orders;
    return orders.filter(o => {
      const d = new Date(o.timestamp);
      if (isNaN(d.getTime())) return true;
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [orders, dateRange]);

  const filteredUsers = useMemo(() => {
    if (!dateRange) return allUsers;
    return allUsers.filter(u => {
      const d = new Date(u.joinedDate);
      if (isNaN(d.getTime())) return true;
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [allUsers, dateRange]);

  // Stats — one pass over `filteredOrders` instead of five (four separate
  // .filter() calls plus a .reduce()), and memoized so it only recomputes
  // when the filtered set actually changes rather than on every render of
  // this screen (which has a lot of unrelated form state — company/user/
  // discount inputs — each keystroke in any of them was re-scanning the
  // full orders array 5x). Respects the reporting-period filter above.
  const totalUsers = filteredUsers.length;
  const totalOrders = filteredOrders.length;
  // Counts keyed by status instead of one named accumulator per status. Adding
  // a row to the breakdown is then a data change rather than a code change —
  // `cancelled` was previously accumulated nowhere and so was missing from the
  // chart entirely, which is exactly the drift this shape avoids.
  const { byStatus, revenue } = useMemo(() => {
    const counts: Record<string, number> = {};
    let rev = 0;
    for (const o of filteredOrders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
      rev += o.total;
    }
    return { byStatus: counts, revenue: rev };
  }, [filteredOrders]);
  const pendingOrders = byStatus.pending || 0;
  const preparingOrders = byStatus.preparing || 0;

  // Revenue trend — one column per time bucket across the reporting period.
  // The bucket unit widens with the window (daily, then weekly, then monthly)
  // so a 6-month view is a dozen readable columns rather than 180 hairlines,
  // and only the most recent MAX_TREND_BUCKETS are kept. Returns null when
  // there is nothing worth drawing: one column is a stat, not a chart.
  const revenueTrend = useMemo(() => {
    const dated = filteredOrders
      .map(o => ({ at: new Date(o.timestamp), total: o.total }))
      .filter(x => !isNaN(x.at.getTime()))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    if (dated.length === 0) return null;

    const start = dateRange ? dateRange.start : dated[0].at;
    const end = dateRange ? dateRange.end : dated[dated.length - 1].at;
    const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const unit: 'day' | 'week' | 'month' =
      spanDays <= MAX_TREND_BUCKETS ? 'day'
        : spanDays <= MAX_TREND_BUCKETS * 7 ? 'week'
          : 'month';

    // Normalise a date to the start of its bucket so everything in the same
    // day/week/month collapses onto one key. Weeks run Monday-first, matching
    // how the kitchen already talks about its menu cycle.
    const bucketStart = (d: Date) => {
      const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (unit === 'week') b.setDate(b.getDate() - ((b.getDay() + 6) % 7));
      else if (unit === 'month') b.setDate(1);
      return b;
    };

    const totals = new Map<number, number>();
    dated.forEach(({ at, total }) => {
      const k = bucketStart(at).getTime();
      totals.set(k, (totals.get(k) || 0) + total);
    });

    // Walk the window itself rather than only the buckets that have orders, so
    // a quiet week reads as a gap in the trend instead of vanishing and making
    // the surrounding weeks look adjacent.
    const buckets: { key: number; label: string; total: number }[] = [];
    const cursor = bucketStart(start);
    const lastBucket = bucketStart(end);
    while (cursor.getTime() <= lastBucket.getTime() && buckets.length < 400) {
      buckets.push({
        key: cursor.getTime(),
        label: unit === 'month'
          ? cursor.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' })
          : cursor.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
        total: totals.get(cursor.getTime()) || 0,
      });
      if (unit === 'day') cursor.setDate(cursor.getDate() + 1);
      else if (unit === 'week') cursor.setDate(cursor.getDate() + 7);
      else cursor.setMonth(cursor.getMonth() + 1);
    }

    const recent = buckets.slice(-MAX_TREND_BUCKETS);
    if (recent.length < 2) return null;
    return {
      buckets: recent,
      max: Math.max(...recent.map(b => b.total)),
      total: recent.reduce((sum, b) => sum + b.total, 0),
      unit,
      unitLabel: unit === 'day' ? 'Daily' : unit === 'week' ? 'Weekly' : 'Monthly',
    };
  }, [filteredOrders, dateRange]);

  // Orders with at least one item due for delivery TODAY — delivery date
  // lives per-item (not per-order, since one order can mix items scheduled
  // for different days), so this can't be a simple field lookup. An item's
  // due date is either its own pre-booked date, or — for a normal, undated
  // order — the earliest date the order as a whole would have been
  // computed for at the moment it was placed. Already-resolved orders
  // (delivered/cancelled) are excluded since there's nothing left to act on.
  const dueTodayOrders = useMemo(() => {
    const today = new Date();
    return orders
      .filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
      .map(o => {
        const placedAt = new Date(o.timestamp);
        const dueItems = o.items.filter(item => isSameDay(getItemDueDate(item, placedAt), today));
        const dueItemCount = dueItems.reduce((sum, item) => sum + item.quantity, 0);
        return { order: o, dueItemCount };
      })
      .filter(x => x.dueItemCount > 0)
      .sort((a, b) => b.dueItemCount - a.dueItemCount);
  }, [orders]);

  // Grouped for the "Today at a Glance" preview list — same "corporate
  // client = one unit" treatment already applied to the Chef tab and Orders
  // tab: a company with many employees ordering today collapses to one row
  // instead of pushing individual names out of a 4-row preview (or a
  // 40-row one, at real scale). The numeric "N Orders Due Today" tile above
  // still counts every individual order — only this list is grouped.
  const dueTodayEntries = useMemo(() => {
    const emailToCompany = new Map<string, string>();
    allUsers.forEach(u => { if (u.companyName) emailToCompany.set(u.email, u.companyName); });

    const batches = new Map<string, { orders: Order[]; dueItemCount: number }>();
    const singles: { key: string; title: string; subtitle: string; isBatch: boolean; status: string; dueItemCount: number }[] = [];

    dueTodayOrders.forEach(({ order, dueItemCount }) => {
      const companyName = order.userEmail ? emailToCompany.get(order.userEmail) : undefined;
      if (!companyName) {
        singles.push({ key: order.id, title: order.id, subtitle: order.userName || 'Guest', isBatch: false, status: order.status, dueItemCount });
        return;
      }
      const entry = batches.get(companyName) ?? { orders: [], dueItemCount: 0 };
      entry.orders.push(order);
      entry.dueItemCount += dueItemCount;
      batches.set(companyName, entry);
    });

    const batchEntries = Array.from(batches.entries()).map(([companyName, b]) => ({
      key: companyName,
      title: companyName,
      subtitle: `${b.orders.length} order${b.orders.length === 1 ? '' : 's'}`,
      isBatch: true,
      status: b.orders[0].status,
      dueItemCount: b.dueItemCount,
    }));

    return [...batchEntries, ...singles].sort((a, b) => b.dueItemCount - a.dueItemCount);
  }, [dueTodayOrders, allUsers]);

  // "Awaiting Acceptance" (Today at a Glance) needs every currently-pending
  // order regardless of the reporting-period filter below — a pending order
  // placed 3 months ago still needs action right now, and shouldn't vanish
  // from this live tile just because the reporting period is set to "7
  // Days". Deliberately separate from the filtered `pendingOrders` used in
  // Order Status Breakdown, which *should* respect the selected period.
  const pendingOrdersLive = useMemo(() => orders.filter(o => o.status === 'pending').length, [orders]);

  // Reporting aggregates for the Dashboard — this is the exact shape of data
  // that'll eventually feed the Power BI embed (Section 2.4 of the SLA):
  // revenue by category, top-selling items, and revenue by corporate client.
  const revenueByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredOrders.forEach(o => o.items.forEach(item => {
      map.set(item.category, (map.get(item.category) || 0) + item.price * item.quantity);
    }));
    const maxVal = Math.max(1, ...Array.from(map.values()));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, total]) => ({ category, total, pct: (total / maxVal) * 100 }));
  }, [filteredOrders]);

  // Every catalog item, not just ones that happen to appear in an order —
  // seeded at 0 so a dish nobody ordered in the selected period shows up as
  // a real zero, rather than silently not existing in this list at all.
  // Feeds both Top Selling Items (best performers) and Slow Movers (worst,
  // including true zero-sellers) below.
  const itemSales = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    menus.forEach(cat => cat.items.forEach(item => {
      if (!map.has(item.name)) map.set(item.name, { qty: 0, revenue: 0 });
    }));
    filteredOrders.forEach(o => o.items.forEach(item => {
      const cur = map.get(item.name) || { qty: 0, revenue: 0 };
      cur.qty += item.quantity;
      cur.revenue += item.price * item.quantity;
      map.set(item.name, cur);
    }));
    return Array.from(map.entries()).map(([name, stats]) => ({ name, ...stats }));
  }, [menus, filteredOrders]);

  const topItems = useMemo(
    () => [...itemSales].filter(i => i.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 5),
    [itemSales]
  );

  const slowMovers = useMemo(
    () => [...itemSales].sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name)).slice(0, 5),
    [itemSales]
  );

  // Single pass over allUsers + a single pass over filteredOrders, using a
  // email -> companyName index, instead of re-scanning allUsers and orders
  // once per company (was O(companies x (users + orders)); this is
  // O(users + orders + companies)). employeeCountByCompany deliberately
  // stays unfiltered — "how many employees does this company have" is a
  // current headcount fact (also reused by the Companies tab's badge), not
  // something scoped to the reporting period; only the order/revenue side
  // respects the date filter.
  const { employeeCountByCompany, orderStatsByCompany } = useMemo(() => {
    const emailToCompany = new Map<string, string>();
    const employeeCountByCompany = new Map<string, number>();
    for (const u of allUsers) {
      if (!u.companyName) continue;
      emailToCompany.set(u.email, u.companyName);
      employeeCountByCompany.set(u.companyName, (employeeCountByCompany.get(u.companyName) ?? 0) + 1);
    }
    const orderStatsByCompany = new Map<string, { orderCount: number; revenue: number }>();
    for (const o of filteredOrders) {
      const companyName = o.userEmail ? emailToCompany.get(o.userEmail) : undefined;
      if (!companyName) continue;
      const stats = orderStatsByCompany.get(companyName) ?? { orderCount: 0, revenue: 0 };
      stats.orderCount++;
      stats.revenue += o.total;
      orderStatsByCompany.set(companyName, stats);
    }
    return { employeeCountByCompany, orderStatsByCompany };
  }, [allUsers, filteredOrders]);

  const companyStats = useMemo(() => {
    return companies
      .map(co => {
        const stats = orderStatsByCompany.get(co.name);
        return { company: co, orderCount: stats?.orderCount ?? 0, revenue: stats?.revenue ?? 0 };
      })
      .filter(c => c.orderCount > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [companies, orderStatsByCompany]);

    const tabs: TabType[] = ['dashboard', 'users', 'orders', 'chef', 'weeks', 'meals', 'discounts', 'companies'];

  // Menu categories for discount targeting — sourced from the same live
  // `menus` data admin's Meals tab edits, so a newly-added item can be
  // targeted immediately.
  const categories = menus;

  const handleAddDiscount = () => {
    if (!discountCode || !discountPercent) return;
    if (discountExpiry.trim() && isNaN(new Date(discountExpiry.trim()).getTime())) {
      setDiscountExpiryError('Enter a valid date, e.g. 31 Dec 2026');
      return;
    }
    addDiscount({
      id: '',
      code: discountCode,
      percentage: parseInt(discountPercent),
      active: true,
      expires: discountExpiry.trim() || undefined,
      company: discountCompany || undefined,
      categoryId: discountCategory || undefined,
      itemName: discountItem || undefined,
    });
    haptics.success();
    setDiscountCode('');
    setDiscountPercent('');
    setDiscountExpiry('');
    setDiscountExpiryError('');
    setDiscountCompany('');
    setDiscountCategory(null);
    setDiscountItem(null);
    setShowAddDiscount(false);
  };

  const handleAddCompany = () => {
    if (!newCompanyName.trim() || !newCompanyDomains.trim()) return;
    const domains = newCompanyDomains
      .split(',')
      .map(d => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
    if (domains.length === 0) return;
    const hasAddress = newCompanyStreet.trim() && newCompanySuburb.trim() && newCompanyCity.trim();
    const hasAddress2 = newCompanyStreet2.trim() && newCompanySuburb2.trim() && newCompanyCity2.trim();
    const parsedDistance = parseFloat(newCompanyDistance);
    const parsedDistance2 = parseFloat(newCompanyDistance2);
    const parsedSubsidy = parseFloat(newCompanySubsidy);
    addCompany({
      name: newCompanyName.trim(),
      domains,
      address: hasAddress ? {
        street: newCompanyStreet.trim(),
        unit: newCompanyUnit.trim() || undefined,
        suburb: newCompanySuburb.trim(),
        city: newCompanyCity.trim(),
        code: newCompanyCode.trim(),
        instructions: newCompanyInstructions.trim() || undefined,
        distanceKm: Number.isFinite(parsedDistance) ? parsedDistance : undefined,
      } : undefined,
      address2: hasAddress2 ? {
        street: newCompanyStreet2.trim(),
        unit: newCompanyUnit2.trim() || undefined,
        suburb: newCompanySuburb2.trim(),
        city: newCompanyCity2.trim(),
        code: newCompanyCode2.trim(),
        distanceKm: Number.isFinite(parsedDistance2) ? parsedDistance2 : undefined,
      } : undefined,
      mealSubsidy: Number.isFinite(parsedSubsidy) && parsedSubsidy > 0 ? parsedSubsidy : undefined,
    });
    haptics.success();
    setNewCompanyName('');
    setNewCompanyDomains('');
    setNewCompanyStreet('');
    setNewCompanyUnit('');
    setNewCompanySuburb('');
    setNewCompanyCity('');
    setNewCompanyCode('');
    setNewCompanyDistance('');
    setNewCompanyInstructions('');
    setNewCompanySubsidy('');
    setShowSecondLocation(false);
    setNewCompanyStreet2('');
    setNewCompanyUnit2('');
    setNewCompanySuburb2('');
    setNewCompanyCity2('');
    setNewCompanyCode2('');
    setNewCompanyDistance2('');
    setShowAddCompany(false);
  };

  const handleAddUser = () => {
    if (newUserName && newUserEmail) {
      const newUser: AppUser = {
        id: createUserId(),
        name: newUserName,
        email: newUserEmail,
        role: 'customer',
        joinedDate: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }),
        orderCount: 0,
      };
      addUser(newUser);
      haptics.success();
      setNewUserName('');
      setNewUserEmail('');
      setShowAddUser(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />

      {/* Shell header — identity + the one action that matters everywhere: previewing the live app */}
      <View style={styles.shellHeader}>
        <View>
          <Text style={styles.shellTitle}>Kitchen Controls</Text>
          <Text style={styles.shellSubtitle}>Managing Kitchen Co.</Text>
        </View>
        <TouchableOpacity
          style={styles.previewBtn}
          onPress={() => router.push('/')}
          testID="preview-as-customer-button"
          accessibilityRole="button"
          accessibilityLabel="Preview app as customer"
        >
          <Ionicons name="eye" size={16} color={theme.text} />
          <Text style={styles.previewBtnText}>Preview App</Text>
        </TouchableOpacity>
      </View>

      {/* Nav — horizontal scroll so it never crowds on phones now that there are 7 sections */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {tabs.map((key) => {
          const isActive = selectedTab === key;
          const label = key.charAt(0).toUpperCase() + key.slice(1);
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tabPill, isActive && styles.tabPillActive]}
              onPress={() => { haptics.selection(); setSelectedTab(key); }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${label} tab`}
            >
              <Ionicons
                name={TAB_ICONS[key] as any}
                size={16}
                color={isActive ? theme.onAccent : theme.textSecondary}
              />
              <Text style={[styles.tabPillLabel, isActive && styles.tabPillLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.text} colors={[theme.text]} />}
      >
        {selectedTab === 'dashboard' && (
          <>
            {/* Header */}
            <View style={styles.pageHeader}>
              <Text style={styles.greeting}>Kitchen Dashboard</Text>
              <Text style={styles.greetingSub}>Your restaurant at a glance</Text>
            </View>

            {/* Today at a Glance — the two things that actually need action
                right now, ahead of the retrospective stats below. */}
            <View style={styles.todayCard}>
              <View style={styles.todayCardHeader}>
                <Ionicons name="today" size={16} color={theme.text} />
                <Text style={styles.todayCardTitle}>Today at a Glance</Text>
              </View>
              <View style={styles.todayCardRow}>
                <TouchableOpacity style={styles.todayTile} onPress={() => setSelectedTab('orders')} activeOpacity={0.7}>
                  <Text style={styles.todayTileNumber}>{dueTodayOrders.length}</Text>
                  <Text style={styles.todayTileLabel}>Order{dueTodayOrders.length === 1 ? '' : 's'} Due Today</Text>
                </TouchableOpacity>
                <View style={styles.todayTileDivider} />
                <TouchableOpacity style={styles.todayTile} onPress={() => setSelectedTab('orders')} activeOpacity={0.7}>
                  <Text style={[styles.todayTileNumber, pendingOrdersLive > 0 && styles.todayTileNumberAlert]}>{pendingOrdersLive}</Text>
                  <Text style={styles.todayTileLabel}>Awaiting Acceptance</Text>
                </TouchableOpacity>
              </View>
              {dueTodayEntries.length > 0 && (
                <View style={styles.todayList}>
                  {dueTodayEntries.slice(0, 4).map((entry, idx) => (
                    <TouchableOpacity
                      key={entry.key}
                      style={[styles.todayListRow, idx === 0 && { borderTopWidth: 0 }]}
                      onPress={() => setSelectedTab(entry.isBatch ? 'chef' : 'orders')}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.todayListStatusDot, { backgroundColor: STATUS_COLORS[entry.status] || '#6B6B6B' }]} />
                      {entry.isBatch && <Ionicons name="business" size={12} color={theme.textSecondary} style={{ marginRight: -2 }} />}
                      <Text style={styles.todayListId}>{entry.title}</Text>
                      <Text style={styles.todayListName} numberOfLines={1}>{entry.subtitle}</Text>
                      <Text style={styles.todayListQty}>{entry.dueItemCount} item{entry.dueItemCount === 1 ? '' : 's'}</Text>
                    </TouchableOpacity>
                  ))}
                  {dueTodayEntries.length > 4 && (
                    <TouchableOpacity onPress={() => setSelectedTab('orders')} style={styles.todayListMore}>
                      <Text style={styles.todayListMoreText}>+{dueTodayEntries.length - 4} more due today</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Reporting Period — scopes everything below (stats, breakdowns,
                revenue, recent orders); "Today at a Glance" above stays live. */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>Reporting Period</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPickerRow}>
                {DATE_FILTER_PRESETS.map(preset => {
                  const isActive = dateFilter === preset.key;
                  const label = preset.key === 'custom' && dateFilter === 'custom' && customStart && customEnd
                    ? `${customStart} – ${customEnd}`
                    : preset.label;
                  return (
                    <TouchableOpacity
                      key={preset.key}
                      style={[styles.categoryPickerChip, isActive && styles.categoryPickerChipActive]}
                      onPress={() => {
                        haptics.selection();
                        if (preset.key === 'custom') {
                          setCustomDateError('');
                          setShowCustomDateModal(true);
                        } else {
                          setDateFilter(preset.key);
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={[styles.categoryPickerChipText, isActive && styles.categoryPickerChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Stats Grid — one config row per card. Each now opens the tab it
                summarises, matching the "Today at a Glance" tiles above, which
                were already tappable while these four looked identical and did
                nothing. Colors are carried over verbatim from the four
                hand-written cards this replaced — including the Revenue card's
                black accent bar and light icon wrap, which disappear/glare in
                dark mode. That is a known defect left as-is on purpose; it is
                now a one-line change here rather than a hunt through JSX. */}
            <View style={styles.statsGrid}>
              {([
                { key: 'users', icon: 'people', color: '#5AC8FA', iconBg: '#5AC8FA20', value: String(totalUsers), label: 'Total Users', tab: 'users' },
                { key: 'orders', icon: 'receipt', color: '#22C55E', iconBg: '#22C55E20', value: String(totalOrders), label: 'Total Orders', tab: 'orders' },
                { key: 'progress', icon: 'time', color: '#FF9500', iconBg: '#FF950020', value: String(pendingOrders + preparingOrders), label: 'In Progress', tab: 'chef' },
                { key: 'revenue', icon: 'cash', color: '#000000', iconBg: '#F6F6F6', value: `R${revenue.toFixed(0)}`, label: 'Revenue', tab: 'orders' },
              ] as { key: string; icon: string; color: string; iconBg: string; value: string; label: string; tab: TabType }[]).map(card => (
                <TouchableOpacity
                  key={card.key}
                  style={styles.statCard}
                  onPress={() => { haptics.selection(); setSelectedTab(card.tab); }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${card.label}: ${card.value}`}
                >
                  <View style={[styles.statAccentBar, { backgroundColor: card.color }]} />
                  <View style={[styles.statIconWrap, { backgroundColor: card.iconBg }]}>
                    <Ionicons name={card.icon as any} size={18} color={card.color} />
                  </View>
                  <Text style={styles.statNumber}>{card.value}</Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Order Status Breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>Order Status Breakdown</Text>
              <View style={styles.breakdownContainer}>
                {BREAKDOWN_STATUSES.map(({ status, label }) => {
                  const count = byStatus[status] || 0;
                  const color = STATUS_COLORS[status];
                  return (
                    <View key={status} style={styles.breakdownRow}>
                      <View style={styles.breakdownLeft}>
                        <View style={[styles.breakdownDot, { backgroundColor: color }]} />
                        <Text style={styles.breakdownLabel}>{label}</Text>
                      </View>
                      <View style={styles.breakdownBarBg}>
                        <View style={[styles.breakdownBarFill, { width: `${totalOrders > 0 ? (count / totalOrders) * 100 : 0}%`, backgroundColor: color }]} />
                      </View>
                      <Text style={styles.breakdownCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Active Week Card */}
            <View style={styles.weekCard}>
              <View style={styles.weekCardLeft}>
                <View style={styles.weekCardIconWrap}>
                  <Ionicons name="calendar" size={24} color="#22C55E" />
                </View>
                <View>
                  <Text style={styles.weekCardLabel}>Active Menu Cycle</Text>
                  <Text style={styles.weekCardValue}>Week {activeWeek}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.weekCardBtn} onPress={() => setSelectedTab('weeks')}>
                <Text style={styles.weekCardBtnText}>Change</Text>
              </TouchableOpacity>
            </View>

            {/* Kitchen Notifications — where Chef tab "Send" (Production Sheet / Delivery Note) defaults its recipient. Internal back-of-house inbox, not a client contact. */}
            <View style={styles.weekCard}>
              <View style={styles.weekCardLeft}>
                <View style={[styles.weekCardIconWrap, { backgroundColor: '#5AC8FA20' }]}>
                  <Ionicons name="mail" size={22} color="#5AC8FA" />
                </View>
                <View>
                  <Text style={styles.weekCardLabel}>Kitchen Notifications</Text>
                  <Text style={styles.weekCardValue} numberOfLines={1}>{kitchenEmail || 'Not set'}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.weekCardBtn}
                onPress={openKitchenEmailModal}
                accessibilityRole="button"
                accessibilityLabel="Edit kitchen notification email"
              >
                <Text style={styles.weekCardBtnText}>{kitchenEmail ? 'Change' : 'Set'}</Text>
              </TouchableOpacity>
            </View>

            {/* Revenue Trend — one series, so no legend: the card title names
                it. Past buckets sit in the de-emphasis ink with the most
                recent one in full ink, which is the "current period" emphasis
                a trend strip exists for. Values are read by tapping a column
                (touch's answer to hover) rather than printing a number above
                every bar, and only the first and last bucket are labelled. */}
            {revenueTrend && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionCardTitle}>Revenue Trend</Text>
                <Text style={styles.trendCaption}>
                  {selectedBucket !== null && revenueTrend.buckets[selectedBucket]
                    ? `${revenueTrend.buckets[selectedBucket].label} · R${revenueTrend.buckets[selectedBucket].total.toFixed(0)}`
                    : `${revenueTrend.unitLabel} · R${revenueTrend.total.toFixed(0)} across ${revenueTrend.buckets.length} ${revenueTrend.unit === 'day' ? 'days' : revenueTrend.unit === 'week' ? 'weeks' : 'months'}`}
                </Text>
                <View style={styles.trendPlot}>
                  {revenueTrend.buckets.map((bucket, idx) => {
                    // Exactly one column carries full ink, and it is whichever
                    // one the caption is describing: the tapped bucket while a
                    // selection is active, otherwise the most recent period.
                    // Emphasising both at once made "selected" and "latest"
                    // indistinguishable.
                    const hasSelection = selectedBucket !== null && !!revenueTrend.buckets[selectedBucket];
                    const isCurrent = hasSelection
                      ? selectedBucket === idx
                      : idx === revenueTrend.buckets.length - 1;
                    const pct = revenueTrend.max > 0 ? bucket.total / revenueTrend.max : 0;
                    return (
                      <TouchableOpacity
                        key={bucket.key}
                        style={styles.trendColumn}
                        onPress={() => { haptics.selection(); setSelectedBucket(selectedBucket === idx ? null : idx); }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${bucket.label}: R${bucket.total.toFixed(0)}`}
                      >
                        <View
                          style={[
                            styles.trendBar,
                            { height: bucket.total > 0 ? Math.max(3, pct * TREND_PLOT_HEIGHT) : 0 },
                            isCurrent && styles.trendBarCurrent,
                          ]}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.trendAxis} />
                <View style={styles.trendAxisLabels}>
                  <Text style={styles.trendAxisLabel}>{revenueTrend.buckets[0].label}</Text>
                  <Text style={styles.trendAxisLabel}>{revenueTrend.buckets[revenueTrend.buckets.length - 1].label}</Text>
                </View>
              </View>
            )}

            {/* Revenue by Category */}
            {revenueByCategory.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionCardTitle}>Revenue by Category</Text>
                <View style={styles.breakdownContainer}>
                  {revenueByCategory.map(({ category, total, pct }) => (
                    <View key={category} style={styles.breakdownRow}>
                      <View style={[styles.breakdownLeft, { width: 130 }]}>
                        <Text style={styles.breakdownLabel} numberOfLines={1}>{category}</Text>
                      </View>
                      <View style={styles.breakdownBarBg}>
                        <View style={[styles.breakdownBarFill, { width: `${pct}%`, backgroundColor: '#000000' }]} />
                      </View>
                      <Text style={[styles.breakdownCount, { width: 56 }]}>R{total.toFixed(0)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Top Selling Items */}
            {topItems.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionCardTitle}>Top Selling Items</Text>
                {topItems.map((item, idx) => (
                  <View key={item.name} style={[styles.topItemRow, idx === 0 && { borderTopWidth: 0 }]}>
                    <View style={styles.topItemRank}>
                      <Text style={styles.topItemRankText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.topItemQty}>{item.qty}×</Text>
                    <Text style={styles.topItemRevenue}>R{item.revenue.toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Slow Movers — the flip side: least (or zero) sales in the
                selected period, drawn from the full menu catalog so an item
                nobody ordered still shows up instead of just not appearing. */}
            {slowMovers.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionCardTitle}>Slow Movers</Text>
                {slowMovers.map((item, idx) => (
                  <View key={item.name} style={[styles.topItemRow, idx === 0 && { borderTopWidth: 0 }]}>
                    <View style={styles.topItemRank}>
                      <Text style={styles.topItemRankText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.topItemQty}>{item.qty}×</Text>
                    <Text style={styles.topItemRevenue}>R{item.revenue.toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Corporate Client Revenue */}
            {companyStats.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <Text style={styles.sectionCardTitle}>Corporate Client Revenue</Text>
                  <TouchableOpacity onPress={() => setSelectedTab('companies')}>
                    <Text style={styles.seeAllText}>See All</Text>
                  </TouchableOpacity>
                </View>
                {companyStats.map((c, idx) => (
                  <View key={c.company.id} style={[styles.recentOrderItem, idx === 0 && { borderTopWidth: 0 }]}>
                    <View style={styles.recentOrderLeft}>
                      <View style={styles.companyStatIcon}>
                        <Ionicons name="business" size={14} color="#5AC8FA" />
                      </View>
                      <View>
                        <Text style={styles.recentOrderId}>{c.company.name}</Text>
                        <Text style={styles.recentOrderUser}>{c.orderCount} order{c.orderCount === 1 ? '' : 's'}</Text>
                      </View>
                    </View>
                    <Text style={styles.recentOrderTotal}>R{c.revenue.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recent Orders */}
            {filteredOrders.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <Text style={styles.sectionCardTitle}>Recent Orders</Text>
                  <TouchableOpacity onPress={() => setSelectedTab('orders')}>
                    <Text style={styles.seeAllText}>See All</Text>
                  </TouchableOpacity>
                </View>
                {filteredOrders.slice(0, 4).map((order, idx) => (
                  <View key={order.id} style={[styles.recentOrderItem, idx === 0 && { borderTopWidth: 0 }]}>
                    <View style={styles.recentOrderLeft}>
                      <View style={[styles.recentOrderStatusDot, { backgroundColor: STATUS_COLORS[order.status] || '#6B6B6B' }]} />
                      <View>
                        <Text style={styles.recentOrderId}>{order.id}</Text>
                        <Text style={styles.recentOrderUser}>{order.userName || 'Guest'}</Text>
                      </View>
                    </View>
                    <View style={styles.recentOrderRight}>
                      <Text style={styles.recentOrderTotal}>R{order.total.toFixed(2)}</Text>
                      <View style={[styles.recentStatusBadge, { backgroundColor: (STATUS_COLORS[order.status] || '#6B6B6B') + '20' }]}>
                        <Text style={[styles.recentStatusText, { color: STATUS_COLORS[order.status] || '#6B6B6B' }]}>
                          {STATUS_LABELS[order.status] || order.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Power BI reporting teaser — honest about what's live vs. what's coming */}
            <View style={styles.biCard}>
              <View style={styles.biCardHeader}>
                <View style={styles.biIconWrap}>
                  <Ionicons name="bar-chart" size={20} color="#FFD60A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.biTitle}>Advanced Reporting</Text>
                  <Text style={styles.biSubtitle}>Power BI embed — Stage 3 of your SLA</Text>
                </View>
              </View>
              <Text style={styles.biText}>
                The breakdowns above (revenue by category, top items, client spend) are exactly what will
                feed the full Power BI dashboards once the backend and data pipeline are built — daily
                auto-refresh, drill-downs, and exportable reports.
              </Text>
            </View>
          </>
        )}

        {selectedTab === 'users' && (
          <>
            <View style={styles.pageHeader}>
              <View>
                <Text style={styles.greeting}>User Management</Text>
                <Text style={styles.greetingSub}>{allUsers.length} registered users</Text>
              </View>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setShowAddUser(true)}
                accessibilityRole="button"
                accessibilityLabel="Add user"
              >
                <Ionicons name="add" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>
            {allUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="people-outline" size={40} color={theme.textSecondary} />
                </View>
                <Text style={styles.emptyTitle}>No users yet</Text>
                <Text style={styles.emptySub}>Add users to get started</Text>
              </View>
            ) : (
              allUsers.map((user, idx) => (
                <View key={user.id} style={[styles.userCard, idx === 0 && { marginTop: 4 }]}>
                  <View style={[styles.userAvatar, { backgroundColor: user.role === 'admin' ? '#FFD60A30' : '#5AC8FA30' }]}>
                    <Text style={[styles.userAvatarText, { color: user.role === 'admin' ? '#FFD60A' : '#5AC8FA' }]}>
                      {(user.name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName}>{user.name || 'Unknown'}</Text>
                      {user.role === 'admin' && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      )}
                      {user.companyName && (
                        <View style={styles.companyBadge}>
                          <Ionicons name="business" size={10} color="#5AC8FA" />
                          <Text style={styles.companyBadgeText}>{user.companyName}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    <Text style={styles.userMeta}>Joined {user.joinedDate} • {user.orderCount} orders</Text>
                  </View>
                  {user.role !== 'admin' && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => { haptics.warning(); deleteUser(user.id); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete user ${user.name || 'Unknown'}`}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.error} />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {selectedTab === 'orders' && (
          <OrdersSection orders={orders} updateOrderStatus={updateOrderStatus} theme={theme} allUsers={allUsers} />
        )}

        {selectedTab === 'chef' && (
          <ChefSection
            orders={orders}
            updateOrderStatus={updateOrderStatus}
            theme={theme}
            allUsers={allUsers}
            companies={companies}
            kitchenEmail={kitchenEmail}
            onEditKitchenEmail={openKitchenEmailModal}
            scrollToTop={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          />
        )}

        {selectedTab === 'weeks' && (
          <WeeksSection activeWeek={activeWeek} setActiveWeek={setActiveWeek} theme={theme} />
        )}

        {selectedTab === 'meals' && (
          <MealsSection theme={theme} />
        )}

        {selectedTab === 'discounts' && (
          <>
            <View style={styles.pageHeader}>
              <View>
                <Text style={styles.greeting}>Discount Codes</Text>
                <Text style={styles.greetingSub}>{discounts.length} active codes</Text>
              </View>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setShowAddDiscount(true)}
                testID="add-discount-button"
                accessibilityRole="button"
                accessibilityLabel="Add discount"
              >
                <Ionicons name="add" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            {discounts.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="pricetag-outline" size={40} color={theme.textSecondary} />
                </View>
                <Text style={styles.emptyTitle}>No discounts yet</Text>
                <Text style={styles.emptySub}>Create discount codes to promote your meals</Text>
              </View>
            ) : (
              discounts.map((discount, idx) => (
                <View key={discount.id} style={[styles.discountCard, idx === 0 && { marginTop: 4 }]}>
                  <View style={styles.discountTopRow}>
                    <View style={styles.discountCodeSection}>
                      <View style={styles.discountCodeTag}>
                        <Text style={styles.discountCodeText}>{discount.code}</Text>
                      </View>
                      <Text style={styles.discountPercent}>-{discount.percentage}% OFF</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.discountToggle, discount.active && styles.discountToggleOn]}
                      onPress={() => { haptics.selection(); updateDiscount(discount.id, { active: !discount.active }); }}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: discount.active }}
                      accessibilityLabel={`${discount.code} active`}
                    >
                      <View style={[styles.discountToggleCircle, discount.active && styles.discountToggleCircleOn]} />
                    </TouchableOpacity>
                  </View>
                  {discount.company && (
                    <View style={styles.discountCompanyRow}>
                      <Ionicons name="business" size={12} color="#5AC8FA" />
                      <Text style={styles.discountCompanyText}>{discount.company} only</Text>
                    </View>
                  )}
                  <View style={styles.discountBottomRow}>
                    {discount.expires ? (
                      <Text style={styles.discountExpiry}>Expires: {discount.expires}</Text>
                    ) : (
                      <Text style={styles.discountExpiry}>No expiry</Text>
                    )}
                    <TouchableOpacity
                      onPress={() => { haptics.warning(); deleteDiscount(discount.id); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete discount ${discount.code}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {selectedTab === 'companies' && (
          <>
            <View style={styles.pageHeader}>
              <View>
                <Text style={styles.greeting}>Corporate Clients</Text>
                <Text style={styles.greetingSub}>{companies.length} companies registered</Text>
              </View>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setShowAddCompany(true)}
                testID="add-company-button"
                accessibilityRole="button"
                accessibilityLabel="Add company"
              >
                <Ionicons name="add" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="information-circle" size={22} color="#5AC8FA" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>How this works</Text>
                <Text style={styles.infoText}>
                  When someone signs up with a work email matching one of these domains, they're automatically linked to that company — no manual entry needed.
                </Text>
              </View>
            </View>

            {companies.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="business-outline" size={40} color={theme.textSecondary} />
                </View>
                <Text style={styles.emptyTitle}>No companies yet</Text>
                <Text style={styles.emptySub}>Add a corporate client to get started</Text>
              </View>
            ) : (
              companies.map((company, idx) => {
                const employeeCount = employeeCountByCompany.get(company.name) ?? 0;
                return (
                  <View key={company.id} style={[styles.userCard, idx === 0 && { marginTop: 4 }]}>
                    <View style={[styles.userAvatar, { backgroundColor: '#5AC8FA30' }]}>
                      <Ionicons name="business" size={20} color="#5AC8FA" />
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{company.name}</Text>
                      <Text style={styles.userEmail}>{company.domains.map(d => `@${d}`).join(', ')}</Text>
                      <Text style={styles.userMeta}>{employeeCount} user{employeeCount === 1 ? '' : 's'} matched</Text>
                      {company.mealSubsidy ? (
                        <View style={styles.companyAddressRow}>
                          <Ionicons name="cash" size={11} color="#22C55E" />
                          <Text style={[styles.companyAddressText, { color: '#22C55E' }]} numberOfLines={1}>
                            R{company.mealSubsidy.toFixed(2)} meal subsidy (incl. VAT)
                          </Text>
                        </View>
                      ) : null}
                      {company.address ? (
                        <>
                          <View style={styles.companyAddressRow}>
                            <Ionicons name="location" size={11} color={theme.textSecondary} />
                            <Text style={styles.companyAddressText} numberOfLines={1}>
                              {company.address.unit ? `${company.address.unit}, ` : ''}
                              {company.address.street}, {company.address.suburb}
                            </Text>
                          </View>
                          {company.address.instructions ? (
                            <View style={styles.companyAddressRow}>
                              <Ionicons name="information-circle" size={11} color="#5AC8FA" />
                              <Text style={[styles.companyAddressText, { color: '#5AC8FA' }]} numberOfLines={1}>
                                {company.address.instructions}
                              </Text>
                            </View>
                          ) : null}
                          <View style={styles.companyAddressRow}>
                            <Ionicons name="bicycle" size={11} color={company.address.distanceKm != null ? '#22C55E' : '#FF9500'} />
                            <Text style={[styles.companyAddressText, { color: company.address.distanceKm != null ? '#22C55E' : '#FF9500' }]} numberOfLines={1}>
                              {company.address.distanceKm != null
                                ? `${company.address.distanceKm}km · R${calculateDeliveryFee(company.address.distanceKm) ?? '—'} delivery fee`
                                : 'Add a distance to set the delivery fee'}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View style={styles.companyAddressRow}>
                          <Ionicons name="alert-circle" size={11} color="#FF9500" />
                          <Text style={[styles.companyAddressText, { color: '#FF9500' }]}>No delivery address on file</Text>
                        </View>
                      )}
                      {company.address2 ? (
                        <View style={styles.companyAddressRow}>
                          <Ionicons name="location" size={11} color={theme.textSecondary} />
                          <Text style={styles.companyAddressText} numberOfLines={1}>
                            + {company.address2.unit ? `${company.address2.unit}, ` : ''}{company.address2.street}, {company.address2.suburb}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => { haptics.warning(); deleteCompany(company.id); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete company ${company.name}`}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Add Discount Modal */}
      <Modal visible={showAddDiscount} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Discount</Text>
              <TouchableOpacity
                onPress={() => setShowAddDiscount(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Code (e.g. SAVE20)"
              placeholderTextColor={theme.textTertiary}
              value={discountCode}
              onChangeText={setDiscountCode}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Percentage (e.g. 20)"
              placeholderTextColor={theme.textTertiary}
              value={discountPercent}
              onChangeText={setDiscountPercent}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.modalInput, discountExpiryError ? styles.modalInputError : null]}
              placeholder="Expiry date (optional, e.g. 31 Dec 2026)"
              placeholderTextColor={theme.textTertiary}
              value={discountExpiry}
              onChangeText={(val) => { setDiscountExpiry(val); setDiscountExpiryError(''); }}
            />
            {discountExpiryError ? <Text style={styles.modalFieldError}>{discountExpiryError}</Text> : null}
            <Text style={styles.modalFieldLabel}>TARGET COMPANY (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPickerRow}>
              <TouchableOpacity
                style={[styles.categoryPickerChip, discountCompany === '' && styles.categoryPickerChipActive]}
                onPress={() => setDiscountCompany('')}
                accessibilityRole="button"
                accessibilityState={{ selected: discountCompany === '' }}
              >
                <Text style={[styles.categoryPickerChipText, discountCompany === '' && styles.categoryPickerChipTextActive]}>
                  Any / Everyone
                </Text>
              </TouchableOpacity>
              {companies.map(co => (
                <TouchableOpacity
                  key={co.id}
                  style={[styles.categoryPickerChip, discountCompany === co.name && styles.categoryPickerChipActive]}
                  onPress={() => setDiscountCompany(co.name)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: discountCompany === co.name }}
                >
                  <Text style={[styles.categoryPickerChipText, discountCompany === co.name && styles.categoryPickerChipTextActive]}>
                    {co.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.modalFieldLabel}>TARGET CATEGORY (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPickerRow}>
              <TouchableOpacity
                style={[styles.categoryPickerChip, discountCategory === null && styles.categoryPickerChipActive]}
                onPress={() => {
                  setDiscountCategory(null);
                  setDiscountItem(null);
                }}
              >
                <Text style={[styles.categoryPickerChipText, discountCategory === null && styles.categoryPickerChipTextActive]}>
                  All Categories
                </Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryPickerChip, discountCategory === cat.id && styles.categoryPickerChipActive]}
                  onPress={() => {
                    setDiscountCategory(cat.id);
                    setDiscountItem(null);
                  }}
                >
                  <Text style={[styles.categoryPickerChipText, discountCategory === cat.id && styles.categoryPickerChipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {discountCategory && (
              <>
                <Text style={styles.modalFieldLabel}>TARGET ITEM (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPickerRow}>
                  <TouchableOpacity
                    style={[styles.categoryPickerChip, discountItem === null && styles.categoryPickerChipActive]}
                    onPress={() => setDiscountItem(null)}
                  >
                    <Text style={[styles.categoryPickerChipText, discountItem === null && styles.categoryPickerChipTextActive]}>
                      All Items
                    </Text>
                  </TouchableOpacity>
                  {categories.find(c => c.id === discountCategory)?.items.map((item: any) => (
                    <TouchableOpacity
                      key={item.name}
                      style={[styles.categoryPickerChip, discountItem === item.name && styles.categoryPickerChipActive]}
                      onPress={() => setDiscountItem(item.name)}
                    >
                      <Text style={[styles.categoryPickerChipText, discountItem === item.name && styles.categoryPickerChipTextActive]}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddDiscount(false)} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddDiscount} accessibilityRole="button">
                <Text style={styles.modalSaveText}>Add Discount</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add User Modal */}
      <Modal visible={showAddUser} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add User</Text>
              <TouchableOpacity
                onPress={() => setShowAddUser(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Full Name"
              placeholderTextColor={theme.textTertiary}
              value={newUserName}
              onChangeText={setNewUserName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Email Address"
              placeholderTextColor={theme.textTertiary}
              value={newUserEmail}
              onChangeText={setNewUserEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddUser(false)} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddUser} accessibilityRole="button">
                <Text style={styles.modalSaveText}>Add User</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Company Modal — by far the longest form of any modal on this
          screen (10 fields + hints), so unlike the shorter modals here it
          needs its own scrollable body between the fixed header and
          Cancel/Add buttons or the bottom fields are simply unreachable. */}
      <Modal visible={showAddCompany} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.modalContentTall]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Company</Text>
              <TouchableOpacity onPress={() => setShowAddCompany(false)} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <TextInput
              style={styles.modalInput}
              placeholder="Company Name (e.g. Acme Logistics)"
              placeholderTextColor={theme.textTertiary}
              value={newCompanyName}
              onChangeText={setNewCompanyName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Email domain(s), comma-separated"
              placeholderTextColor={theme.textTertiary}
              value={newCompanyDomains}
              onChangeText={setNewCompanyDomains}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.modalHint}>
              e.g. acmelogistics.com — anyone signing up with an @acmelogistics.com address will be auto-linked to this company.
            </Text>
            <Text style={styles.modalFieldLabel}>DELIVERY ADDRESS</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Street address"
              placeholderTextColor={theme.textTertiary}
              value={newCompanyStreet}
              onChangeText={setNewCompanyStreet}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Floor / suite / unit (optional)"
              placeholderTextColor={theme.textTertiary}
              value={newCompanyUnit}
              onChangeText={setNewCompanyUnit}
            />
            <View style={styles.modalRow}>
              <TextInput
                style={[styles.modalInput, styles.modalRowInput]}
                placeholder="Suburb"
                placeholderTextColor={theme.textTertiary}
                value={newCompanySuburb}
                onChangeText={setNewCompanySuburb}
              />
              <TextInput
                style={[styles.modalInput, styles.modalRowInput]}
                placeholder="City"
                placeholderTextColor={theme.textTertiary}
                value={newCompanyCity}
                onChangeText={setNewCompanyCity}
              />
            </View>
            <View style={styles.modalRow}>
              <TextInput
                style={[styles.modalInput, styles.modalRowInput]}
                placeholder="Postal code"
                placeholderTextColor={theme.textTertiary}
                value={newCompanyCode}
                onChangeText={setNewCompanyCode}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.modalInput, styles.modalRowInput]}
                placeholder="Distance (km)"
                placeholderTextColor={theme.textTertiary}
                value={newCompanyDistance}
                onChangeText={setNewCompanyDistance}
                keyboardType="numeric"
              />
            </View>
            <Text style={styles.modalHint}>
              Used as the default delivery destination for bulk company orders. Distance sets the delivery fee (R100–R350 by band).
            </Text>

            {/* Second site (optional) — some companies deliver to two
                locations; each employee picks between them at signup. */}
            {showSecondLocation ? (
              <>
                <View style={styles.modalRow}>
                  <Text style={[styles.modalFieldLabel, { flex: 1 }]}>SECOND LOCATION (OPTIONAL)</Text>
                  <TouchableOpacity onPress={() => setShowSecondLocation(false)} accessibilityRole="button">
                    <Text style={styles.modalRemoveLocationText}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Street address"
                  placeholderTextColor={theme.textTertiary}
                  value={newCompanyStreet2}
                  onChangeText={setNewCompanyStreet2}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Floor / suite / unit (optional)"
                  placeholderTextColor={theme.textTertiary}
                  value={newCompanyUnit2}
                  onChangeText={setNewCompanyUnit2}
                />
                <View style={styles.modalRow}>
                  <TextInput
                    style={[styles.modalInput, styles.modalRowInput]}
                    placeholder="Suburb"
                    placeholderTextColor={theme.textTertiary}
                    value={newCompanySuburb2}
                    onChangeText={setNewCompanySuburb2}
                  />
                  <TextInput
                    style={[styles.modalInput, styles.modalRowInput]}
                    placeholder="City"
                    placeholderTextColor={theme.textTertiary}
                    value={newCompanyCity2}
                    onChangeText={setNewCompanyCity2}
                  />
                </View>
                <View style={styles.modalRow}>
                  <TextInput
                    style={[styles.modalInput, styles.modalRowInput]}
                    placeholder="Postal code"
                    placeholderTextColor={theme.textTertiary}
                    value={newCompanyCode2}
                    onChangeText={setNewCompanyCode2}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.modalInput, styles.modalRowInput]}
                    placeholder="Distance (km)"
                    placeholderTextColor={theme.textTertiary}
                    value={newCompanyDistance2}
                    onChangeText={setNewCompanyDistance2}
                    keyboardType="numeric"
                  />
                </View>
                <Text style={styles.modalHint}>
                  Employees at this company will be asked to pick which of the two locations they're delivering to when they sign up.
                </Text>
              </>
            ) : (
              <TouchableOpacity onPress={() => setShowSecondLocation(true)} accessibilityRole="button" style={styles.modalAddLocationBtn}>
                <Ionicons name="add-circle-outline" size={16} color={theme.accent} />
                <Text style={styles.modalAddLocationText}>Add a second location</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.modalFieldLabel}>DELIVERY INSTRUCTIONS (OPTIONAL)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Use the loading bay entrance, sign in at security, ask for reception on floor 6"
              placeholderTextColor={theme.textTertiary}
              value={newCompanyInstructions}
              onChangeText={setNewCompanyInstructions}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.modalHint}>
              Standing access notes shown to the courier on every order to this company — no need to re-enter them per order.
            </Text>
            <Text style={styles.modalFieldLabel}>MEAL SUBSIDY (OPTIONAL)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Amount per meal, e.g. 80.00 (incl. VAT)"
              placeholderTextColor={theme.textTertiary}
              value={newCompanySubsidy}
              onChangeText={setNewCompanySubsidy}
              keyboardType="numeric"
            />
            <Text style={styles.modalHint}>
              Deducted automatically from every eligible employee's order — capped so a single meal is never subsidized past its own price.
            </Text>
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddCompany(false)} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddCompany} accessibilityRole="button">
                <Text style={styles.modalSaveText}>Add Company</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Kitchen Notifications Modal */}
      <Modal visible={showKitchenEmailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kitchen Notifications</Text>
              <TouchableOpacity onPress={() => setShowKitchenEmailModal(false)} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, kitchenEmailError ? styles.modalInputError : null]}
              placeholder="e.g. kitchen@yourkitchenco.com"
              placeholderTextColor={theme.textTertiary}
              value={kitchenEmailDraft}
              onChangeText={(val) => { setKitchenEmailDraft(val); setKitchenEmailError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {kitchenEmailError ? <Text style={styles.modalFieldError}>{kitchenEmailError}</Text> : null}
            <Text style={styles.modalHint}>
              Default recipient for the Chef tab's "Send" dialogs (Production Sheet and per-client Delivery Notes) — whoever has access to the back kitchen, not the corporate client. You can still override it per send.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowKitchenEmailModal(false)} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveKitchenEmail} accessibilityRole="button">
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Reporting Period Modal */}
      <Modal visible={showCustomDateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom Period</Text>
              <TouchableOpacity onPress={() => setShowCustomDateModal(false)} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalRow}>
              <TextInput
                style={[styles.modalInput, styles.modalRowInput, customDateError ? styles.modalInputError : null]}
                placeholder="Start, e.g. 1 Aug 2026"
                placeholderTextColor={theme.textTertiary}
                value={customStart}
                onChangeText={(val) => { setCustomStart(val); setCustomDateError(''); }}
              />
              <TextInput
                style={[styles.modalInput, styles.modalRowInput, customDateError ? styles.modalInputError : null]}
                placeholder="End, e.g. 31 Aug 2026"
                placeholderTextColor={theme.textTertiary}
                value={customEnd}
                onChangeText={(val) => { setCustomEnd(val); setCustomDateError(''); }}
              />
            </View>
            {customDateError ? <Text style={styles.modalFieldError}>{customDateError}</Text> : null}
            <Text style={styles.modalHint}>
              Filters the stats, breakdowns, and recent orders below "Today at a Glance" to this date range.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCustomDateModal(false)} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleApplyCustomDate} accessibilityRole="button">
                <Text style={styles.modalSaveText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MealsSection({ theme }: { theme: ThemeColors }) {
  const { menus, addMenuItem, updateMenuItem, deleteMenuItem } = useKitchen();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ categoryId: string; itemId: string; name: string; price: string; description: string } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  // In-app dialogs instead of Alert.alert — Alert is a documented no-op on
  // React Native Web with no polyfill in this project, so it renders nothing there.
  const [infoDialog, setInfoDialog] = useState<{ title: string; message: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ categoryId: string; itemId: string; itemName: string } | null>(null);

  // Same live menu data the customer-facing Menu screen renders — edits here
  // actually show up, unlike the old `menus` state that nothing ever read.
  const categories = menus;

  const selectedCategoryData = selectedCategory 
    ? categories.find(c => c.id === selectedCategory) 
    : null;

  const handleAddItem = () => {
    if (!newItemName.trim() || !newItemPrice.trim() || !newItemCategory.trim()) {
      setInfoDialog({ title: 'Missing Fields', message: 'Please fill in name, price, and category' });
      return;
    }
    const priceNum = parseFloat(newItemPrice.replace(/[^\d.]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      setInfoDialog({ title: 'Invalid Price', message: 'Please enter a valid price' });
      return;
    }
    addMenuItem(newItemCategory, {
      name: newItemName.trim(),
      price: priceNum,
      description: newItemDesc.trim() || `${newItemName.trim()} - Freshly prepared`,
    });
    haptics.success();
    setNewItemName('');
    setNewItemPrice('');
    setNewItemDesc('');
    setNewItemCategory('');
    setShowAddModal(false);
  };

  const handleEditItem = () => {
    if (!editingItem) return;
    if (!editingItem.name.trim() || !editingItem.price.trim()) {
      setInfoDialog({ title: 'Missing Fields', message: 'Please fill in name and price' });
      return;
    }
    const priceNum = parseFloat(editingItem.price.replace(/[^\d.]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      setInfoDialog({ title: 'Invalid Price', message: 'Please enter a valid price' });
      return;
    }
    updateMenuItem(editingItem.categoryId, editingItem.itemId, {
      name: editingItem.name.trim(),
      price: priceNum,
      description: editingItem.description.trim(),
    });
    haptics.success();
    setEditingItem(null);
    setShowEditModal(false);
  };

  const handleDeleteItem = (categoryId: string, itemId: string, itemName: string) => {
    setDeleteConfirm({ categoryId, itemId, itemName });
  };

  const openEditModal = (categoryId: string, item: any) => {
    // updateMenuItem finds the item by id, so an item with no id cannot be
    // saved. The old `item-${Date.now()}` fallback minted an id that matched
    // nothing, so the modal opened and Save silently did nothing. Every menu
    // item does carry an id today; if one ever does not, refusing to open is
    // honest where a no-op Save is not.
    if (!item?.id) return;
    setEditingItem({
      categoryId,
      itemId: item.id,
      name: item.name || '',
      price: String(item.sizes?.[0]?.price || ''),
      description: item.description || '',
    });
    setShowEditModal(true);
  };

  return (
    <>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.greeting}>Menu Management</Text>
          <Text style={styles.greetingSub}>
            {selectedCategoryData 
              ? `${selectedCategoryData.items.length} items in ${selectedCategoryData.name}`
              : `${categories.length} categories`
            }
          </Text>
        </View>
        <View style={styles.mealsHeaderActions}>
          <TouchableOpacity
            style={styles.previewMenuBtn}
            onPress={() => router.push('/')}
            accessibilityRole="button"
            accessibilityLabel="Preview app as customer"
          >
            <Ionicons name="eye-outline" size={16} color={theme.text} />
            <Text style={styles.previewMenuBtnText}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}
            testID="add-meal-button"
            accessibilityRole="button"
            accessibilityLabel="Add menu item"
          >
            <Ionicons name="add" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilterRow}>
        <TouchableOpacity
          style={[styles.categoryTab, selectedCategory === null && styles.categoryTabActive]}
          onPress={() => setSelectedCategory(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedCategory === null }}
        >
          <Text style={[styles.categoryTabText, selectedCategory === null && styles.categoryTabTextActive]}>
            All Categories
          </Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryTab, selectedCategory === cat.id && styles.categoryTabActive]}
            onPress={() => setSelectedCategory(cat.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCategory === cat.id }}
          >
            <Text style={[styles.categoryTabText, selectedCategory === cat.id && styles.categoryTabTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items List */}
      {categories.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="restaurant-outline" size={40} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No menu items found</Text>
          <Text style={styles.emptySub}>Add your first menu item to get started</Text>
        </View>
      ) : (
        (selectedCategory ? [selectedCategoryData!].filter(Boolean) : categories).map(cat => (
          <View key={cat.id} style={styles.menuCategorySection}>
            <View style={styles.menuCategoryHeader}>
              <Text style={styles.menuCategoryTitle}>{cat.name}</Text>
              <Text style={styles.menuCategoryCount}>{cat.items.length} items</Text>
            </View>
            {cat.items.length === 0 ? (
              <View style={styles.menuEmptyItems}>
                <Text style={styles.menuEmptyItemsText}>No items in this category</Text>
              </View>
            ) : (
              cat.items.map((item: any, idx: number) => {
                const itemId = item.id || `menu-item-${cat.id}-${idx}`;
                const sizes = item.sizes || [];
                const displayPrice = sizes.length > 1
                  ? `R${sizes[0].price.toFixed(0)} - R${sizes[sizes.length - 1].price.toFixed(0)}`
                  : `R${(sizes[0]?.price || 0).toFixed(2)}`;
                return (
                  <View key={itemId} style={styles.menuItemCard}>
                    <View style={styles.menuItemInfo}>
                      <Text style={styles.menuItemName}>{item.name}</Text>
                      <Text style={styles.menuItemPrice}>{displayPrice}</Text>
                      {item.description ? (
                        <Text style={styles.menuItemDesc} numberOfLines={2}>{item.description}</Text>
                      ) : null}
                    </View>
                    <View style={styles.menuItemActions}>
                      <TouchableOpacity
                        style={styles.menuEditBtn}
                        onPress={() => openEditModal(cat.id, { ...item, id: itemId })}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${item.name}`}
                      >
                        <Ionicons name="create-outline" size={18} color="#5AC8FA" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.menuDeleteBtn}
                        onPress={() => handleDeleteItem(cat.id, itemId, item.name)}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${item.name}`}
                      >
                        <Ionicons name="trash-outline" size={18} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ))
      )}

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Menu Item</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Item Name *"
              placeholderTextColor={theme.textTertiary}
              value={newItemName}
              onChangeText={setNewItemName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Price * (e.g. 80)"
              placeholderTextColor={theme.textTertiary}
              value={newItemPrice}
              onChangeText={setNewItemPrice}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Description (optional)"
              placeholderTextColor={theme.textTertiary}
              value={newItemDesc}
              onChangeText={setNewItemDesc}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.modalFieldLabel}>CATEGORY *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPickerRow}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryPickerChip, newItemCategory === cat.id && styles.categoryPickerChipActive]}
                  onPress={() => setNewItemCategory(cat.id)}
                >
                  <Text style={[styles.categoryPickerChipText, newItemCategory === cat.id && styles.categoryPickerChipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddModal(false)} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddItem} accessibilityRole="button">
                <Text style={styles.modalSaveText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Item Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Menu Item</Text>
              <TouchableOpacity onPress={() => { setShowEditModal(false); setEditingItem(null); }} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {editingItem && (
              <>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Item Name"
                  placeholderTextColor={theme.textTertiary}
                  value={editingItem.name}
                  onChangeText={(val) => setEditingItem({...editingItem, name: val})}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Price (e.g. 80)"
                  placeholderTextColor={theme.textTertiary}
                  value={editingItem.price}
                  onChangeText={(val) => setEditingItem({...editingItem, price: val})}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.modalInput, { minHeight: 80 }]}
                  placeholder="Description"
                  placeholderTextColor={theme.textTertiary}
                  value={editingItem.description}
                  onChangeText={(val) => setEditingItem({...editingItem, description: val})}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.modalBtnRow}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowEditModal(false); setEditingItem(null); }} accessibilityRole="button">
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalSaveBtn} onPress={handleEditItem} accessibilityRole="button">
                    <Text style={styles.modalSaveText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Info Dialog — validation errors */}
      <Modal visible={!!infoDialog} animationType="fade" transparent onRequestClose={() => setInfoDialog(null)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogIcon}>⚠️</Text>
            <Text style={styles.dialogTitle}>{infoDialog?.title}</Text>
            <Text style={styles.dialogText}>{infoDialog?.message}</Text>
            <TouchableOpacity style={styles.dialogOkBtn} onPress={() => setInfoDialog(null)} accessibilityRole="button">
              <Text style={styles.dialogOkText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm Dialog */}
      <Modal visible={!!deleteConfirm} animationType="fade" transparent onRequestClose={() => setDeleteConfirm(null)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogIcon}>🗑️</Text>
            <Text style={styles.dialogTitle}>Delete Item</Text>
            <Text style={styles.dialogText}>
              Are you sure you want to delete "{deleteConfirm?.itemName}"?
            </Text>
            <View style={styles.dialogBtnRow}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setDeleteConfirm(null)} accessibilityRole="button">
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogDeleteBtn}
                onPress={() => {
                  haptics.warning();
                  if (deleteConfirm) deleteMenuItem(deleteConfirm.categoryId, deleteConfirm.itemId);
                  setDeleteConfirm(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${deleteConfirm?.itemName ?? 'item'}`}
              >
                <Text style={styles.dialogDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const UNASSIGNED_CLIENT = 'Individual / Guest';

/**
 * yyyy-mm-dd key for a date. Used to scope the Chef tab's per-day working
 * state (prep check-offs, collapsed client sections) and to batch orders by
 * due date, so the same calendar day always yields the same key regardless
 * of the time-of-day carried on the Date.
 */
function dateKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function OrdersSection({ orders, updateOrderStatus, theme, allUsers }: { orders: Order[]; updateOrderStatus: (orderId: string, status: string) => void; theme: ThemeColors; allUsers: AppUser[] }) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  // Company groups start collapsed — a client with hundreds of employees
  // ordering shouldn't dump hundreds of order cards onto the screen the
  // moment this tab opens. Tap a company to reveal its individual orders.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (name: string) => {
    haptics.selection();
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // Every order grouped by the corporate client its customer belongs to —
  // matches how the Chef tab already treats corporate orders as one client's
  // business rather than N unrelated individuals. Orders from customers with
  // no matched company fall into their own bucket at the end.
  const groups = useMemo(() => {
    const emailToCompany = new Map<string, string>();
    allUsers.forEach(u => { if (u.companyName) emailToCompany.set(u.email, u.companyName); });

    const byClient = new Map<string, Order[]>();
    orders.forEach(order => {
      const clientName = (order.userEmail && emailToCompany.get(order.userEmail)) || UNASSIGNED_CLIENT;
      const list = byClient.get(clientName) ?? [];
      list.push(order);
      byClient.set(clientName, list);
    });

    return Array.from(byClient.entries())
      .map(([name, groupOrders]) => ({ name, orders: groupOrders }))
      .sort((a, b) => {
        if (a.name === UNASSIGNED_CLIENT) return 1;
        if (b.name === UNASSIGNED_CLIENT) return -1;
        return a.name.localeCompare(b.name);
      });
  }, [orders, allUsers]);

  if (orders.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="receipt-outline" size={40} color={theme.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>No orders yet</Text>
        <Text style={styles.emptySub}>Orders will appear here once placed</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.greeting}>All Orders</Text>
          <Text style={styles.greetingSub}>{orders.length} total orders</Text>
        </View>
      </View>
      {groups.map((group, groupIdx) => {
        const isGroupExpanded = expandedGroups.has(group.name);
        return (
        <View key={group.name}>
          <TouchableOpacity
            style={[styles.prodClientHeaderRow, { justifyContent: 'space-between' }, groupIdx === 0 && { marginTop: 0 }]}
            onPress={() => toggleGroup(group.name)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: isGroupExpanded }}
            accessibilityLabel={`${group.name}, ${group.orders.length} order${group.orders.length === 1 ? '' : 's'}, ${isGroupExpanded ? 'collapse' : 'expand'}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {group.name !== UNASSIGNED_CLIENT && <Ionicons name="business" size={13} color={theme.textSecondary} style={{ marginRight: 4 }} />}
              <Text style={[styles.prodClientHeader, { marginTop: 0, marginBottom: 0 }]}>{group.name} · {group.orders.length} order{group.orders.length === 1 ? '' : 's'}</Text>
            </View>
            <Ionicons name={isGroupExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          {isGroupExpanded && group.orders.map((order, idx) => {
        const isExpanded = expandedOrder === order.id;
        const flowIdx = STATUS_FLOW.indexOf(order.status);
        const isTerminal = order.status === 'delivered' || order.status === 'cancelled';
        return (
          <View key={order.id} style={[styles.orderCard, idx === 0 && { marginTop: 4 }]}>
            <TouchableOpacity
              onPress={() => setExpandedOrder(isExpanded ? null : order.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Order ${order.id}, ${isExpanded ? 'collapse' : 'expand'} details`}
            >
              <View style={styles.orderCardHeader}>
                <View style={styles.orderCardLeft}>
                  <Text style={styles.orderCardId}>{order.id}</Text>
                  <Text style={styles.orderCardUser}>{order.userName || 'Guest'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[order.status] || '#6B6B6B') + '20' }]}>
                  <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[order.status] || '#6B6B6B' }]}>
                    {STATUS_LABELS[order.status] || order.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.orderCardDate}>{order.timestamp || order.date}</Text>

              <View style={styles.expandArrow}>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.orderCardExpanded}>
                <View style={styles.orderDivider} />
                {order.items.map((dish) => (
                  <View key={dish.id} style={styles.orderDishRow}>
                    <Text style={styles.orderDishName}>
                      {dish.quantity}x {dish.name}
                      {dish.selectedSize ? <Text style={styles.orderDishSize}> — {dish.selectedSize}</Text> : null}
                      {dish.addOns && dish.addOns.length > 0 ? (
                        <Text style={styles.orderDishSize}> (+ {dish.addOns.map(a => a.name).join(', ')})</Text>
                      ) : null}
                    </Text>
                    <Text style={styles.orderDishPrice}>R{(dish.price * dish.quantity).toFixed(2)}</Text>
                  </View>
                ))}
                <View style={styles.orderDivider} />
                <View style={styles.orderTotalRow}>
                  <Text style={styles.orderTotalLabel}>Total</Text>
                  <Text style={styles.orderTotalValue}>R{order.total.toFixed(2)}</Text>
                </View>
                {order.deliveryAddress && (
                  <View style={styles.orderAddress}>
                    <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                    <Text style={styles.orderAddressText}>
                      {order.deliveryAddress.street}, {order.deliveryAddress.suburb}
                    </Text>
                  </View>
                )}

                {!isTerminal && (
                  <>
                    <Text style={styles.statusFlowLabel}>UPDATE STATUS</Text>
                    <View style={styles.statusFlowRow}>
                      {STATUS_FLOW.map((status, sIdx) => {
                        const isCurrent = status === order.status;
                        const isPast = sIdx < flowIdx;
                        return (
                          <TouchableOpacity
                            key={status}
                            style={[
                              styles.statusFlowChip,
                              isCurrent && { backgroundColor: STATUS_COLORS[status], borderColor: STATUS_COLORS[status] },
                              isPast && styles.statusFlowChipPast,
                            ]}
                            onPress={() => { haptics.selection(); updateOrderStatus(order.id, status); }}
                            disabled={isCurrent}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isCurrent, disabled: isCurrent }}
                            accessibilityLabel={`Mark as ${STATUS_LABELS[status]}`}
                          >
                            <Text style={[
                              styles.statusFlowChipText,
                              isCurrent && styles.statusFlowChipTextCurrent,
                              isPast && styles.statusFlowChipTextPast,
                            ]}>
                              {STATUS_LABELS[status]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TouchableOpacity
                      style={styles.cancelOrderBtn}
                      onPress={() => { haptics.warning(); updateOrderStatus(order.id, 'cancelled'); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel order ${order.id}`}
                    >
                      <Text style={styles.cancelOrderBtnText}>Cancel Order</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        );
          })}
        </View>
        );
      })}
    </>
  );
}

/**
 * Chef's Kitchen — a narrower, operational-only view of the same order data
 * Orders/Dashboard already have: what to cook today (aggregated by dish, not
 * by order — that's what a kitchen actually plans around) and the active
 * order queue with status controls, stripped of everything a chef doesn't
 * need (revenue, discounts, company/user management).
 */
function ChefSection({ orders, updateOrderStatus, theme, allUsers, companies, kitchenEmail, onEditKitchenEmail, scrollToTop }: { orders: Order[]; updateOrderStatus: (orderId: string, status: string) => void; theme: ThemeColors; allUsers: AppUser[]; companies: Company[]; kitchenEmail: string; onEditKitchenEmail: () => void; scrollToTop: () => void }) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const activeOrders = useMemo(
    () => orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled'),
    [orders]
  );

  // Which orders have at least one item due today — computed once and
  // reused for both the prep list and the "DUE TODAY" badge in the queue.
  const ordersWithDueToday = useMemo(() => {
    const today = new Date();
    return activeOrders.map(o => {
      const placedAt = new Date(o.timestamp);
      const dueToday = o.items.some(item => isSameDay(getItemDueDate(item, placedAt), today));
      return { order: o, dueToday };
    });
  }, [activeOrders]);

  // Production Sheet — like the old "Today's Prep List" but for any day the
  // kitchen picks, and broken down by corporate client so each client's
  // items can be packed/labelled separately. Cancelled orders are the only
  // ones excluded (nothing to produce for them); unlike the live queue above
  // this intentionally includes delivered orders too, since a past day's
  // sheet should still show what was actually produced that day.
  const [prodDate, setProdDate] = useState(() => new Date());
  const isProdDateToday = isSameDay(prodDate, new Date());
  const shiftProdDate = (deltaDays: number) => {
    setProdDate(d => {
      const next = new Date(d);
      next.setDate(next.getDate() + deltaDays);
      return next;
    });
  };

  // The chef's live working state for the sheet on screen. Every key is
  // prefixed with the production date so stepping to another day never
  // carries one day's ticks or collapsed sections onto another, and stepping
  // back finds them where they were left. In-memory only, like the orders
  // themselves — this is a service-time aid, not a production record.
  const prodDateKey = dateKeyOf(prodDate);
  const [prepDone, setPrepDone] = useState<Record<string, boolean>>({});
  const [clientCollapse, setClientCollapse] = useState<Record<string, boolean>>({});
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const togglePrepDone = (key: string) => {
    haptics.selection();
    setPrepDone(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const emailToCompany = useMemo(() => {
    const map = new Map<string, string>();
    allUsers.forEach(u => { if (u.companyName) map.set(u.email, u.companyName); });
    return map;
  }, [allUsers]);

  // Registered client records (address, contact email) keyed by name — a
  // client that only shows up via CartItem grouping (e.g. no matching
  // `companies` entry, like a stale/legacy company name on a user) simply
  // won't have one, and the note falls back to a manual recipient.
  const companyByName = useMemo(() => {
    const map = new Map<string, Company>();
    companies.forEach(c => map.set(c.name, c));
    return map;
  }, [companies]);

  // Two views per client: `categories` is the aggregated cook-quantity list
  // (grouped by category, like a delivery note), `rows` is the per-person
  // manifest (one row per order-item, unaggregated, carrying the customer's
  // name and their own `item.notes` — "Remove Aioli", "Gluten allergy" —
  // exactly what the printed Special Request sheets are for) that a plain
  // aggregate total would erase.
  const productionSheet = useMemo(() => {
    const grandTotal = new Map<string, number>();
    const byClient = new Map<string, { categoryAgg: Map<string, { category: string; qty: number }>; rows: ManifestRow[]; address?: string }>();
    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const placedAt = new Date(o.timestamp);
      const clientName = (o.userEmail && emailToCompany.get(o.userEmail)) || UNASSIGNED_CLIENT;
      const company = companyByName.get(clientName);
      const addressLine = o.deliveryAddress
        ? [o.deliveryAddress.street, o.deliveryAddress.suburb, o.deliveryAddress.city].filter(Boolean).join(', ')
        : company?.address
          ? [company.address.unit, company.address.street, company.address.suburb, company.address.city].filter(Boolean).join(', ')
          : undefined;

      o.items.forEach(item => {
        if (!isSameDay(getItemDueDate(item, placedAt), prodDate)) return;
        grandTotal.set(item.name, (grandTotal.get(item.name) || 0) + item.quantity);
        const entry = byClient.get(clientName) ?? { categoryAgg: new Map<string, { category: string; qty: number }>(), rows: [] };
        const existing = entry.categoryAgg.get(item.name);
        entry.categoryAgg.set(item.name, { category: item.category, qty: (existing?.qty || 0) + item.quantity });
        entry.rows.push({
          customerName: o.userName || 'Guest',
          category: item.category,
          itemName: item.name,
          qty: item.quantity,
          notes: item.notes,
        });
        if (!entry.address && addressLine) entry.address = addressLine;
        byClient.set(clientName, entry);
      });
    });
    const clients = Array.from(byClient.entries())
      .map(([name, { categoryAgg, rows, address }]) => {
        const catMap = new Map<string, { name: string; qty: number }[]>();
        categoryAgg.forEach(({ category, qty }, itemName) => {
          const arr = catMap.get(category) ?? [];
          arr.push({ name: itemName, qty });
          catMap.set(category, arr);
        });
        const categories = Array.from(catMap.entries())
          .map(([category, items]) => ({
            category,
            items: items.sort((a, b) => b.qty - a.qty),
            subtotal: items.reduce((sum, i) => sum + i.qty, 0),
          }))
          .sort((a, b) => a.category.localeCompare(b.category));
        const sortedRows = [...rows].sort((a, b) =>
          a.category.localeCompare(b.category) || a.customerName.localeCompare(b.customerName)
        );
        return {
          name,
          address,
          total: categories.reduce((sum, c) => sum + c.subtotal, 0),
          categories,
          rows: sortedRows,
          // How many of this client's rows carry a special request — surfaced
          // as a badge and a filter, so an allergy or a removal can't get
          // lost partway down a long manifest.
          flagged: sortedRows.filter(r => r.notes).length,
        };
      })
      .sort((a, b) => {
        if (a.name === UNASSIGNED_CLIENT) return 1;
        if (b.name === UNASSIGNED_CLIENT) return -1;
        return a.name.localeCompare(b.name);
      });
    return {
      grandTotal: Array.from(grandTotal.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, qty]) => ({ name, qty })),
      clients,
      flaggedTotal: clients.reduce((sum, c) => sum + c.flagged, 0),
    };
  }, [orders, prodDate, emailToCompany, companyByName]);

  // Day-level prep progress across every client on the sheet — the same
  // per-line counting the client headers do, rolled up so the kitchen can see
  // how far through the day it is without opening each section in turn.
  const prepSummary = useMemo(() => {
    let lines = 0;
    let done = 0;
    productionSheet.clients.forEach(client => {
      client.categories.forEach(cat => cat.items.forEach(item => {
        lines++;
        if (prepDone[`${prodDateKey}|${client.name}|${item.name}`]) done++;
      }));
    });
    return { lines, done };
  }, [productionSheet, prepDone, prodDateKey]);

  // "Send" dialog — two documents, one dialog. `sendModalClient` is either
  // one client's name (a per-client Delivery Note: address, category totals,
  // and a per-person manifest with each item's own notes — what a printed
  // Betway-style sheet is) or PRODUCTION_SHEET_SENTINEL (the whole day's
  // Grand Total + every client's category totals in one document — the back
  // kitchen's own cooking reference). Neither ever goes to the corporate
  // client — both default to `kitchenEmail`, the internal back-of-house
  // inbox, since these are kitchen documents, not customer-facing ones.
  // On native, "Send" renders a branded/color-coded PDF (via expo-print) and
  // attaches it to a real email through the device's mail app
  // (expo-mail-composer); there's no backend/email-sending service in this
  // app, so composing through the admin's own installed mail app is how
  // "send" actually works here. MailComposer has no attachment/native-
  // composer support on web (a browser can't launch OS mail with a local
  // file attached), so there we fall back to the plain-text mailto: link —
  // same fallback used if PDF generation itself fails for any reason.
  const [sendModalClient, setSendModalClient] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState('');
  const [sendEmailError, setSendEmailError] = useState('');
  const [sending, setSending] = useState(false);

  const openSendModal = (target: string) => {
    setSendEmail(kitchenEmail || '');
    setSendEmailError('');
    setSendModalClient(target);
  };

  const handleSendNote = async () => {
    const email = sendEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSendEmailError('Enter a valid email address');
      return;
    }
    const dateLabel = prodDate.toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const isWholeSheet = sendModalClient === PRODUCTION_SHEET_SENTINEL;

    let subject: string;
    let body: string;
    let buildHtml: () => string;

    if (isWholeSheet) {
      subject = `Production Sheet — ${dateLabel}`;
      const lines: string[] = ['PRODUCTION SHEET', dateLabel, ''];
      productionSheet.grandTotal.forEach(item => lines.push(`  ${item.qty}x  ${item.name}`));
      productionSheet.clients.forEach(client => {
        lines.push('', `${client.name.toUpperCase()} · ${client.total}x`);
        client.categories.forEach(cat => {
          lines.push(cat.category);
          cat.items.forEach(item => lines.push(`  ${item.qty}x  ${item.name}`));
        });
      });
      body = lines.join('\n');
      buildHtml = () => buildProductionSheetHtml(dateLabel, productionSheet.grandTotal, productionSheet.clients);
    } else {
      const client = productionSheet.clients.find(c => c.name === sendModalClient);
      if (!client) return;
      const company = companyByName.get(client.name);
      const addressLine = company?.address
        ? [company.address.unit, company.address.street, company.address.suburb, company.address.city].filter(Boolean).join(', ')
        : client.address;

      subject = `Delivery Note — ${client.name} — ${dateLabel}`;
      const lines: string[] = [`${client.name.toUpperCase()} DELIVERY NOTE`];
      if (addressLine) lines.push(addressLine);
      lines.push(dateLabel, '');
      let currentCategory = '';
      client.rows.forEach(row => {
        if (row.category !== currentCategory) {
          currentCategory = row.category;
          lines.push(currentCategory);
        }
        lines.push(`  ${row.qty}x  ${row.itemName} — ${row.customerName}${row.notes ? ` | ${row.notes}` : ''}`);
      });
      lines.push('', `Total items: ${client.total}`);
      body = lines.join('\n');
      buildHtml = () => buildDeliveryNoteHtml(client.name, dateLabel, addressLine, client.rows);
    }

    const mailtoFallback = () =>
      Linking.openURL(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);

    setSending(true);
    try {
      // expo-print's web shim has no printToFileAsync (it just calls the
      // browser's window.print()) and expo-mail-composer's web shim reports
      // isAvailableAsync() as true even though it can't attach a file — so
      // the PDF+attachment path is native-only. On web, skip straight to
      // the mailto fallback rather than triggering a stray print dialog.
      const canCompose = Platform.OS !== 'web' && await MailComposer.isAvailableAsync();
      if (canCompose) {
        const { uri } = await Print.printToFileAsync({ html: buildHtml() });
        await MailComposer.composeAsync({ recipients: [email], subject, body, attachments: [uri] });
      } else {
        mailtoFallback();
      }
      haptics.success();
      setSendModalClient(null);
    } catch {
      // PDF generation or the native composer failed — the plain-text note
      // still reaches the kitchen inbox, just without the formatted attachment.
      mailtoFallback();
      setSendModalClient(null);
    } finally {
      setSending(false);
    }
  };

  // Order Queue entries — a corporate client's employees are one physical
  // delivery batch (same company, same due date), so they collapse into one
  // card with one shared status control instead of N near-identical cards;
  // updating any one order in a batch already moves every sibling via
  // updateOrderStatus's own batching (KitchenCoContext.tsx), this just makes
  // the Chef tab's queue reflect that reality instead of hiding it behind
  // duplicate cards. Individual/guest orders (no matched company) still get
  // their own card, since they really are delivered separately.
  const queueEntries = useMemo(() => {
    interface QueueEntry {
      key: string;
      title: string;
      subtitle: string;
      isBatch: boolean;
      dueToday: boolean;
      status: string;
      items: { id: string; quantity: number; name: string; selectedSize?: string; addOns?: AddOnOption[] }[];
      updateTargetId: string;
      /** Earliest due date across the entry's items — drives both the card's
       *  due badge and the queue's ordering. */
      dueDate: Date;
    }
    const batches = new Map<string, { companyName: string; orders: Order[]; dueToday: boolean; dueDate: Date }>();
    const singles: QueueEntry[] = [];

    ordersWithDueToday.forEach(({ order, dueToday }) => {
      const placedAt = new Date(order.timestamp);
      const dueDates = order.items
        .map(item => getItemDueDate(item, placedAt))
        .sort((a, b) => a.getTime() - b.getTime());
      // An order with no items can't have a due date of its own; fall back to
      // when it was placed so it still sorts and renders somewhere sane.
      const earliestDue = dueDates[0] ?? placedAt;
      const companyName = order.userEmail ? emailToCompany.get(order.userEmail) : undefined;
      if (!companyName) {
        singles.push({
          key: order.id,
          title: order.id,
          subtitle: order.userName || 'Guest',
          isBatch: false,
          dueToday,
          status: order.status,
          items: order.items,
          updateTargetId: order.id,
          dueDate: earliestDue,
        });
        return;
      }
      const batchKey = `${companyName}::${dateKeyOf(earliestDue)}`;
      const entry = batches.get(batchKey) ?? { companyName, orders: [], dueToday: false, dueDate: earliestDue };
      entry.orders.push(order);
      entry.dueToday = entry.dueToday || dueToday;
      batches.set(batchKey, entry);
    });

    const batchEntries: QueueEntry[] = Array.from(batches.entries()).map(([key, b]) => {
      const itemMap = new Map<string, number>();
      b.orders.forEach(o => o.items.forEach(item => itemMap.set(item.name, (itemMap.get(item.name) || 0) + item.quantity)));
      return {
        key,
        title: b.companyName,
        subtitle: `${b.orders.length} order${b.orders.length === 1 ? '' : 's'}`,
        isBatch: true,
        dueToday: b.dueToday,
        status: b.orders[0].status,
        items: Array.from(itemMap.entries()).map(([name, quantity], i) => ({ id: `${key}-${i}`, quantity, name })),
        updateTargetId: b.orders[0].id,
        dueDate: b.dueDate,
      };
    });

    // Soonest-due first, so anything already overdue surfaces above today's
    // work and today's above the rest — the order a kitchen actually cooks in.
    return [...batchEntries, ...singles].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [ordersWithDueToday, emailToCompany]);

  // Deliberately no early return on an empty queue. The Production Sheet
  // spans past and future days and includes delivered orders on purpose, so
  // once a day's orders are all delivered the chef must still be able to step
  // back and read that day's sheet — bailing out here made it unreachable.
  // The empty state now lives inside the Order Queue, which is the only part
  // that actually depends on there being active orders.
  const todayKey = dateKeyOf(new Date());
  // Past two clients on one day the sheet gets long, so sections start
  // collapsed and the chef opens whichever one is being packed. One or two
  // clients stay open, where collapsing would only cost a tap.
  const defaultCollapsed = productionSheet.clients.length > 2;

  // "Collapse all" flips to "Expand all" once everything is shut. Reads the
  // same override-or-default the sections themselves use, so the button always
  // describes what will actually happen rather than tracking its own flag.
  const allCollapsed = productionSheet.clients.length > 0
    && productionSheet.clients.every(c => clientCollapse[`${prodDateKey}|${c.name}`] ?? defaultCollapsed);
  const toggleAllClients = () => {
    haptics.selection();
    setClientCollapse(prev => {
      const next = { ...prev };
      productionSheet.clients.forEach(c => { next[`${prodDateKey}|${c.name}`] = !allCollapsed; });
      return next;
    });
  };

  // Jump from a queue card to that client's section of the Production Sheet.
  // The queue spans days, so this moves the sheet to the entry's own due date
  // before expanding it — keying the override off that date, not the one
  // currently on screen — and scrolls back up, since the sheet sits above.
  const showClientInSheet = (clientName: string, dueDate: Date) => {
    haptics.selection();
    setProdDate(dueDate);
    setClientCollapse(prev => ({ ...prev, [`${dateKeyOf(dueDate)}|${clientName}`]: false }));
    scrollToTop();
  };

  return (
    <>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.greeting}>Chef's Kitchen</Text>
          <Text style={styles.greetingSub}>{activeOrders.length} active order{activeOrders.length === 1 ? '' : 's'}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionCardHeader}>
          <Text style={styles.sectionCardTitle}>Production Sheet</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {!isProdDateToday && (
              <TouchableOpacity onPress={() => setProdDate(new Date())} accessibilityRole="button" accessibilityLabel="Jump to today">
                <Text style={styles.seeAllText}>Today</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => openSendModal(PRODUCTION_SHEET_SENTINEL)}
              accessibilityRole="button"
              accessibilityLabel="Send the whole day's production sheet to the kitchen"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="mail-outline" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.dateNavRow}>
          <TouchableOpacity
            style={styles.dateNavBtn}
            onPress={() => shiftProdDate(-1)}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
          >
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.dateNavLabel}>
            {prodDate.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
            {isProdDateToday ? ' · Today' : ''}
          </Text>
          <TouchableOpacity
            style={styles.dateNavBtn}
            onPress={() => shiftProdDate(1)}
            accessibilityRole="button"
            accessibilityLabel="Next day"
          >
            <Ionicons name="chevron-forward" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        {prepSummary.lines > 0 && (
          <View style={styles.prodSummaryRow}>
            <Text style={[styles.prodSummaryText, prepSummary.done === prepSummary.lines && styles.prodProgressDone]}>
              {prepSummary.done}/{prepSummary.lines} prepped
            </Text>
            <TouchableOpacity
              onPress={toggleAllClients}
              accessibilityRole="button"
              accessibilityLabel={allCollapsed ? 'Expand all clients' : 'Collapse all clients'}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.prodSummaryAction}>{allCollapsed ? 'Expand all' : 'Collapse all'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!kitchenEmail && (
          <TouchableOpacity
            style={styles.kitchenEmailWarning}
            onPress={onEditKitchenEmail}
            accessibilityRole="button"
            accessibilityLabel="Set the kitchen notification email"
          >
            <Ionicons name="alert-circle" size={14} color={theme.warning} />
            <Text style={styles.kitchenEmailWarningText}>
              No kitchen email set — Send will open with a blank recipient. Tap to set one.
            </Text>
          </TouchableOpacity>
        )}

        {productionSheet.grandTotal.length === 0 ? (
          <Text style={styles.emptySub}>No items due on this day</Text>
        ) : (
          <>
            {productionSheet.flaggedTotal > 0 && (
              <TouchableOpacity
                style={[styles.flagChip, flaggedOnly && styles.flagChipActive]}
                onPress={() => { haptics.selection(); setFlaggedOnly(v => !v); }}
                accessibilityRole="switch"
                // aria-checked for the same reason as the prep rows below:
                // react-native-web 0.21 drops accessibilityState, leaving a
                // switch with no on/off state in the DOM.
                aria-checked={flaggedOnly}
                accessibilityLabel="Show only items carrying a special request"
              >
                <Ionicons name="flag" size={11} color={flaggedOnly ? theme.white : theme.error} />
                <Text style={[styles.flagChipText, flaggedOnly && styles.flagChipTextActive]}>
                  {productionSheet.flaggedTotal} special request{productionSheet.flaggedTotal === 1 ? '' : 's'}
                  {flaggedOnly ? ' · showing only these' : ''}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.prodClientHeader, { marginTop: 0 }]}>Grand Total</Text>
            {productionSheet.grandTotal.map((item, idx) => (
              <View key={item.name} style={[styles.prepListRow, idx === 0 && { borderTopWidth: 0 }]}>
                <Text style={styles.prepListQty}>{item.qty}x</Text>
                <Text style={styles.prepListName} numberOfLines={1}>{item.name}</Text>
              </View>
            ))}

            {productionSheet.clients.map(client => {
              const collapseKey = `${prodDateKey}|${client.name}`;
              const collapsed = clientCollapse[collapseKey] ?? defaultCollapsed;
              // Prep progress counts distinct dish lines, not portions — a
              // chef ticks off "Beef Lasagne" once the whole tray is done,
              // not once per portion in it.
              const prepLines = client.categories.reduce((sum, cat) => sum + cat.items.length, 0);
              const prepDoneCount = client.categories.reduce(
                (sum, cat) => sum + cat.items.filter(i => prepDone[`${prodDateKey}|${client.name}|${i.name}`]).length,
                0
              );
              const visibleRows = flaggedOnly ? client.rows.filter(row => row.notes) : client.rows;
              return (
                <View key={client.name}>
                  <View style={styles.prodClientHeaderRow}>
                    <TouchableOpacity
                      style={styles.prodClientHeaderLeft}
                      onPress={() => {
                        haptics.selection();
                        setClientCollapse(prev => ({ ...prev, [collapseKey]: !collapsed }));
                      }}
                      accessibilityRole="button"
                      // aria-expanded, not accessibilityState: react-native-web
                      // 0.21 drops accessibilityState entirely, so the collapse
                      // state would never reach the DOM. The aria-* props map on
                      // native too (RN 0.71+), so this is the portable form.
                      aria-expanded={!collapsed}
                      accessibilityLabel={`${client.name}, ${client.total} items, ${prepDoneCount} of ${prepLines} prepped`}
                    >
                      <Ionicons name={collapsed ? 'chevron-forward' : 'chevron-down'} size={14} color={theme.textSecondary} />
                      <Text
                        style={[styles.prodClientHeader, { marginTop: 0, marginBottom: 0, flexShrink: 1 }]}
                        numberOfLines={1}
                      >
                        {client.name} · {client.total}x
                      </Text>
                      {client.flagged > 0 && (
                        <View style={styles.flagBadge}>
                          <Text style={styles.flagBadgeText}>{client.flagged}</Text>
                        </View>
                      )}
                      {prepLines > 0 && (
                        <Text style={[styles.prodProgress, prepDoneCount === prepLines && styles.prodProgressDone]}>
                          {prepDoneCount}/{prepLines}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => openSendModal(client.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Send ${client.name} delivery note`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="mail-outline" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {client.address ? <Text style={styles.prodAddressText}>{client.address}</Text> : null}

                  {!collapsed && (
                    <>
                      <Text style={styles.prodSubLabel}>Prep Totals</Text>
                      {client.categories.map(cat => (
                        <View key={cat.category}>
                          <Text style={styles.prodCategoryLabel}>{cat.category}</Text>
                          {cat.items.map((item, idx) => {
                            const doneKey = `${prodDateKey}|${client.name}|${item.name}`;
                            const done = !!prepDone[doneKey];
                            return (
                              <TouchableOpacity
                                key={item.name}
                                style={[styles.prepListRow, idx === 0 && { borderTopWidth: 0 }]}
                                onPress={() => togglePrepDone(doneKey)}
                                activeOpacity={0.6}
                                accessibilityRole="checkbox"
                                // Same reason as the client header above —
                                // without this the row lands in the DOM as a
                                // checkbox that never announces whether it is
                                // ticked.
                                aria-checked={done}
                                accessibilityLabel={`${item.qty} ${item.name}`}
                              >
                                <Ionicons
                                  name={done ? 'checkbox' : 'square-outline'}
                                  size={18}
                                  color={done ? theme.success : theme.textTertiary}
                                />
                                <Text style={[styles.prepListQty, done && styles.prepDoneText]}>{item.qty}x</Text>
                                <Text style={[styles.prepListName, done && styles.prepDoneText]} numberOfLines={1}>{item.name}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}

                      <View style={styles.prodSubLabelRow}>
                        <Text style={styles.prodSubLabel}>Special Requests</Text>
                        {client.flagged > 0 && <Text style={styles.prodSubLabelCount}>{client.flagged} flagged</Text>}
                      </View>
                      {visibleRows.length === 0 ? (
                        <Text style={styles.emptySub}>
                          {flaggedOnly ? 'No special requests for this client' : 'Nothing to pack for this client'}
                        </Text>
                      ) : visibleRows.map((row, idx) => {
                        const colors = getCategoryColor(row.category);
                        return (
                          <View key={`${row.customerName}-${row.itemName}-${idx}`} style={[styles.manifestRow, idx === 0 && { borderTopWidth: 0 }]}>
                            <View style={styles.manifestRowTop}>
                              <View style={[styles.categoryPill, { backgroundColor: colors.bg }]}>
                                <Text style={[styles.categoryPillText, { color: colors.text }]} numberOfLines={1}>{row.category}</Text>
                              </View>
                              <Text style={styles.manifestQty}>{row.qty}x</Text>
                              <Text style={styles.manifestItem} numberOfLines={1}>{row.itemName}</Text>
                            </View>
                            <Text style={styles.manifestName}>{row.customerName}</Text>
                            {row.notes ? <Text style={styles.manifestNotes}>📝 {row.notes}</Text> : null}
                          </View>
                        );
                      })}
                    </>
                  )}
                </View>
              );
            })}
          </>
        )}
      </View>

      <Text style={styles.chefQueueTitle}>Order Queue</Text>
      {queueEntries.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="restaurant-outline" size={40} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>Nothing to prep</Text>
          <Text style={styles.emptySub}>Active orders will show up here for the kitchen</Text>
        </View>
      )}
      {queueEntries.map((entry, idx) => {
        const flowIdx = STATUS_FLOW.indexOf(entry.status);
        const isTerminal = entry.status === 'delivered' || entry.status === 'cancelled';
        const isOverdue = !entry.dueToday && dateKeyOf(entry.dueDate) < todayKey;
        return (
          <View key={entry.key} style={[styles.orderCard, idx === 0 && { marginTop: 4 }]}>
            <View style={styles.orderCardHeader}>
              <TouchableOpacity
                style={styles.orderCardLeft}
                onPress={() => showClientInSheet(entry.isBatch ? entry.title : UNASSIGNED_CLIENT, entry.dueDate)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Show ${entry.isBatch ? entry.title : UNASSIGNED_CLIENT} in the production sheet`}
              >
                <View style={styles.chefOrderIdRow}>
                  {entry.isBatch && <Ionicons name="business" size={13} color={theme.textSecondary} style={{ marginRight: 4 }} />}
                  <Text style={styles.orderCardId}>{entry.title}</Text>
                  <Ionicons name="open-outline" size={12} color={theme.textTertiary} />
                  {entry.dueToday ? (
                    <View style={styles.dueTodayBadge}>
                      <Text style={styles.dueTodayBadgeText}>DUE TODAY</Text>
                    </View>
                  ) : (
                    <View style={[styles.dueDateBadge, isOverdue && styles.dueOverdueBadge]}>
                      <Text style={[styles.dueDateBadgeText, isOverdue && styles.dueOverdueBadgeText]}>
                        {isOverdue ? 'OVERDUE · ' : 'DUE '}
                        {entry.dueDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.orderCardUser}>{entry.subtitle}</Text>
              </TouchableOpacity>
              <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[entry.status] || '#6B6B6B') + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[entry.status] || '#6B6B6B' }]}>
                  {STATUS_LABELS[entry.status] || entry.status}
                </Text>
              </View>
            </View>

            <View style={styles.orderCardExpanded}>
              <View style={styles.orderDivider} />
              {entry.items.map((dish) => (
                <View key={dish.id} style={styles.orderDishRow}>
                  <Text style={styles.orderDishName}>
                    {dish.quantity}x {dish.name}
                    {dish.selectedSize ? <Text style={styles.orderDishSize}> — {dish.selectedSize}</Text> : null}
                    {dish.addOns && dish.addOns.length > 0 ? (
                      <Text style={styles.orderDishSize}> (+ {dish.addOns.map(a => a.name).join(', ')})</Text>
                    ) : null}
                  </Text>
                </View>
              ))}

              {!isTerminal && (
                <>
                  <View style={styles.orderDivider} />
                  <Text style={styles.statusFlowLabel}>UPDATE STATUS</Text>
                  <View style={styles.statusFlowRow}>
                    {STATUS_FLOW.map((status, sIdx) => {
                      const isCurrent = status === entry.status;
                      const isPast = sIdx < flowIdx;
                      return (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusFlowChip,
                            isCurrent && { backgroundColor: STATUS_COLORS[status], borderColor: STATUS_COLORS[status] },
                            isPast && styles.statusFlowChipPast,
                          ]}
                          onPress={() => { haptics.selection(); updateOrderStatus(entry.updateTargetId, status); }}
                          disabled={isCurrent}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isCurrent, disabled: isCurrent }}
                          accessibilityLabel={`Mark as ${STATUS_LABELS[status]}`}
                        >
                          <Text style={[
                            styles.statusFlowChipText,
                            isCurrent && styles.statusFlowChipTextCurrent,
                            isPast && styles.statusFlowChipTextPast,
                          ]}>
                            {STATUS_LABELS[status]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </View>
        );
      })}

      <Modal visible={sendModalClient !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {sendModalClient === PRODUCTION_SHEET_SENTINEL ? 'Send Production Sheet' : 'Send Delivery Note'}
              </Text>
              <TouchableOpacity
                onPress={() => setSendModalClient(null)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              {sendModalClient === PRODUCTION_SHEET_SENTINEL ? 'All clients' : sendModalClient} · {prodDate.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
            <TextInput
              style={[styles.modalInput, sendEmailError ? styles.modalInputError : null]}
              placeholder="Kitchen / back-of-house email"
              placeholderTextColor={theme.textTertiary}
              value={sendEmail}
              onChangeText={(val) => { setSendEmail(val); setSendEmailError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!sending}
            />
            {sendEmailError ? <Text style={styles.modalFieldError}>{sendEmailError}</Text> : null}
            <Text style={styles.modalHint}>
              Goes to whoever has access to the back kitchen, not the client — set a default under Dashboard → Kitchen Notifications. Attaches a branded, color-coded PDF where your device supports it; otherwise opens a plain-text email instead.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSendModalClient(null)} disabled={sending} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSaveBtn, sending && { opacity: 0.6 }]} onPress={handleSendNote} disabled={sending} accessibilityRole="button">
                <Text style={styles.modalSaveText}>{sending ? 'Preparing…' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function WeeksSection({ activeWeek, setActiveWeek, theme }: { activeWeek: number; setActiveWeek: (w: number) => void; theme: ThemeColors }) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const weeks = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.greeting}>Menu Cycles</Text>
          <Text style={styles.greetingSub}>Select which week is active</Text>
        </View>
      </View>

      <View style={styles.weeksGrid}>
        {weeks.map((week) => {
          const isActive = activeWeek === week;
          return (
            <TouchableOpacity
              key={week}
              style={[styles.weekGridCard, isActive && styles.weekGridCardActive]}
              onPress={() => { haptics.selection(); setActiveWeek(week); }}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Week ${week}${isActive ? ', active' : ''}`}
            >
              <Text style={[styles.weekGridNumber, isActive && styles.weekGridNumberActive]}>
                {week}
              </Text>
              <Text style={[styles.weekGridLabel, isActive && styles.weekGridLabelActive]}>
                Week {week}
              </Text>
              {isActive && (
                <View style={styles.weekGridCheck}>
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoIconWrap}>
          <Ionicons name="information-circle" size={22} color="#5AC8FA" />
        </View>
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Currently Active</Text>
          <Text style={styles.infoText}>
            Week <Text style={{ color: '#22C55E', fontWeight: '800' }}>{activeWeek}</Text> menu is being shown to customers
          </Text>
        </View>
      </View>
    </>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  // Shell header
  shellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  shellTitle: { fontSize: 20, fontWeight: '900', color: theme.text, letterSpacing: -0.3 },
  shellSubtitle: { fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginTop: 2 },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  previewBtnText: { color: theme.text, fontSize: 12, fontWeight: '800' },

  // Horizontal-scroll pill nav
  tabBar: {
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexGrow: 0,
  },
  tabBarContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tabPillActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  tabPillLabel: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  tabPillLabelActive: { color: theme.onAccent },

  // Page Header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    borderRadius: 20,
    padding: 18,
    paddingTop: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  statAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
    marginTop: 4,
  },

  // Today at a Glance
  todayCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  todayCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  todayCardTitle: { fontSize: 14, fontWeight: '800', color: theme.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  todayCardRow: { flexDirection: 'row', alignItems: 'center' },
  todayTile: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  todayTileDivider: { width: 1, height: 40, backgroundColor: theme.border },
  todayTileNumber: { fontSize: 30, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
  todayTileNumberAlert: { color: '#FF9500' },
  todayTileLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  todayList: { marginTop: 16, borderTopWidth: 1, borderTopColor: theme.border },
  todayListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  todayListStatusDot: { width: 8, height: 8, borderRadius: 4 },
  todayListId: { fontSize: 13, fontWeight: '700', color: theme.text },
  todayListName: { flex: 1, fontSize: 13, color: theme.textSecondary },
  todayListQty: { fontSize: 12, fontWeight: '700', color: theme.text },
  todayListMore: { paddingTop: 10, alignItems: 'center' },
  todayListMoreText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },

  // Chef's Kitchen
  prepListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 12,
  },
  prepListQty: { fontSize: 15, fontWeight: '900', color: theme.text, width: 40 },
  prepListName: { flex: 1, fontSize: 14, color: theme.text, fontWeight: '600' },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 8,
  },
  dateNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavLabel: { fontSize: 15, fontWeight: '800', color: theme.text, minWidth: 150, textAlign: 'center' },
  prodClientHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 4,
  },
  prodClientHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 4,
  },
  prodCategoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 10,
  },
  prodAddressText: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  prodSubLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.text,
    marginTop: 16,
    marginBottom: 2,
  },
  manifestRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  manifestRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, maxWidth: 110 },
  categoryPillText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  manifestQty: { fontSize: 13, fontWeight: '900', color: theme.text },
  manifestItem: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.text },
  manifestName: { fontSize: 12, color: theme.textSecondary, marginTop: 2, marginLeft: 2 },
  manifestNotes: { fontSize: 12, color: theme.error, fontWeight: '600', marginTop: 2, marginLeft: 2 },
  chefQueueTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  chefOrderIdRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dueTodayBadge: { backgroundColor: '#FFF3C4', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  dueTodayBadgeText: { fontSize: 9, fontWeight: '800', color: '#8A6D00', letterSpacing: 0.3 },
  dueDateBadge: { backgroundColor: theme.surfaceSecondary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  dueDateBadgeText: { fontSize: 9, fontWeight: '800', color: theme.textSecondary, letterSpacing: 0.3 },
  dueOverdueBadge: { backgroundColor: theme.error + '20' },
  dueOverdueBadgeText: { color: theme.error },
  prodClientHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  prodProgress: { fontSize: 11, fontWeight: '800', color: theme.textTertiary },
  prodProgressDone: { color: theme.success },
  prepDoneText: { textDecorationLine: 'line-through', color: theme.textTertiary },
  prodSubLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  prodSubLabelCount: { fontSize: 11, fontWeight: '800', color: theme.error },
  flagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
  },
  flagChipActive: { backgroundColor: theme.error },
  flagChipText: { fontSize: 11, fontWeight: '800', color: theme.error, letterSpacing: 0.2 },
  flagChipTextActive: { color: theme.white },
  flagBadge: {
    backgroundColor: theme.error,
    borderRadius: 999,
    minWidth: 16,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignItems: 'center',
  },
  flagBadgeText: { fontSize: 9, fontWeight: '900', color: theme.white },
  prodSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  prodSummaryText: { fontSize: 12, fontWeight: '800', color: theme.textSecondary },
  prodSummaryAction: { fontSize: 12, fontWeight: '800', color: theme.text, textDecorationLine: 'underline' },
  kitchenEmailWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.warning + '1F',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
  },
  kitchenEmailWarningText: { flex: 1, fontSize: 11, fontWeight: '700', color: theme.text },

  // Revenue trend: a de-emphasis-ink column strip with the current period in
  // full ink. Bars cap at 24px wide and carry a 4px rounded data-end, the
  // baseline is a solid hairline, and the axis labels live outside the plot
  // height so the card grows to include them rather than clipping them.
  trendCaption: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginTop: -8, marginBottom: 16 },
  trendPlot: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: TREND_PLOT_HEIGHT },
  trendColumn: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  trendBar: { width: '100%', maxWidth: 24, backgroundColor: theme.textTertiary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  trendBarCurrent: { backgroundColor: theme.text },
  trendAxis: { height: 1, backgroundColor: theme.border },
  trendAxisLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  trendAxisLabel: { fontSize: 10, fontWeight: '700', color: theme.textTertiary },

  // Section Card
  sectionCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
    textDecorationLine: 'underline',
    marginBottom: 16,
  },

  // Breakdown
  breakdownContainer: { gap: 12 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 110,
    gap: 8,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  breakdownBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownCount: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.text,
    width: 30,
    textAlign: 'right',
  },

  // Week Card
  weekCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  weekCardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EAF7EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 3,
  },
  weekCardValue: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.text,
  },
  weekCardBtn: {
    backgroundColor: theme.surfaceSecondary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  weekCardBtnText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '700',
  },

  // Recent Orders
  recentOrderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  recentOrderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  recentOrderStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recentOrderId: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  recentOrderUser: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 1,
  },
  recentOrderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  recentOrderTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.text,
  },
  recentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recentStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Users
  addBtn: {
    backgroundColor: '#22C55E',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: '800',
  },
  userInfo: { flex: 1 },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  adminBadge: {
    backgroundColor: '#FFF3C4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: '#8A6D00',
    fontSize: 10,
    fontWeight: '800',
  },
  companyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#5AC8FA20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  companyBadgeText: { color: '#5AC8FA', fontSize: 10, fontWeight: '800' },
  userEmail: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  userMeta: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FF453A20',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Orders
  orderCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    position: 'relative',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderCardLeft: { flex: 1 },
  orderCardId: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.text,
  },
  orderCardUser: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  orderCardDate: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 6,
  },
  orderCardExpanded: {
    marginTop: 12,
  },
  orderDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 10,
  },
  orderDishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  orderDishName: {
    fontSize: 13,
    color: theme.textSecondary,
    flex: 1,
    paddingRight: 8,
  },
  orderDishSize: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  orderDishPrice: {
    fontSize: 13,
    color: theme.text,
    fontWeight: '600',
  },
  orderTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotalLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  orderTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
  },
  orderAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  orderAddressText: {
    fontSize: 12,
    color: theme.textSecondary,
    flex: 1,
  },
  statusFlowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textSecondary,
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 10,
  },
  statusFlowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statusFlowChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceSecondary,
  },
  statusFlowChipPast: { backgroundColor: theme.border, borderColor: theme.border },
  statusFlowChipText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  statusFlowChipTextCurrent: { color: '#000000' },
  statusFlowChipTextPast: { color: '#1DA836' },
  cancelOrderBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  cancelOrderBtnText: { color: '#E0393E', fontSize: 12, fontWeight: '700' },
  expandArrow: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Weeks
  weeksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  weekGridCard: {
    width: (SCREEN_WIDTH - 42) / 4,
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    position: 'relative',
    minHeight: 90,
    justifyContent: 'center',
  },
  weekGridCardActive: {
    borderColor: '#22C55E',
    backgroundColor: '#EAF7EE',
  },
  weekGridNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.text,
  },
  weekGridNumberActive: {
    color: '#22C55E',
  },
  weekGridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 4,
  },
  weekGridLabelActive: {
    color: '#22C55E',
  },
  weekGridCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EAF4FB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D6EAF8',
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#5AC8FA20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: { flex: 1 },
  // infoCard's background is a fixed light-blue tint in both themes (see
  // infoCard above) — its text must stay literal dark too, or it goes
  // invisible against that tint once theme.text/textSecondary flip to white.
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
  },
  infoText: {
    color: '#6B6B6B',
    fontSize: 12,
    lineHeight: 18,
  },

  // Category Tabs
  categoryTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  categoryTab: {
    backgroundColor: theme.surface,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  categoryTabActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  categoryTabTextActive: {
    color: '#000000',
  },

  // Discounts
  discountCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  discountTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountCodeSection: {
    flex: 1,
  },
  discountCodeTag: {
    backgroundColor: '#22C55E20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  discountCodeText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#22C55E',
    letterSpacing: 1,
  },
  discountPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  discountToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  discountToggleOn: {
    backgroundColor: '#22C55E',
    alignItems: 'flex-end',
  },
  discountToggleCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.white,
  },
  discountToggleCircleOn: {
    backgroundColor: theme.white,
  },
  discountCompanyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  discountCompanyText: { color: '#5AC8FA', fontSize: 12, fontWeight: '700' },
  discountBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  discountExpiry: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },

  // Menu Management Styles
  categoryFilterRow: {
    marginBottom: 20,
  },
  menuCategorySection: {
    marginBottom: 20,
  },
  menuCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  menuCategoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.3,
  },
  menuCategoryCount: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  menuEmptyItems: {
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  menuEmptyItemsText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  menuItemInfo: {
    flex: 1,
    paddingRight: 12,
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 2,
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 4,
  },
  menuItemDesc: {
    fontSize: 11,
    color: theme.textSecondary,
    lineHeight: 15,
  },
  menuItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  menuEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#5AC8FA20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FF453A20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  categoryPickerRow: {
    marginBottom: 16,
  },
  categoryPickerChip: {
    backgroundColor: theme.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: 8,
  },
  categoryPickerChipActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  categoryPickerChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  categoryPickerChipTextActive: {
    color: '#000000',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.modalOverlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  // Caps the sheet height and lets its middle ScrollView (see modalScrollBody)
  // absorb any overflow — for the one modal here (Add Company) whose field
  // count is taller than a phone screen, so the header/buttons stay pinned
  // and reachable instead of the bottom fields being clipped off-screen.
  modalContentTall: { maxHeight: '85%' },
  modalScrollBody: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: -0.3,
  },
  modalInput: {
    backgroundColor: theme.inputBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: 15,
  },
  modalInputError: { borderColor: theme.error },
  modalFieldError: { color: theme.error, fontSize: 12, fontWeight: '600', marginTop: -8, marginBottom: 12 },
  modalHint: { color: theme.textSecondary, fontSize: 12, lineHeight: 17, marginTop: -4, marginBottom: 16 },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    backgroundColor: theme.surfaceSecondary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalCancelText: {
    color: theme.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  modalSaveBtn: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
    modalSaveText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 14,
  },

  // Small centered dialogs (info / confirm) — distinct from the bottom-sheet
  // add/edit modals above.
  dialogOverlay: { flex: 1, backgroundColor: theme.modalOverlay, justifyContent: 'center', alignItems: 'center' },
  dialogCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 32,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  dialogIcon: { fontSize: 36, marginBottom: 12 },
  dialogTitle: { fontSize: 18, fontWeight: '900', color: theme.text, marginBottom: 8, textAlign: 'center' },
  dialogText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  dialogOkBtn: { backgroundColor: theme.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, alignSelf: 'stretch', alignItems: 'center' },
  dialogOkText: { color: theme.onAccent, fontSize: 15, fontWeight: '800' },
  dialogBtnRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    backgroundColor: theme.surfaceSecondary,
  },
  dialogCancelText: { color: theme.textSecondary, fontSize: 15, fontWeight: '800' },
  dialogDeleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#E0393E', alignItems: 'center' },
  dialogDeleteText: { color: theme.white, fontSize: 15, fontWeight: '800' },

  // Top Selling Items
  topItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 12,
  },
  topItemRank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topItemRankText: { color: theme.textSecondary, fontSize: 11, fontWeight: '800' },
  topItemName: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.text },
  topItemQty: { fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginRight: 6 },
  topItemRevenue: { fontSize: 13, fontWeight: '800', color: theme.text, width: 64, textAlign: 'right' },
  companyStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#5AC8FA20',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Power BI reporting teaser
  biCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F5E6A8',
  },
  biCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  biIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFD60A20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // biCard is a fixed light-yellow tint in both themes (see biCard above) —
  // same reasoning as infoTitle/infoText: its text must stay literal dark.
  biTitle: { fontSize: 15, fontWeight: '800', color: '#8A6D00' },
  biSubtitle: { fontSize: 11, color: '#6B6B6B', fontWeight: '600', marginTop: 2 },
  biText: { fontSize: 12, color: '#6B6B6B', lineHeight: 18 },

  // Company address (Companies tab)
  companyAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  companyAddressText: { fontSize: 11, color: theme.textSecondary, fontWeight: '500', flexShrink: 1 },

  // Modal helper layout
  modalRow: { flexDirection: 'row', gap: 10 },
  modalRowInput: { flex: 1 },
  modalAddLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  modalAddLocationText: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  modalRemoveLocationText: { color: theme.error, fontSize: 12, fontWeight: '700' },

  // Meals tab header actions
  mealsHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 21,
  },
  previewMenuBtnText: { color: theme.text, fontSize: 12, fontWeight: '800' },
});
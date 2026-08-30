import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, ScrollView, TextInput, Modal, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useKitchen, Order, AppUser } from '../../context/KitchenCoContext';
import { Ionicons } from '@expo/vector-icons';
import { calculateDeliveryFee, getItemDueDate, isSameDay } from '../../utils/deliveryHelpers';
import { ThemeColors } from '../../utils/theme';
import { useSimulatedLoad } from '../../utils/useSimulatedLoad';
import { haptics } from '../../utils/haptics';

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
    const { orders, activeWeek, setActiveWeek, allUsers, discounts, addDiscount, updateDiscount, deleteDiscount, deleteUser, addUser, menus, companies, addCompany, deleteCompany, updateOrderStatus, theme } = useKitchen();
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

  // Stats
  const totalUsers = allUsers.length;
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const preparingOrders = orders.filter(o => o.status === 'preparing').length;
  const onTheWayOrders = orders.filter(o => o.status === 'on_the_way').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);

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

  // Reporting aggregates for the Dashboard — this is the exact shape of data
  // that'll eventually feed the Power BI embed (Section 2.4 of the SLA):
  // revenue by category, top-selling items, and revenue by corporate client.
  const revenueByCategory = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach(o => o.items.forEach(item => {
      map.set(item.category, (map.get(item.category) || 0) + item.price * item.quantity);
    }));
    const maxVal = Math.max(1, ...Array.from(map.values()));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, total]) => ({ category, total, pct: (total / maxVal) * 100 }));
  }, [orders]);

  const topItems = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    orders.forEach(o => o.items.forEach(item => {
      const cur = map.get(item.name) || { qty: 0, revenue: 0 };
      cur.qty += item.quantity;
      cur.revenue += item.price * item.quantity;
      map.set(item.name, cur);
    }));
    return Array.from(map.entries())
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5)
      .map(([name, stats]) => ({ name, ...stats }));
  }, [orders]);

  const companyStats = useMemo(() => {
    return companies
      .map(co => {
        const emails = new Set(allUsers.filter(u => u.companyName === co.name).map(u => u.email));
        const coOrders = orders.filter(o => o.userEmail && emails.has(o.userEmail));
        return { company: co, orderCount: coOrders.length, revenue: coOrders.reduce((s, o) => s + o.total, 0) };
      })
      .filter(c => c.orderCount > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [companies, allUsers, orders]);

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
    const parsedDistance = parseFloat(newCompanyDistance);
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
    setShowAddCompany(false);
  };

  const handleAddUser = () => {
    if (newUserName && newUserEmail) {
      const newUser: AppUser = {
        id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
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
                  <Text style={[styles.todayTileNumber, pendingOrders > 0 && styles.todayTileNumberAlert]}>{pendingOrders}</Text>
                  <Text style={styles.todayTileLabel}>Awaiting Acceptance</Text>
                </TouchableOpacity>
              </View>
              {dueTodayOrders.length > 0 && (
                <View style={styles.todayList}>
                  {dueTodayOrders.slice(0, 4).map(({ order, dueItemCount }, idx) => (
                    <TouchableOpacity
                      key={order.id}
                      style={[styles.todayListRow, idx === 0 && { borderTopWidth: 0 }]}
                      onPress={() => setSelectedTab('orders')}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.todayListStatusDot, { backgroundColor: STATUS_COLORS[order.status] || '#6B6B6B' }]} />
                      <Text style={styles.todayListId}>{order.id}</Text>
                      <Text style={styles.todayListName} numberOfLines={1}>{order.userName || 'Guest'}</Text>
                      <Text style={styles.todayListQty}>{dueItemCount} item{dueItemCount === 1 ? '' : 's'}</Text>
                    </TouchableOpacity>
                  ))}
                  {dueTodayOrders.length > 4 && (
                    <TouchableOpacity onPress={() => setSelectedTab('orders')} style={styles.todayListMore}>
                      <Text style={styles.todayListMoreText}>+{dueTodayOrders.length - 4} more due today</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Stats Grid - Modern Cards */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.statAccentBar, { backgroundColor: '#5AC8FA' }]} />
                <View style={[styles.statIconWrap, { backgroundColor: '#5AC8FA20' }]}>
                  <Ionicons name="people" size={18} color="#5AC8FA" />
                </View>
                <Text style={styles.statNumber}>{totalUsers}</Text>
                <Text style={styles.statLabel}>Total Users</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statAccentBar, { backgroundColor: '#22C55E' }]} />
                <View style={[styles.statIconWrap, { backgroundColor: '#22C55E20' }]}>
                  <Ionicons name="receipt" size={18} color="#22C55E" />
                </View>
                <Text style={styles.statNumber}>{totalOrders}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statAccentBar, { backgroundColor: '#FF9500' }]} />
                <View style={[styles.statIconWrap, { backgroundColor: '#FF950020' }]}>
                  <Ionicons name="time" size={18} color="#FF9500" />
                </View>
                <Text style={styles.statNumber}>{pendingOrders + preparingOrders}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statAccentBar, { backgroundColor: '#000000' }]} />
                <View style={[styles.statIconWrap, { backgroundColor: '#F6F6F6' }]}>
                  <Ionicons name="cash" size={18} color="#000000" />
                </View>
                <Text style={styles.statNumber}>R{revenue.toFixed(0)}</Text>
                <Text style={styles.statLabel}>Revenue</Text>
              </View>
            </View>

            {/* Order Status Breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>Order Status Breakdown</Text>
              <View style={styles.breakdownContainer}>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#FF9500' }]} />
                    <Text style={styles.breakdownLabel}>Pending</Text>
                  </View>
                  <View style={styles.breakdownBarBg}>
                    <View style={[styles.breakdownBarFill, { width: `${totalOrders > 0 ? (pendingOrders / totalOrders) * 100 : 0}%`, backgroundColor: '#FF9500' }]} />
                  </View>
                  <Text style={styles.breakdownCount}>{pendingOrders}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#5AC8FA' }]} />
                    <Text style={styles.breakdownLabel}>Preparing</Text>
                  </View>
                  <View style={styles.breakdownBarBg}>
                    <View style={[styles.breakdownBarFill, { width: `${totalOrders > 0 ? (preparingOrders / totalOrders) * 100 : 0}%`, backgroundColor: '#5AC8FA' }]} />
                  </View>
                  <Text style={styles.breakdownCount}>{preparingOrders}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#22C55E' }]} />
                    <Text style={styles.breakdownLabel}>On The Way</Text>
                  </View>
                  <View style={styles.breakdownBarBg}>
                    <View style={[styles.breakdownBarFill, { width: `${totalOrders > 0 ? (onTheWayOrders / totalOrders) * 100 : 0}%`, backgroundColor: '#22C55E' }]} />
                  </View>
                  <Text style={styles.breakdownCount}>{onTheWayOrders}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#6B6B6B' }]} />
                    <Text style={styles.breakdownLabel}>Delivered</Text>
                  </View>
                  <View style={styles.breakdownBarBg}>
                    <View style={[styles.breakdownBarFill, { width: `${totalOrders > 0 ? (deliveredCount / totalOrders) * 100 : 0}%`, backgroundColor: '#6B6B6B' }]} />
                  </View>
                  <Text style={styles.breakdownCount}>{deliveredCount}</Text>
                </View>
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
            {orders.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <Text style={styles.sectionCardTitle}>Recent Orders</Text>
                  <TouchableOpacity onPress={() => setSelectedTab('orders')}>
                    <Text style={styles.seeAllText}>See All</Text>
                  </TouchableOpacity>
                </View>
                {orders.slice(0, 4).map((order, idx) => (
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
          <OrdersSection orders={orders} updateOrderStatus={updateOrderStatus} theme={theme} />
        )}

        {selectedTab === 'chef' && (
          <ChefSection orders={orders} updateOrderStatus={updateOrderStatus} theme={theme} />
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
                const employeeCount = allUsers.filter(u => u.companyName === company.name).length;
                return (
                  <View key={company.id} style={[styles.userCard, idx === 0 && { marginTop: 4 }]}>
                    <View style={[styles.userAvatar, { backgroundColor: '#5AC8FA30' }]}>
                      <Ionicons name="business" size={20} color="#5AC8FA" />
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{company.name}</Text>
                      <Text style={styles.userEmail}>{company.domains.map(d => `@${d}`).join(', ')}</Text>
                      <Text style={styles.userMeta}>{employeeCount} user{employeeCount === 1 ? '' : 's'} matched</Text>
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

      {/* Add Company Modal */}
      <Modal visible={showAddCompany} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Company</Text>
              <TouchableOpacity onPress={() => setShowAddCompany(false)} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
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
    setEditingItem({
      categoryId,
      itemId: item.id || `item-${Date.now()}`,
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

function OrdersSection({ orders, updateOrderStatus, theme }: { orders: Order[]; updateOrderStatus: (orderId: string, status: string) => void; theme: ThemeColors }) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

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
      {orders.map((order, idx) => {
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
function ChefSection({ orders, updateOrderStatus, theme }: { orders: Order[]; updateOrderStatus: (orderId: string, status: string) => void; theme: ThemeColors }) {
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

  // Aggregated by dish name across every order due today — a cooking list,
  // not an order list. A chef needs "15x Chicken Aglio", not five separate
  // tickets that each say "3x".
  const prepList = useMemo(() => {
    const today = new Date();
    const map = new Map<string, number>();
    activeOrders.forEach(o => {
      const placedAt = new Date(o.timestamp);
      o.items.forEach(item => {
        if (isSameDay(getItemDueDate(item, placedAt), today)) {
          map.set(item.name, (map.get(item.name) || 0) + item.quantity);
        }
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, qty]) => ({ name, qty }));
  }, [activeOrders]);

  // Due-today orders float to the top of the queue; the rest stay in their
  // existing order (oldest-placed first, matching how `orders` is stored).
  const sortedOrders = useMemo(
    () => [...ordersWithDueToday].sort((a, b) => (a.dueToday === b.dueToday ? 0 : a.dueToday ? -1 : 1)),
    [ordersWithDueToday]
  );

  if (activeOrders.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="restaurant-outline" size={40} color={theme.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>Nothing to prep</Text>
        <Text style={styles.emptySub}>Active orders will show up here for the kitchen</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.greeting}>Chef's Kitchen</Text>
          <Text style={styles.greetingSub}>{activeOrders.length} active order{activeOrders.length === 1 ? '' : 's'}</Text>
        </View>
      </View>

      {prepList.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>Today's Prep List</Text>
          {prepList.map((item, idx) => (
            <View key={item.name} style={[styles.prepListRow, idx === 0 && { borderTopWidth: 0 }]}>
              <Text style={styles.prepListQty}>{item.qty}x</Text>
              <Text style={styles.prepListName} numberOfLines={1}>{item.name}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.chefQueueTitle}>Order Queue</Text>
      {sortedOrders.map(({ order, dueToday }, idx) => {
        const flowIdx = STATUS_FLOW.indexOf(order.status);
        const isTerminal = order.status === 'delivered' || order.status === 'cancelled';
        return (
          <View key={order.id} style={[styles.orderCard, idx === 0 && { marginTop: 4 }]}>
            <View style={styles.orderCardHeader}>
              <View style={styles.orderCardLeft}>
                <View style={styles.chefOrderIdRow}>
                  <Text style={styles.orderCardId}>{order.id}</Text>
                  {dueToday && (
                    <View style={styles.dueTodayBadge}>
                      <Text style={styles.dueTodayBadgeText}>DUE TODAY</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.orderCardUser}>{order.userName || 'Guest'}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[order.status] || '#6B6B6B') + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[order.status] || '#6B6B6B' }]}>
                  {STATUS_LABELS[order.status] || order.status}
                </Text>
              </View>
            </View>

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
                </View>
              ))}

              {!isTerminal && (
                <>
                  <View style={styles.orderDivider} />
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
                </>
              )}
            </View>
          </View>
        );
      })}
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
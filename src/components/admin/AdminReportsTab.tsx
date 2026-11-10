import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { XlsxWriter, shareXlsx } from '../../services/export';
import {
  CustomerComplaint,
  fetchComplaintsFromDb,
  resolveComplaintInDb,
} from '../../services/supabaseDataService';
import {
  ReportTimeframe,
  addDaysIso,
  fulfilmentRate,
  getTodayIsoSAST,
  isActiveOrder,
  isInTimeframe,
  isSale,
  sumMeals,
  sumRevenue,
} from '../../utils/adminMetrics';

const TIMEFRAMES: ReportTimeframe[] = ['Today', 'This Week', 'This Month', 'Last 30 Days'];
const UNASSIGNED = 'Unassigned';

type ReportTab = 'sales' | 'menu' | 'kitchen' | 'ratings' | 'complaints';

export const AdminReportsTab: React.FC = () => {
  const { theme } = useTheme();
  const { orderHistory, corporateAccounts } = useCart();

  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [timeframe, setTimeframe] = useState<ReportTimeframe>('This Month');
  const todayIso = getTodayIsoSAST();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [complaints, setComplaints] = useState<CustomerComplaint[]>([]);

  useEffect(() => {
    fetchComplaintsFromDb().then(setComplaints);
  }, []);

  const handleResolveComplaint = async (id: string) => {
    if (!(await resolveComplaintInDb(id))) {
      Alert.alert('Not Saved', 'The complaint could not be updated. Please try again.');
      return;
    }
    setComplaints(await fetchComplaintsFromDb());
  };

  // Paid orders whose delivery date falls in the chosen period.
  const periodOrders = useMemo(
    () => orderHistory.filter((o) => isSale(o) && isInTimeframe(o.targetDeliveryDate, timeframe, todayIso)),
    [orderHistory, timeframe, todayIso]
  );

  const totalRevenue = sumRevenue(periodOrders);
  const totalOrders = periodOrders.length;
  const totalMeals = sumMeals(periodOrders);
  const avgBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalDeliveryFees = periodOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
  const fulfilment = useMemo(() => fulfilmentRate(periodOrders), [periodOrders]);

  // Revenue by company
  const companyRevenue = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of corporateAccounts) map.set(c.companyName, 0);

    for (const o of periodOrders) {
      const comp =
        o.companyName ||
        corporateAccounts.find((c) => o.companyLocation?.includes(c.companyName))?.companyName ||
        UNASSIGNED;
      map.set(comp, (map.get(comp) ?? 0) + (o.totalPaid || 0));
    }

    return [...map.entries()]
      .map(([name, amount]) => ({
        name,
        amount,
        pct: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodOrders, corporateAccounts, totalRevenue]);

  // Top selling dishes
  const topDishes = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const o of periodOrders) {
      for (const item of o.items) {
        const name = item.menuItem.name;
        const current = map.get(name) || { qty: 0, revenue: 0 };
        map.set(name, {
          qty: current.qty + item.quantity,
          revenue: current.revenue + item.totalPrice,
        });
      }
    }
    return [...map.entries()]
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((a, b) => b.qty - a.qty);
  }, [periodOrders]);

  // Today plus the following six days, always, whichever period is selected.
  const upcomingDemand = useMemo(() => {
    const lastDay = addDaysIso(todayIso, 6);
    const map = new Map<string, { date: string; count: number }>();
    for (const o of orderHistory) {
      if (isActiveOrder(o) && o.targetDeliveryDate >= todayIso && o.targetDeliveryDate <= lastDay) {
        const entry = map.get(o.targetDeliveryDate) || {
          date: o.deliveryDateFormatted || o.targetDeliveryDate,
          count: 0,
        };
        entry.count += sumMeals([o]);
        map.set(o.targetDeliveryDate, entry);
      }
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, entry]) => entry);
  }, [orderHistory, todayIso]);

  const ratedOrders = useMemo(
    () =>
      orderHistory
        .filter((o) => o.rating && isInTimeframe(o.targetDeliveryDate, timeframe, todayIso))
        .sort((a, b) => b.targetDeliveryDate.localeCompare(a.targetDeliveryDate)),
    [orderHistory, timeframe, todayIso]
  );
  const averageRating =
    ratedOrders.length > 0
      ? ratedOrders.reduce((sum, o) => sum + (o.rating?.rating || 0), 0) / ratedOrders.length
      : null;
  const openComplaints = complaints.filter((c) => c.status === 'open').length;

  // Export report summary
  const handleExportReport = async () => {
    const xlsx = new XlsxWriter();

    const summary = xlsx.addSheet('Summary').widths(30, 20);
    summary.header('Your Kitchen Co. Report', timeframe);
    summary.row('Generated', new Date().toLocaleString('en-ZA'));
    summary.row('Revenue (R)', Number(totalRevenue.toFixed(2)));
    summary.row('Included delivery fees (R)', Number(totalDeliveryFees.toFixed(2)));
    summary.row('Orders', totalOrders);
    summary.row('Meals', totalMeals);
    summary.row('Average per order (R)', Number(avgBasket.toFixed(2)));
    summary.row('Average rating', averageRating === null ? 'No ratings' : Number(averageRating.toFixed(2)));
    summary.row('Delivered vs reported missing (%)', fulfilment === null ? 'No data' : Number(fulfilment.toFixed(1)));

    const orders = xlsx.addSheet('Orders').widths(24, 14, 16, 26, 28, 8, 12, 12, 12, 10, 12);
    orders.header('Order', 'Delivery date', 'Status', 'Company', 'Customer', 'Meals', 'Subtotal', 'Discount', 'Delivery', 'VAT', 'Total');
    for (const o of [...periodOrders].sort((a, b) => a.targetDeliveryDate.localeCompare(b.targetDeliveryDate))) {
      orders.row(
        o.orderNumber,
        o.targetDeliveryDate,
        o.status,
        o.companyName || UNASSIGNED,
        o.customerName || (o.userId ? 'Customer' : 'Anonymised customer'),
        sumMeals([o]),
        o.itemSubtotal,
        o.discountZar,
        o.deliveryFee,
        o.vatAmount,
        o.totalPaid
      );
    }
    orders.row(
      'TOTAL',
      null,
      null,
      null,
      null,
      totalMeals,
      Number(periodOrders.reduce((s, o) => s + o.itemSubtotal, 0).toFixed(2)),
      Number(periodOrders.reduce((s, o) => s + (o.discountZar || 0), 0).toFixed(2)),
      Number(totalDeliveryFees.toFixed(2)),
      Number(periodOrders.reduce((s, o) => s + o.vatAmount, 0).toFixed(2)),
      Number(totalRevenue.toFixed(2))
    );

    const companies = xlsx.addSheet('Revenue by company').widths(34, 14, 10);
    companies.header('Company', 'Revenue (R)', 'Share (%)');
    companyRevenue.forEach((c) => companies.row(c.name, Number(c.amount.toFixed(2)), Number(c.pct.toFixed(1))));

    const dishes = xlsx.addSheet('Top dishes').widths(48, 10, 14);
    dishes.header('Dish', 'Meals', 'Revenue (R)');
    topDishes.forEach((d) => dishes.row(d.name, d.qty, Number(d.revenue.toFixed(2))));

    const ratings = xlsx.addSheet('Ratings').widths(24, 14, 26, 28, 8, 50);
    ratings.header('Order', 'Delivery date', 'Company', 'Customer', 'Stars', 'Feedback');
    ratedOrders.forEach((o) =>
      ratings.row(
        o.orderNumber,
        o.targetDeliveryDate,
        o.companyName || UNASSIGNED,
        o.customerName || 'Anonymised customer',
        o.rating?.rating,
        o.rating?.feedback
      )
    );

    try {
      await shareXlsx(`YKC_Report_${timeframe.replace(/ /g, '_')}_${todayIso}`, xlsx, 'YKC Report');
    } catch {
      Alert.alert('Export Error', 'Could not create the report.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 1. Timeframe & Export Row */}
      <View style={styles.topControls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {TIMEFRAMES.map((tf) => (
            <TouchableOpacity
              key={tf}
              onPress={() => setTimeframe(tf)}
              style={[
                styles.timeframePill,
                timeframe === tf
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              ]}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: timeframe === tf ? theme.textInverse : theme.textPrimary }}>
                {tf}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleExportReport}
          style={[styles.exportBtn, { backgroundColor: theme.brandGold }]}
        >
          <Ionicons name="share-outline" size={13} color={theme.onBrandGold} />
          <Text style={[styles.exportBtnText, { color: theme.onBrandGold }]}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Sub-Tab Switcher: Sales | Menu | Kitchen */}
      <View style={[styles.segmentTrack, { backgroundColor: theme.chipBg }]}>
        {(['sales', 'menu', 'kitchen', 'ratings', 'complaints'] as const).map((t) => {
          const isActive = activeTab === t;
          return (
            <TouchableOpacity
              key={t}
              activeOpacity={0.8}
              onPress={() => setActiveTab(t)}
              style={[styles.segmentBtn, isActive && [styles.segmentBtnActive, { backgroundColor: theme.primary }]]}
            >
              <Text style={[styles.segmentBtnText, { color: isActive ? theme.textInverse : theme.textSecondary }]}>
                {t === 'sales'
                  ? 'Sales'
                  : t === 'menu'
                  ? 'Menu'
                  : t === 'kitchen'
                  ? 'Kitchen'
                  : t === 'ratings'
                  ? 'Ratings'
                  : `Issues${openComplaints > 0 ? ` (${openComplaints})` : ''}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Tab Content: Sales */}
      {activeTab === 'sales' && (
        <View style={styles.tabContent}>
          {/* KPI Cards Row */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Revenue</Text>
              <Text style={[styles.kpiValue, { color: theme.primary }]}>R {totalRevenue.toFixed(2)}</Text>
              <Text style={[styles.kpiSub, { color: theme.brandGold }]}>Includes R {totalDeliveryFees.toFixed(2)} delivery</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Orders</Text>
              <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>{totalOrders}</Text>
              <Text style={[styles.kpiSub, { color: theme.textMuted }]}>{totalMeals} meals · Average R {avgBasket.toFixed(2)}/order</Text>
            </View>
          </View>

          {/* Revenue by Corporate Account Visual Bars */}
          <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.chartHeading, { color: theme.textPrimary }]}>
              Revenue by Corporate Partner
            </Text>
            <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
              Distribution across enterprise accounts
            </Text>

            <View style={styles.barsList}>
              {companyRevenue.map((c) => (
                <View key={c.name} style={styles.barItem}>
                  <View style={styles.barLabelRow}>
                    <Text style={[styles.barName, { color: theme.textPrimary }]}>{c.name}</Text>
                    <Text style={[styles.barAmount, { color: theme.primary }]}>
                      R {c.amount.toFixed(2)} ({c.pct.toFixed(0)}%)
                    </Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: theme.chipBg }]}>
                    <View style={[styles.barFill, { width: `${Math.max(c.pct, 5)}%`, backgroundColor: theme.brandGold }]} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* 4. Tab Content: Menu Mix */}
      {activeTab === 'menu' && (
        <View style={styles.tabContent}>
          <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.chartHeading, { color: theme.textPrimary }]}>
              Top Selling Dishes by Volume
            </Text>
            <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
              Client favorite selections ordered most frequently
            </Text>

            <View style={styles.barsList}>
              {topDishes.map((dish, idx) => (
                <View key={dish.name} style={styles.barItem}>
                  <View style={styles.barLabelRow}>
                    <Text style={[styles.barName, { color: theme.textPrimary }]}>
                      #{idx + 1} {dish.name}
                    </Text>
                    <Text style={[styles.barAmount, { color: theme.brandGold }]}>
                      {dish.qty} meals (R {dish.revenue.toFixed(2)})
                    </Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: theme.chipBg }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.min(100, Math.max(15, (dish.qty / (topDishes[0]?.qty || 1)) * 100))}%`,
                          backgroundColor: theme.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {activeTab === 'ratings' && (
        <View style={styles.tabContent}>
          <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.chartHeading, { color: theme.textPrimary }]}>Customer Ratings</Text>
            <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
              {averageRating === null
                ? 'No ratings for deliveries in this period yet.'
                : `Average ${averageRating.toFixed(1)} of 5 from ${ratedOrders.length} rated order(s) in this period.`}
            </Text>
            <View style={styles.barsList}>
              {ratedOrders.map((o) => (
                <View key={o.id} style={styles.barItem}>
                  <View style={styles.barLabelRow}>
                    <Text style={[styles.barName, { color: theme.textPrimary }]}>
                      {o.customerName || 'Anonymised customer'}{o.companyName ? ` · ${o.companyName}` : ''}
                    </Text>
                    <Text style={[styles.barAmount, { color: theme.brandGold }]}>{'★'.repeat(o.rating?.rating || 0)}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                    {o.deliveryDateFormatted} · {o.items.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(', ')}
                  </Text>
                  {o.rating?.feedback ? (
                    <Text style={{ fontSize: 12, color: theme.textPrimary }}>&quot;{o.rating.feedback}&quot;</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {activeTab === 'complaints' && (
        <View style={styles.tabContent}>
          <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.chartHeading, { color: theme.textPrimary }]}>Customer Complaints</Text>
            <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
              {openComplaints} open · {complaints.length} in total
            </Text>
            <View style={styles.barsList}>
              {complaints.map((c) => (
                <View key={c.id} style={styles.barItem}>
                  <View style={styles.barLabelRow}>
                    <Text style={[styles.barName, { color: theme.textPrimary }]}>{c.ticketRef} · {c.customerName}</Text>
                    <Text style={[styles.barAmount, { color: c.status === 'open' ? '#E53935' : '#43A047' }]}>
                      {c.status === 'open' ? 'Open' : 'Resolved'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                    {new Date(c.createdAt).toLocaleString('en-ZA')} · {c.category}
                    {c.companyName ? ` · ${c.companyName}` : ''}{c.customerEmail ? ` · ${c.customerEmail}` : ''}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textPrimary }}>{c.body}</Text>
                  {isAdmin && c.status === 'open' && (
                    <TouchableOpacity onPress={() => handleResolveComplaint(c.id)} style={{ marginTop: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary }}>Mark Resolved</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* 5. Tab Content: Kitchen */}
      {activeTab === 'kitchen' && (
        <View style={styles.tabContent}>
          <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.chartHeading, { color: theme.textPrimary }]}>
              7-Day Forward Demand Outlook
            </Text>
            <Text style={[styles.chartSub, { color: theme.textSecondary }]}>
              Active committed orders per upcoming delivery slot
            </Text>

            <View style={styles.barsList}>
              {upcomingDemand.map((item) => (
                <View key={item.date} style={styles.barItem}>
                  <View style={styles.barLabelRow}>
                    <Text style={[styles.barName, { color: theme.textPrimary }]}>📅 {item.date}</Text>
                    <Text style={[styles.barAmount, { color: theme.primary }]}>{item.count} meals</Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: theme.chipBg }]}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.min(100, Math.max(10, item.count * 15))}%`, backgroundColor: '#059669' },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Fulfillment Reliability Card */}
          <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.chartHeading, { color: theme.textPrimary }]}>
              Delivery Fulfillment Rate
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
              <View style={[styles.rateCircle, { backgroundColor: 'rgba(67, 160, 71, 0.15)' }]}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#43A047' }}>
                  {fulfilment === null ? '—' : `${fulfilment.toFixed(1)}%`}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>
                  Delivered vs Reported Missing
                </Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                  {fulfilment === null
                    ? 'No orders delivered or reported missing in this period yet.'
                    : 'Delivered orders as a share of orders delivered or reported missing in this period.'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timeframePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  exportBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  segmentTrack: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 20,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabContent: {
    gap: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  kpiSub: {
    fontSize: 10,
    fontWeight: '700',
  },
  chartCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  chartHeading: {
    fontSize: 15,
    fontWeight: '800',
  },
  chartSub: {
    fontSize: 11,
    marginTop: -4,
  },
  barsList: {
    gap: 12,
    marginTop: 8,
  },
  barItem: {
    gap: 4,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barName: {
    fontSize: 12,
    fontWeight: '600',
  },
  barAmount: {
    fontSize: 12,
    fontWeight: '700',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  rateCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

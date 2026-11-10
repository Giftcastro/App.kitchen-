import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { useCart } from '../../context/CartContext';
import { useDeliveryCalendar } from '../../hooks/useDeliveryCalendar';
import { ActiveOrderStatusFilter } from '../../types';
import {
  addDaysIso,
  getTodayIsoSAST,
  isActiveOrder,
  isDelivered,
  isOutForDelivery,
  isPreparing,
  isSale,
  isUnfulfilled,
  mealsLabel,
  monthToDateSales,
  ordersLabel,
  ordersWithoutMeals,
  sumMeals,
  sumRevenue,
  upcomingSales,
} from '../../utils/adminMetrics';

interface AdminOverviewTabProps {
  onNavigateToActiveOrders: (statusFilter?: ActiveOrderStatusFilter) => void;
}

type TimingHorizon = 'today' | 'next_drop' | 'this_week' | 'this_month' | 'all_upcoming';

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({ onNavigateToActiveOrders }) => {
  const { theme } = useTheme();
  const { orderHistory, corporateAccounts } = useCart();
  const { selectedDate } = useDeliveryCalendar();
  const [selectedHorizon, setSelectedHorizon] = useState<TimingHorizon>('all_upcoming');

  // Always the South African date, recalculated on every update.
  const todayIso = getTodayIsoSAST();

  // The next delivery date that still has undelivered orders.
  const nextDropIso = useMemo(() => {
    const dates = Array.from(
      new Set(
        orderHistory
          .filter((o) => o.targetDeliveryDate >= todayIso && isActiveOrder(o))
          .map((o) => o.targetDeliveryDate)
      )
    ).sort();
    return dates[0] || selectedDate || todayIso;
  }, [orderHistory, todayIso, selectedDate]);

  // Today plus the following six days.
  const next7DaysIso = addDaysIso(todayIso, 6);

  const sales = useMemo(() => orderHistory.filter(isSale), [orderHistory]);
  const todaysOrders = useMemo(() => sales.filter((o) => o.targetDeliveryDate === todayIso), [sales, todayIso]);
  const todaysRevenue = sumRevenue(todaysOrders);
  const todaysOrdersCount = todaysOrders.length;
  const nextDropRevenue = useMemo(
    () => sumRevenue(sales.filter((o) => o.targetDeliveryDate === nextDropIso)),
    [sales, nextDropIso]
  );
  const futureCommittedRevenue = useMemo(() => sumRevenue(upcomingSales(orderHistory, todayIso)), [orderHistory, todayIso]);
  const monthToDateRevenue = useMemo(() => sumRevenue(monthToDateSales(orderHistory, todayIso)), [orderHistory, todayIso]);

  const preparingOrders = useMemo(() => orderHistory.filter(isPreparing), [orderHistory]);
  const outForDeliveryOrders = useMemo(() => orderHistory.filter(isOutForDelivery), [orderHistory]);
  const deliveredOrders = useMemo(() => orderHistory.filter(isDelivered), [orderHistory]);
  const unfulfilledCount = useMemo(() => orderHistory.filter(isUnfulfilled).length, [orderHistory]);
  const emptyOrders = useMemo(() => ordersWithoutMeals(orderHistory), [orderHistory]);

  const preparingCount = preparingOrders.length;
  const outForDeliveryCount = outForDeliveryOrders.length;
  const deliveredCount = deliveredOrders.length;
  const activeOrdersCount = preparingCount + outForDeliveryCount;

  const preparingMealsCount = sumMeals(preparingOrders);
  const outForDeliveryMealsCount = sumMeals(outForDeliveryOrders);
  const deliveredMealsCount = sumMeals(deliveredOrders);
  const activeCompaniesCount = corporateAccounts.filter((c) => c.isActive !== false).length;

  // Period Matrix customization metrics
  const horizonMetrics = useMemo(() => {
    const currentMonthPrefix = todayIso.slice(0, 7);
    const filtered = sales.filter((o) => {
      if (selectedHorizon === 'today') return o.targetDeliveryDate === todayIso;
      if (selectedHorizon === 'next_drop') return o.targetDeliveryDate === nextDropIso;
      if (selectedHorizon === 'this_week') {
        return o.targetDeliveryDate >= todayIso && o.targetDeliveryDate <= next7DaysIso;
      }
      if (selectedHorizon === 'this_month') {
        return o.targetDeliveryDate?.startsWith(currentMonthPrefix);
      }
      // 'all_upcoming'
      return o.targetDeliveryDate >= todayIso;
    });

    const ordersCount = filtered.length;
    const mealsCount = sumMeals(filtered);
    const revenue = sumRevenue(filtered);
    const companiesCount = new Set(filtered.map((o) => o.companyName).filter(Boolean)).size;
    return { ordersCount, mealsCount, revenue, companiesCount };
  }, [sales, selectedHorizon, todayIso, nextDropIso, next7DaysIso]);

  const renderKpiCard = (emoji: string, title: string, value: string, subtitle?: string, highlight?: boolean) => (
    <View
      style={[
        styles.kpiCard,
        {
          backgroundColor: theme.surface,
          borderColor: highlight ? theme.primary : theme.surfaceBorder,
        },
      ]}
    >
      <View style={styles.kpiHeaderRow}>
        <Text style={styles.kpiEmoji}>{emoji}</Text>
        <Text style={[styles.kpiTitle, { color: theme.textSecondary }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <Text
        style={[styles.kpiValue, { color: highlight ? theme.primary : theme.textPrimary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {subtitle && (
        <Text style={[styles.kpiSubtitle, { color: theme.textMuted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* 1. Header Banner */}
      {/*<View style={[styles.heroBanner, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}>*/}
      {/*  <View style={styles.heroTextCol}>*/}
      {/*    <Text style={[styles.heroCaption, { color: theme.brandGold }]}>Central Operations Hub</Text>*/}
      {/*    <Text style={[styles.heroHeading, { color: theme.textPrimary }]}>*/}
      {/*      Upcoming Revenue & Kitchen Velocity*/}
      {/*    </Text>*/}
      {/*    <Text style={[styles.heroSub, { color: theme.textSecondary }]}>*/}
      {/*      Forward projection across active corporate drops through {deliveryDates[deliveryDates.length - 1]?.fullFormattedDate || 'next cycle'}.*/}
      {/*    </Text>*/}
      {/*  </View>*/}
      {/*  <TouchableOpacity*/}
      {/*    activeOpacity={0.8}*/}
      {/*    onPress={() => onNavigateToActiveOrders('all')}*/}
      {/*    style={[styles.heroActionBtn, { backgroundColor: theme.primary }]}*/}
      {/*  >*/}
      {/*    <Text style={[styles.heroActionText, { color: theme.textInverse }]}>Active Queue →</Text>*/}
      {/*  </TouchableOpacity>*/}
      {/*</View>*/}

      {/* 2. 2x2 KPI Grid */}
      <View style={styles.gridContainer}>
        {renderKpiCard(
          '💰',
          "Today's Deliveries Revenue",
          `R ${todaysRevenue.toFixed(2)}`,
          todaysOrdersCount > 0
            ? `${todaysOrdersCount} drop(s) scheduled today`
            : `Next drop (${nextDropIso}): R ${nextDropRevenue.toFixed(0)}`
        )}
        {renderKpiCard(
          '🔥',
          'Active Orders Queue',
          ordersLabel(activeOrdersCount),
          `${mealsLabel(preparingMealsCount + outForDeliveryMealsCount)} still to deliver`,
          true
        )}
        {renderKpiCard(
          '💎',
          'Future Committed Revenue',
          `R ${futureCommittedRevenue.toFixed(2)}`,
          'Paid orders delivering today or later'
        )}
        {renderKpiCard(
          '📈',
          'Month to Date Revenue',
          `R ${monthToDateRevenue.toFixed(2)}`,
          `Deliveries 1st to today (${todayIso.slice(0, 7)})`
        )}
      </View>

      {/* 2B. Custom Timing / Period Order Matrix */}
      <View style={[styles.pipelineCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Period & Timing Order Matrix
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary, marginTop: 2 }]}>
              Quick glance across custom delivery horizons
            </Text>
          </View>
          <Ionicons name="calendar-outline" size={18} color={theme.brandGold} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizonChipRow}
        >
          {([
            { id: 'today', label: 'Today' },
            { id: 'next_drop', label: `Next Drop (${nextDropIso.slice(5)})` },
            { id: 'this_week', label: 'Next 7 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'all_upcoming', label: 'All Upcoming' },
          ] as { id: TimingHorizon; label: string }[]).map((chip) => {
            const active = selectedHorizon === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                activeOpacity={0.8}
                onPress={() => setSelectedHorizon(chip.id)}
                style={[
                  styles.horizonChip,
                  {
                    backgroundColor: active ? theme.primary : theme.chipBg,
                    borderColor: active ? theme.primary : theme.surfaceBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.horizonChipText,
                    { color: active ? theme.textInverse : theme.textSecondary },
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.matrixRow}>
          <View style={[styles.matrixCell, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.matrixValue, { color: theme.textPrimary }]}>{horizonMetrics.mealsCount}</Text>
            <Text style={[styles.matrixLabel, { color: theme.textSecondary }]}>Total Meals</Text>
          </View>
          <View style={[styles.matrixCell, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.matrixValue, { color: theme.textPrimary }]}>{horizonMetrics.ordersCount}</Text>
            <Text style={[styles.matrixLabel, { color: theme.textSecondary }]}>Orders</Text>
          </View>
          <View style={[styles.matrixCell, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.matrixValue, { color: theme.primary }]} numberOfLines={1} adjustsFontSizeToFit>
              R {horizonMetrics.revenue.toFixed(0)}
            </Text>
            <Text style={[styles.matrixLabel, { color: theme.textSecondary }]}>Revenue</Text>
          </View>
          <View style={[styles.matrixCell, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.matrixValue, { color: theme.brandGold }]}>{horizonMetrics.companiesCount}</Text>
            <Text style={[styles.matrixLabel, { color: theme.textSecondary }]}>Companies</Text>
          </View>
        </View>
      </View>

      {/* 3. Operational Dispatch Pipeline Summary */}
      <View style={[styles.pipelineCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Live Kitchen Fulfillment Pipeline
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
          The large number is meals (portions). One order can hold several meals. Tap a stage to list its orders.
        </Text>

        <View style={styles.stageCardsRow}>
          {/* Stage 1: Preparing */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => onNavigateToActiveOrders('preparing')}
            style={[styles.stageCard, { backgroundColor: theme.surfaceElevated, borderColor: '#1E88E5' }]}
          >
            <View style={[styles.stageBadge, { backgroundColor: 'rgba(30, 136, 229, 0.15)' }]}>
              <Ionicons name="restaurant" size={12} color="#1E88E5" />
              <Text style={[styles.stageBadgeText, { color: '#1E88E5' }]} numberOfLines={1}>
                Preparing
              </Text>
            </View>
            <Text style={[styles.stageCount, { color: theme.textPrimary }]}>{preparingMealsCount}</Text>
            <Text style={[styles.stageSubCount, { color: theme.textSecondary }]} numberOfLines={1}>
              {mealsLabel(preparingMealsCount)} · {ordersLabel(preparingCount)}
            </Text>
            <View style={styles.stageTapRow}>
              <Text style={[styles.stageDesc, { color: '#1E88E5' }]} numberOfLines={1}>
                View Queue
              </Text>
              <Ionicons name="arrow-forward" size={10} color="#1E88E5" />
            </View>
          </TouchableOpacity>

          {/* Stage 2: Out for Delivery */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => onNavigateToActiveOrders('out_for_delivery')}
            style={[styles.stageCard, { backgroundColor: theme.surfaceElevated, borderColor: '#FB8C00' }]}
          >
            <View style={[styles.stageBadge, { backgroundColor: 'rgba(251, 140, 0, 0.15)' }]}>
              <Ionicons name="bicycle" size={12} color="#FB8C00" />
              <Text style={[styles.stageBadgeText, { color: '#FB8C00' }]} numberOfLines={1}>
                Out for Delivery
              </Text>
            </View>
            <Text style={[styles.stageCount, { color: theme.textPrimary }]}>{outForDeliveryMealsCount}</Text>
            <Text style={[styles.stageSubCount, { color: theme.textSecondary }]} numberOfLines={1}>
              {mealsLabel(outForDeliveryMealsCount)} · {ordersLabel(outForDeliveryCount)}
            </Text>
            <View style={styles.stageTapRow}>
              <Text style={[styles.stageDesc, { color: '#FB8C00' }]} numberOfLines={1}>
                View Route
              </Text>
              <Ionicons name="arrow-forward" size={10} color="#FB8C00" />
            </View>
          </TouchableOpacity>

          {/* Stage 3: Delivered */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => onNavigateToActiveOrders('delivered')}
            style={[styles.stageCard, { backgroundColor: theme.surfaceElevated, borderColor: '#43A047' }]}
          >
            <View style={[styles.stageBadge, { backgroundColor: 'rgba(67, 160, 71, 0.15)' }]}>
              <Ionicons name="checkmark-circle" size={12} color="#43A047" />
              <Text style={[styles.stageBadgeText, { color: '#43A047' }]} numberOfLines={1}>
                Delivered
              </Text>
            </View>
            <Text style={[styles.stageCount, { color: theme.textPrimary }]}>{deliveredMealsCount}</Text>
            <Text style={[styles.stageSubCount, { color: theme.textSecondary }]} numberOfLines={1}>
              {mealsLabel(deliveredMealsCount)} · {ordersLabel(deliveredCount)}
            </Text>
            <View style={styles.stageTapRow}>
              <Text style={[styles.stageDesc, { color: '#43A047' }]} numberOfLines={1}>
                View Drops
              </Text>
              <Ionicons name="arrow-forward" size={10} color="#43A047" />
            </View>
          </TouchableOpacity>
        </View>

        {(emptyOrders.length > 0 || unfulfilledCount > 0) && (
          <View style={[styles.dataNotice, { backgroundColor: theme.goldWarningSurface, borderColor: theme.goldWarningBorder }]}>
            {emptyOrders.length > 0 && (
              <Text style={[styles.dataNoticeText, { color: theme.goldWarning }]}>
                {ordersLabel(emptyOrders.length)} recorded with no meals: {emptyOrders.map((o) => o.orderNumber).join(', ')}
              </Text>
            )}
            {unfulfilledCount > 0 && (
              <Text style={[styles.dataNoticeText, { color: theme.goldWarning }]}>
                {ordersLabel(unfulfilledCount)} reported as not delivered
              </Text>
            )}
          </View>
        )}

        {/* Action button to open Active Orders */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onNavigateToActiveOrders('all')}
          style={[styles.manageBtn, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}
        >
          <Ionicons name="list" size={16} color={theme.primary} />
          <Text style={[styles.manageBtnText, { color: theme.primary }]} numberOfLines={1} adjustsFontSizeToFit>
            Manage Deliveries ({activeOrdersCount} active · {orderHistory.length} total)
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. Connected Corporate Accounts Overview */}
      <View style={[styles.pipelineCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary, flex: 1 }]}>
            Corporate Partner Accounts
          </Text>
          <Text style={[styles.countBadge, { color: theme.brandGold }]}>
            {activeCompaniesCount} Active
          </Text>
        </View>

        {corporateAccounts.map((corp) => (
          <View key={corp.id} style={[styles.corpRow, { borderBottomColor: theme.surfaceBorder }]}>
            <View style={styles.corpInfo}>
              <Text style={[styles.corpName, { color: theme.textPrimary }]} numberOfLines={1}>
                {corp.companyName}
              </Text>
              <Text style={[styles.corpMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                {corp.locations[0] || 'Office Location'}
                {corp.locations.length > 1 ? ` (+${corp.locations.length - 1} more)` : ''} • {corp.activeUsersCount} users
              </Text>
            </View>
            <View style={[styles.benefitChip, { backgroundColor: theme.chipBg }]}>
              <Text style={[styles.benefitText, { color: theme.textPrimary }]}>
                {!corp.discountValue
                  ? 'No discount'
                  : corp.discountType === 'fixed_zar'
                  ? `R ${corp.discountValue} Off`
                  : `${corp.discountValue}% Off`}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  dataNotice: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  dataNoticeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  heroBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTextCol: {
    flex: 1,
    gap: 3,
  },
  heroCaption: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroHeading: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  heroActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  heroActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  kpiHeaderRow: {
    gap: 4,
  },
  kpiEmoji: {
    fontSize: 18,
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  kpiSubtitle: {
    fontSize: 11,
  },
  pipelineCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: -6,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: '800',
  },
  horizonChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  horizonChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  horizonChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  matrixRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  matrixCell: {
    flex: 1,
    minWidth: '22%',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  matrixValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  matrixLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  stageCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stageCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 3,
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '100%',
  },
  stageBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    flexShrink: 1,
  },
  stageCount: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  stageSubCount: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  stageTapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  stageDesc: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  manageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  corpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  corpInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  corpName: {
    fontSize: 14,
    fontWeight: '700',
  },
  corpMeta: {
    fontSize: 12,
  },
  benefitChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  benefitText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

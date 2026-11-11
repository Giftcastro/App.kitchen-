import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { OrderHistoryItem, OrderStatus, ActiveOrderStatusFilter } from '../../types';
import {
  KitchenExports,
  KitchenExportType,
  AdminActiveOrderRow,
  buildPrepSummary,
  buildFlatMealRecords,
} from '../../services/kitchenExports';
import {
  updateOrderStatusInDb,
  updateBatchOrderStatusesInDb,
  markOrdersOutForDeliveryInDb,
} from '../../services/supabaseDataService';
import { isActiveOrder, mealsAndOrdersLabel } from '../../utils/adminMetrics';

const ALL_COMPANIES = 'All Companies';
const ALL_DATES = 'All Dates';

const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function normalizeOrderDateInfo(order: OrderHistoryItem): {
  isoDate: string;
  formattedLabel: string;
  timestamp: number;
} {
  const rawPrimary = (order.targetDeliveryDate || '').trim();
  const rawSecondary = (order.deliveryDateFormatted || '').trim();
  const combined = `${rawPrimary} ${rawSecondary}`;

  // 1. Check for YYYY-MM-DD pattern first
  const isoMatch = combined.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const monthIdx = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const dt = new Date(year, monthIdx, day);
    if (!isNaN(dt.getTime())) {
      const isoDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      const formattedLabel = `${DAYS_FULL[dt.getDay()]}, ${day} ${MONTHS_SHORT[monthIdx]} ${year}`;
      return { isoDate, formattedLabel, timestamp: dt.getTime() };
    }
  }

  // 2. Check for DD/MM/YYYY pattern
  const dmyMatch = combined.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthIdx = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const dt = new Date(year, monthIdx, day);
    if (!isNaN(dt.getTime())) {
      const isoDate = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const formattedLabel = `${DAYS_FULL[dt.getDay()]}, ${day} ${MONTHS_SHORT[monthIdx]} ${year}`;
      return { isoDate, formattedLabel, timestamp: dt.getTime() };
    }
  }

  // 3. Fallback: strip "Delivery on " prefix and parse if possible
  const cleaned = (rawSecondary || rawPrimary).replace(/^Delivery on\s+/i, '').trim();
  const parsed = Date.parse(cleaned);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    const year = dt.getFullYear();
    const monthIdx = dt.getMonth();
    const day = dt.getDate();
    const isoDate = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const formattedLabel = `${DAYS_FULL[dt.getDay()]}, ${day} ${MONTHS_SHORT[monthIdx]} ${year}`;
    return { isoDate, formattedLabel, timestamp: dt.getTime() };
  }

  const fallbackLabel = cleaned || 'Scheduled Delivery';
  return { isoDate: fallbackLabel, formattedLabel: fallbackLabel, timestamp: Number.MAX_SAFE_INTEGER };
}

interface OrganizedDateOption {
  label: string;
  isoDate: string;
  timestamp: number;
  orderCount: number;
  mealCount: number;
  pendingCount: number;
}

export interface AdminActiveOrdersTabProps {
  initialStatusFilter?: ActiveOrderStatusFilter;
  onStatusFilterChange?: (filter: ActiveOrderStatusFilter) => void;
}

export const AdminActiveOrdersTab: React.FC<AdminActiveOrdersTabProps> = ({
  initialStatusFilter = 'all',
  onStatusFilterChange,
}) => {
  const { theme, isDark } = useTheme();
  const { orderHistory, corporateAccounts } = useCart();

  // Local state for orders (to allow instant status updates and simulation)
  const [localOrders, setLocalOrders] = useState<OrderHistoryItem[]>(orderHistory);

  useEffect(() => {
    setLocalOrders(orderHistory);
  }, [orderHistory]);

  // Active filters
  const [selectedCompany, setSelectedCompany] = useState<string>(ALL_COMPANIES);
  const [selectedDate, setSelectedDate] = useState<string>(ALL_DATES);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<ActiveOrderStatusFilter>(initialStatusFilter);
  const [isPrepViewActive, setIsPrepViewActive] = useState<boolean>(false);

  useEffect(() => {
    setSelectedStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  const { currentUser } = useAuth();
  const isChefReadOnly = currentUser?.role === 'chef';

  const handleStatusFilterSelect = (filter: ActiveOrderStatusFilter) => {
    setSelectedStatusFilter(filter);
    onStatusFilterChange?.(filter);
  };

  // Modals
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isCompanyFilterModalOpen, setIsCompanyFilterModalOpen] = useState<boolean>(false);
  const [isDateFilterModalOpen, setIsDateFilterModalOpen] = useState<boolean>(false);

  // Confirmation Modal state for single order delivery
  const [pendingDeliveryOrder, setPendingDeliveryOrder] = useState<AdminActiveOrderRow | null>(null);
  const [isConfirmDeliveryOpen, setIsConfirmDeliveryOpen] = useState<boolean>(false);

  // Confirmation Modal state for bulk delivery
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState<boolean>(false);

  // Orders waiting for confirmation before going Out for Delivery
  const [pendingDispatchRows, setPendingDispatchRows] = useState<AdminActiveOrderRow[] | null>(null);

  // Build row items with real customer, company, and normalized delivery date details resolved
  const rows: AdminActiveOrderRow[] = useMemo(() => {
    return localOrders.map((o) => {
      const company =
        o.companyName ||
        corporateAccounts.find((c) => o.companyLocation?.includes(c.companyName))?.companyName ||
        'Unassigned';

      const customerName = o.customerName
        ? `${o.customerName}${o.customerEmail ? ` (${o.customerEmail})` : ''}`
        : o.userId
        ? 'Customer'
        : 'Anonymised customer';

      const { formattedLabel } = normalizeOrderDateInfo(o);

      return {
        order: o,
        companyName: company,
        locationName: o.companyLocation || 'Corporate Campus',
        customerName,
        deliveryDateLabel: formattedLabel,
      };
    });
  }, [localOrders, corporateAccounts]);

  // Company filter options
  const companyOptions = useMemo(() => {
    const namesFromOrders = rows.map((r) => r.companyName);
    const namesFromAccounts = corporateAccounts.map((c) => c.companyName);
    const uniqueNames = Array.from(new Set([...namesFromAccounts, ...namesFromOrders])).filter(Boolean);
    return [ALL_COMPANIES, ...uniqueNames];
  }, [corporateAccounts, rows]);

  // Organized & chronologically sorted date filter options with order/meal/pending counts
  const organizedDateOptions: OrganizedDateOption[] = useMemo(() => {
    const companyScopedRows =
      selectedCompany === ALL_COMPANIES
        ? rows
        : rows.filter((r) => r.companyName === selectedCompany);

    const map = new Map<string, OrganizedDateOption>();
    for (const r of companyScopedRows) {
      const info = normalizeOrderDateInfo(r.order);
      const key = info.formattedLabel;
      const mealQty = r.order.items.reduce((sum, it) => sum + it.quantity, 0);
      const isPending = isActiveOrder(r.order);

      if (!map.has(key)) {
        map.set(key, {
          label: info.formattedLabel,
          isoDate: info.isoDate,
          timestamp: info.timestamp,
          orderCount: 0,
          mealCount: 0,
          pendingCount: 0,
        });
      }
      const entry = map.get(key)!;
      entry.orderCount += 1;
      entry.mealCount += mealQty;
      if (isPending) entry.pendingCount += 1;
    }

    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [rows, selectedCompany]);

  // Date filter options (unique dates with orders)
  const dateOptions = useMemo(() => {
    return [ALL_DATES, ...organizedDateOptions.map((d) => d.label)];
  }, [organizedDateOptions]);

  // Company + Date scoped rows (before status filter, so status pill badges show accurate counts)
  const companyAndDateScopedRows = useMemo(() => {
    return rows.filter((r) => {
      const matchCompany =
        selectedCompany === ALL_COMPANIES || r.companyName === selectedCompany;
      const matchDate =
        selectedDate === ALL_DATES || r.deliveryDateLabel === selectedDate;
      return matchCompany && matchDate;
    });
  }, [rows, selectedCompany, selectedDate]);

  // Meals and orders for each status filter pill.
  const statusPillLabels = useMemo(() => {
    const label = (match: (o: OrderHistoryItem) => boolean) =>
      mealsAndOrdersLabel(companyAndDateScopedRows.map((r) => r.order).filter(match));
    return {
      all: label(() => true),
      preparing: label((o) => o.status === 'kitchen_prepping' || o.status === 'paid_scheduled'),
      out: label((o) => o.status === 'out_for_delivery'),
      delivered: label((o) => o.status === 'delivered'),
    };
  }, [companyAndDateScopedRows]);

  // Filtered orders (Company + Date + Pipeline Status)
  const filteredRows = useMemo(() => {
    return companyAndDateScopedRows.filter((r) => {
      if (selectedStatusFilter === 'preparing') {
        return r.order.status === 'kitchen_prepping' || r.order.status === 'paid_scheduled';
      }
      if (selectedStatusFilter === 'out_for_delivery') {
        return r.order.status === 'out_for_delivery';
      }
      if (selectedStatusFilter === 'delivered') {
        return r.order.status === 'delivered';
      }
      return true;
    });
  }, [companyAndDateScopedRows, selectedStatusFilter]);

  // Only these can still be marked delivered.
  const activeRows = useMemo(() => filteredRows.filter((r) => isActiveOrder(r.order)), [filteredRows]);
  const activeUnfulfilledCount = activeRows.length;
  const preparingRows = useMemo(
    () => activeRows.filter((r) => r.order.status !== 'out_for_delivery'),
    [activeRows]
  );

  // Cancelled orders are never cooked or labelled.
  const productionRows = useMemo(
    () => filteredRows.filter((r) => r.order.status !== 'cancelled'),
    [filteredRows]
  );

  // Prep summary & flat meal records (with sticker numbers and allergy flags)
  const prepSummary = useMemo(() => {
    return buildPrepSummary(productionRows);
  }, [productionRows]);

  const flatMealRecords = useMemo(() => {
    return buildFlatMealRecords(productionRows);
  }, [productionRows]);

  const allergyRecords = useMemo(() => {
    return flatMealRecords.filter((m) => m.isAllergy);
  }, [flatMealRecords]);

  // Map orderId -> assigned sticker label(s) for quick order card display
  const stickerMapByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of flatMealRecords) {
      if (!map.has(m.order.id)) {
        map.set(m.order.id, m.sticker);
      }
    }
    return map;
  }, [flatMealRecords]);

  // Handle single order delivery
  const handleMarkDeliveredPress = (row: AdminActiveOrderRow) => {
    if (isChefReadOnly) {
      Alert.alert('View Only', 'Chef accounts can view orders and export kitchen documents. An admin must update deliveries.');
      return;
    }
    setPendingDeliveryOrder(row);
    setIsConfirmDeliveryOpen(true);
  };

  const handleConfirmSingleDelivery = async () => {
    if (!pendingDeliveryOrder) return;
    const targetId = pendingDeliveryOrder.order.id;

    setLocalOrders((prev) =>
      prev.map((o) => (o.id === targetId ? { ...o, status: 'delivered' as OrderStatus, stage: 4 } : o))
    );

    setIsConfirmDeliveryOpen(false);
    const saved = await updateOrderStatusInDb(targetId, 'delivered', 4);
    if (!saved) {
      setLocalOrders(orderHistory);
      Alert.alert('Not Saved', 'The order could not be marked as delivered. Please try again.');
      setPendingDeliveryOrder(null);
      return;
    }
    Alert.alert(
      'Delivery Confirmed ✓',
      `Order #${pendingDeliveryOrder.order.orderNumber} for ${pendingDeliveryOrder.customerName} is now Delivered. The customer sees the new status in the app.`,
      [{ text: 'OK' }]
    );
    setPendingDeliveryOrder(null);
  };

  const handleDispatchPress = (targetRows: AdminActiveOrderRow[]) => {
    if (isChefReadOnly) {
      Alert.alert('View Only', 'Chef accounts can view orders and export kitchen documents. An admin must update deliveries.');
      return;
    }
    setPendingDispatchRows(targetRows);
  };

  const handleConfirmDispatch = async () => {
    if (!pendingDispatchRows) return;
    const ids = pendingDispatchRows.map((r) => r.order.id);
    const idSet = new Set(ids);
    setPendingDispatchRows(null);

    const moved = await markOrdersOutForDeliveryInDb(ids);
    if (moved === null) {
      Alert.alert('Not Saved', 'The orders could not be updated. Please try again.');
      return;
    }
    setLocalOrders((prev) =>
      prev.map((o) =>
        idSet.has(o.id) && (o.status === 'paid_scheduled' || o.status === 'kitchen_prepping')
          ? { ...o, status: 'out_for_delivery' as OrderStatus, stage: 3 }
          : o
      )
    );
    Alert.alert('Out for Delivery ✓', `${moved} order(s) are out for delivery. Each customer has been notified in the app.`);
  };

  // Handle bulk delivery
  const handleConfirmBulkDelivery = async () => {
    if (isChefReadOnly) {
      Alert.alert('View Only', 'Chef accounts can view orders and export kitchen documents. An admin must update deliveries.');
      return;
    }
    const targetLabel = selectedCompany !== ALL_COMPANIES ? selectedCompany : 'all filtered companies';
    const targetDateLabel = selectedDate !== ALL_DATES ? `on ${selectedDate}` : '';

    const idsArray = activeRows.map((r) => r.order.id);
    const idsToDeliver = new Set(idsArray);

    setLocalOrders((prev) =>
      prev.map((o) => (idsToDeliver.has(o.id) ? { ...o, status: 'delivered' as OrderStatus, stage: 4 } : o))
    );

    setIsBulkConfirmOpen(false);
    const saved = await updateBatchOrderStatusesInDb(idsArray, 'delivered', 4);
    if (!saved) {
      setLocalOrders(orderHistory);
      Alert.alert('Not Saved', 'The orders could not be marked as delivered. Please try again.');
      return;
    }
    Alert.alert(
      'Deliveries Confirmed ✓',
      `${idsArray.length} order(s) for ${targetLabel} ${targetDateLabel} are now Delivered. Customers see the new status in the app.`,
      [{ text: 'OK' }]
    );
  };

  // Document exports (batch or single order)
  const handleExport = async (type: KitchenExportType, targetRows?: AdminActiveOrderRow[]) => {
    setIsExportModalOpen(false);
    const exportRows = targetRows || productionRows;
    if (exportRows.length === 0) {
      Alert.alert('No Orders', 'There are no active orders matching the current filters to export.');
      return;
    }

    const exporter = new KitchenExports(exportRows, selectedCompany, selectedDate);
    try {
      if (type === 'production_pdf') {
        await exporter.productionSheetPdf();
      } else if (type === 'production_excel' || type === 'workbook_excel') {
        await exporter.dailyKitchenWorkbookExcel();
      } else if (type === 'delivery_pdf') {
        await exporter.deliveryNotesPdf();
      } else if (type === 'delivery_report_pdf') {
        await exporter.deliveryReportPdf();
      } else if (type === 'stickers_pdf') {
        await exporter.mealStickersPdf();
      } else if (type === 'individual_delivery_pdf') {
        await exporter.individualDeliveryNotesPdf();
      } else if (type === 'invoices_pdf') {
        await exporter.invoicesPdf();
      }

      Alert.alert(
        'Export Ready 📄',
        `Document generated successfully for ${exportRows.length} order(s) (${selectedCompany} · ${selectedDate}). File downloaded or shared.`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Export Error', err?.message || 'Could not generate document.');
    }
  };

  // Status badge styling helper
  const getStatusBadge = (status: OrderStatus) => {
    if (status === 'delivered') {
      return { label: 'Delivered', bg: 'rgba(67, 160, 71, 0.15)', text: '#43A047', icon: 'checkmark-circle' };
    }
    if (status === 'out_for_delivery') {
      return { label: 'Out for Delivery', bg: 'rgba(251, 140, 0, 0.15)', text: '#FB8C00', icon: 'bicycle' };
    }
    if (status === 'cancelled') {
      return { label: 'Cancelled', bg: 'rgba(120, 120, 120, 0.15)', text: '#787878', icon: 'close-circle' };
    }
    if (status === 'unfulfilled') {
      return { label: 'Reported Not Delivered', bg: 'rgba(229, 57, 53, 0.15)', text: '#E53935', icon: 'alert-circle' };
    }
    return { label: 'Preparing (Kitchen)', bg: 'rgba(30, 136, 229, 0.15)', text: '#1E88E5', icon: 'restaurant' };
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 1. Filter Chips Row */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsCompanyFilterModalOpen(true)}
          style={[styles.filterChip, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
        >
          <Ionicons name="business" size={13} color={theme.brandGold} />
          <Text style={[styles.filterChipText, { color: theme.textPrimary }]} numberOfLines={1}>
            {selectedCompany}
          </Text>
          <Ionicons name="chevron-down" size={12} color={theme.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsDateFilterModalOpen(true)}
          style={[styles.filterChip, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
        >
          <Ionicons name="calendar" size={13} color={theme.brandGold} />
          <Text style={[styles.filterChipText, { color: theme.textPrimary }]} numberOfLines={1}>
            {selectedDate}
          </Text>
          <Ionicons name="chevron-down" size={12} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      {/* 1B. Pipeline Status Filter Pills (Synced with Overview Pipeline Buttons) */}
      <View style={styles.statusFilterBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusFilterRow}
        >
          {([
            {
              id: 'all',
              label: `All (${statusPillLabels.all})`,
              icon: 'layers-outline',
              activeColor: theme.primary,
            },
            {
              id: 'preparing',
              label: `Preparing (${statusPillLabels.preparing})`,
              icon: 'restaurant',
              activeColor: '#1E88E5',
            },
            {
              id: 'out_for_delivery',
              label: `Out for Delivery (${statusPillLabels.out})`,
              icon: 'bicycle',
              activeColor: '#FB8C00',
            },
            {
              id: 'delivered',
              label: `Delivered (${statusPillLabels.delivered})`,
              icon: 'checkmark-circle',
              activeColor: '#43A047',
            },
          ] as { id: ActiveOrderStatusFilter; label: string; icon: any; activeColor: string }[]).map(
            (pill) => {
              const isActive = selectedStatusFilter === pill.id;
              return (
                <TouchableOpacity
                  key={pill.id}
                  activeOpacity={0.8}
                  onPress={() => handleStatusFilterSelect(pill.id)}
                  style={[
                    styles.statusFilterPill,
                    {
                      backgroundColor: isActive ? pill.activeColor : theme.surface,
                      borderColor: isActive ? pill.activeColor : theme.surfaceBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name={pill.icon}
                    size={12}
                    color={isActive ? (pill.id === 'all' ? theme.onPrimary : '#FFFFFF') : pill.activeColor}
                  />
                  <Text
                    style={[
                      styles.statusFilterPillText,
                      { color: isActive ? (pill.id === 'all' ? theme.onPrimary : '#FFFFFF') : theme.textSecondary },
                    ]}
                  >
                    {pill.label}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>
      </View>

      {/* 2. Controls Row: [ Orders | Prep Summary ] + Export Button */}
      <View style={styles.controlsRow}>
        <View style={[styles.segmentTrack, { backgroundColor: theme.chipBg }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsPrepViewActive(false)}
            style={[
              styles.segmentBtn,
              !isPrepViewActive && [styles.segmentBtnActive, { backgroundColor: theme.primary }],
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: !isPrepViewActive ? theme.textInverse : theme.textSecondary },
              ]}
            >
              Orders ({filteredRows.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsPrepViewActive(true)}
            style={[
              styles.segmentBtn,
              isPrepViewActive && [styles.segmentBtnActive, { backgroundColor: theme.primary }],
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: isPrepViewActive ? theme.textInverse : theme.textSecondary },
              ]}
            >
              Prep Summary ({prepSummary.length})
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsExportModalOpen(true)}
          style={[styles.exportBtn, { backgroundColor: theme.brandGold }]}
        >
          <Ionicons name="download-outline" size={15} color={theme.onBrandGold} />
          <Text style={[styles.exportBtnText, { color: theme.onBrandGold }]}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Bulk Action Banner: Mark Filtered as Delivered */}
      {!isPrepViewActive && activeUnfulfilledCount > 0 && (
        <View style={[styles.bulkBannerContainer, { gap: 8 }]}>
          {preparingRows.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleDispatchPress(preparingRows)}
              style={[styles.bulkDeliveryBtn, { backgroundColor: '#FB8C00' }]}
            >
              <Ionicons name="bicycle" size={17} color="#FFFFFF" />
              <Text style={styles.bulkDeliveryText}>Send Out for Delivery & Notify ({preparingRows.length})</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsBulkConfirmOpen(true)}
            style={[styles.bulkDeliveryBtn, { backgroundColor: '#059669' }]}
          >
            <Ionicons name="checkmark-done-circle" size={17} color="#FFFFFF" />
            <Text style={styles.bulkDeliveryText}>
              Mark {selectedCompany !== ALL_COMPANIES ? selectedCompany : 'Filtered'} as Delivered ({activeUnfulfilledCount})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Active Content: Orders List or Prep Summary */}
      {isPrepViewActive ? (
        /* Prep Summary View */
        <FlatList
          data={prepSummary}
          keyExtractor={(item) => item.dishName}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 4 }}>
              <View style={styles.prepStatsBar}>
                <Text style={[styles.prepHeaderNote, { color: theme.textSecondary, marginBottom: 0 }]}>
                  1. COOK — What to Cook (Meals: {flatMealRecords.length} · Allergies: {allergyRecords.length})
                </Text>
              </View>
              {allergyRecords.length > 0 && (
                <View style={styles.allergyCookFirstBanner}>
                  <View style={styles.allergyBannerHeader}>
                    <Text style={styles.allergyBannerTitle}>
                      !! ALLERGIES - COOK FIRST, SEAL &amp; LABEL SEPARATELY
                    </Text>
                  </View>
                  <View style={styles.allergyBannerBody}>
                    {allergyRecords.map((a, idx) => (
                      <View key={`${a.order.id}-${idx}`} style={styles.allergyBannerRow}>
                        <Text style={styles.allergyBannerDish}>1x {a.meal}</Text>
                        <Text style={styles.allergyBannerMeta}>
                          {a.notes} — {a.recipientName} ({a.company})
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="restaurant-outline" size={40} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No dishes scheduled for these filters.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.prepCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <View style={[styles.qtyBadge, { backgroundColor: theme.primary }]}>
                <Text style={[styles.qtyBadgeText, { color: theme.textInverse }]}>{item.totalQuantity}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.prepCategoryText, { color: theme.brandGold }]}>
                  {item.categoryName.toUpperCase()}
                </Text>
                <Text style={[styles.prepDishName, { color: theme.textPrimary }]}>{item.dishName}</Text>
                {item.specialNotes.length > 0 && (
                  <View style={{ marginTop: 4, gap: 2 }}>
                    {item.specialNotes.map((n, i) => (
                      <Text key={i} style={styles.prepSpecialNoteText}>
                        • {n.isAllergy ? 'ALLERGY: ' : ''}{n.note} — {n.recipientName} ({n.companyName})
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        />
      ) : (
        /* Orders List View */
        <FlatList
          data={filteredRows}
          keyExtractor={(item) => item.order.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={40} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No active orders found matching the selected filters.
              </Text>
            </View>
          }
          renderItem={({ item: row }) => {
            const isDelivered = row.order.status === 'delivered';
            const badge = getStatusBadge(row.order.status);

            return (
              <View style={[styles.orderCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                {/* Header: Company, Location, and Status Badge */}
                <View style={styles.orderCardHeader}>
                  <View style={styles.orderHeaderLeft}>
                    <Text style={[styles.orderCompanyName, { color: theme.textPrimary }]}>
                      {row.companyName}
                    </Text>
                    <Text style={[styles.orderLocationText, { color: theme.textSecondary }]}>
                      {row.order.deliveryFloor || row.locationName}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {stickerMapByOrderId.get(row.order.id) && (
                      <View style={[styles.stickerBadge, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}>
                        <Text style={[styles.stickerBadgeText, { color: theme.textPrimary }]}>
                          Sticker {stickerMapByOrderId.get(row.order.id)}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.statusChip, { backgroundColor: badge.bg }]}>
                      <Ionicons name={badge.icon as any} size={11} color={badge.text} />
                      <Text style={[styles.statusChipText, { color: badge.text }]}>{badge.label}</Text>
                    </View>
                  </View>
                </View>

                {/* Customer & Order Metadata */}
                <View style={styles.metaRow}>
                  <Text style={[styles.customerText, { color: theme.textPrimary }]}>
                    👤 {row.customerName}
                  </Text>
                  <Text style={[styles.orderMetaText, { color: theme.textMuted }]}>
                    Order #{row.order.orderNumber}
                  </Text>
                </View>

                <View style={styles.dateSlotRow}>
                  <Text style={[styles.dateSlotText, { color: theme.brandGold }]}>
                    📅 {row.deliveryDateLabel} • 12:00 PM Sharp
                  </Text>
                  <Text style={[styles.priceText, { color: theme.primary }]}>
                    R {row.order.totalPaid.toFixed(2)}
                  </Text>
                </View>

                {/* Items List */}
                <View style={styles.itemsWrapper}>
                  {row.order.items.map((item) => (
                    <View key={item.id} style={styles.itemLine}>
                      <Text style={[styles.itemLineText, { color: theme.textPrimary }]}>
                        • {item.quantity}x {item.menuItem.name}
                      </Text>
                      {item.allergyNotes ? (
                        <View style={styles.allergyTag}>
                          <Text style={styles.allergyTagText}>⚠️ Allergy / Note: {item.allergyNotes}</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>

                {/* Quick Document Actions + Manual Status Action Row */}
                <View style={styles.actionRow}>
                  <View style={styles.orderDocRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleExport('individual_delivery_pdf', [row])}
                      style={[styles.singleDocBtn, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}
                    >
                      <Ionicons name="document-text-outline" size={13} color={theme.textPrimary} />
                      <Text style={[styles.singleDocBtnText, { color: theme.textPrimary }]}>Delivery Slip PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleExport('invoices_pdf', [row])}
                      style={[styles.singleDocBtn, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}
                    >
                      <Ionicons name="receipt-outline" size={13} color={theme.textPrimary} />
                      <Text style={[styles.singleDocBtnText, { color: theme.textPrimary }]}>Invoice PDF</Text>
                    </TouchableOpacity>
                  </View>

                  {isDelivered ? (
                    <View style={[styles.deliveredPill, { backgroundColor: 'rgba(67, 160, 71, 0.12)' }]}>
                      <Ionicons name="checkmark-circle" size={15} color="#43A047" />
                      <Text style={styles.deliveredPillText}>✓ Delivered</Text>
                    </View>
                  ) : !isActiveOrder(row.order) ? null : (
                    <View style={{ gap: 6 }}>
                      {row.order.status !== 'out_for_delivery' && (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => handleDispatchPress([row])}
                          style={[styles.markDeliveredBtn, { backgroundColor: '#FB8C00' }]}
                        >
                          <Ionicons name="bicycle" size={16} color="#FFFFFF" />
                          <Text style={styles.markDeliveredBtnText}>Out for Delivery</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleMarkDeliveredPress(row)}
                        style={[styles.markDeliveredBtn, { backgroundColor: '#059669' }]}
                      >
                        <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.markDeliveredBtnText}>Mark Delivered</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* --- Single Order Confirmation Modal --- */}
      <Modal visible={isConfirmDeliveryOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: 'rgba(5, 150, 105, 0.15)' }]}>
              <Ionicons name="bicycle" size={28} color="#059669" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Confirm Meal Delivery
            </Text>
            <Text style={[styles.modalMessage, { color: theme.textSecondary }]}>
              Are you sure the meals have been delivered to{' '}
              <Text style={{ fontWeight: '700', color: theme.textPrimary }}>
                {pendingDeliveryOrder?.customerName}
              </Text>{' '}
              (Order #{pendingDeliveryOrder?.order.orderNumber}) at{' '}
              <Text style={{ fontWeight: '700', color: theme.textPrimary }}>
                {pendingDeliveryOrder?.companyName} • {pendingDeliveryOrder?.order.deliveryFloor || 'drop-off pantry'}
              </Text>
              ?
            </Text>
            <Text style={[styles.modalSubMessage, { color: theme.textMuted }]}>
              This will update the customer&apos;s tracker to &quot;Delivered&quot; and send an automated delivery confirmation.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setIsConfirmDeliveryOpen(false)}
                style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder }]}
              >
                <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmSingleDelivery}
                style={[styles.modalConfirmBtn, { backgroundColor: '#059669' }]}
              >
                <Text style={styles.modalConfirmText}>Yes, Mark Delivered</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Bulk Orders Confirmation Modal --- */}
      <Modal visible={isBulkConfirmOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: 'rgba(5, 150, 105, 0.15)' }]}>
              <Ionicons name="checkmark-done-circle" size={32} color="#059669" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Confirm Bulk Batch Delivery
            </Text>
            <Text style={[styles.modalMessage, { color: theme.textSecondary }]}>
              Are you sure the meals are delivered to all{' '}
              <Text style={{ fontWeight: '700', color: theme.textPrimary }}>
                {activeUnfulfilledCount} client orders
              </Text>{' '}
              for{' '}
              <Text style={{ fontWeight: '700', color: theme.brandGold }}>
                {selectedCompany !== ALL_COMPANIES ? selectedCompany : 'all filtered accounts'}
              </Text>{' '}
              {selectedDate !== ALL_DATES ? `on ${selectedDate}` : ''}?
            </Text>
            <Text style={[styles.modalSubMessage, { color: theme.textMuted }]}>
              Each customer will see the Delivered status in the app.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setIsBulkConfirmOpen(false)}
                style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder }]}
              >
                <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmBulkDelivery}
                style={[styles.modalConfirmBtn, { backgroundColor: '#059669' }]}
              >
                <Text style={styles.modalConfirmText}>Yes, Mark All Delivered</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Out for Delivery Confirmation Modal --- */}
      <Modal visible={pendingDispatchRows !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: 'rgba(251, 140, 0, 0.15)' }]}>
              <Ionicons name="bicycle" size={28} color="#FB8C00" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Send Out for Delivery?</Text>
            <Text style={[styles.modalMessage, { color: theme.textSecondary }]}>
              {pendingDispatchRows?.length ?? 0} order(s) will show as Out for Delivery, and each customer will be notified immediately in the app.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setPendingDispatchRows(null)}
                style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder }]}
              >
                <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmDispatch}
                style={[styles.modalConfirmBtn, { backgroundColor: '#FB8C00' }]}
              >
                <Text style={styles.modalConfirmText}>Yes, Send & Notify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- YKC Kitchen & Dispatch Export Modal --- */}
      <Modal visible={isExportModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.exportModalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <View style={styles.exportModalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                YKC Kitchen &amp; Dispatch Exports
              </Text>
              <Text style={[styles.exportSubtitle, { color: theme.textSecondary }]}>
                {flatMealRecords.length} meals ({filteredRows.length} orders) · {selectedCompany} · {selectedDate}
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.exportOptionsList}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleExport('workbook_excel')}
                style={[styles.exportOptionRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              >
                <Text style={styles.exportOptionIcon}>📊</Text>
                <View style={styles.exportOptionInfo}>
                  <Text style={[styles.exportOptionTitle, { color: theme.textPrimary }]}>
                    YKC Daily Kitchen Workbook (.xlsx)
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: theme.textSecondary }]}>
                    5 sheets: FILTER - ALL MEALS, 1. COOK, 2. PACK, 3. DELIVERY NOTE, 4. DELIVERY REPORT
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleExport('production_pdf')}
                style={[styles.exportOptionRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              >
                <Text style={styles.exportOptionIcon}>👨‍🍳</Text>
                <View style={styles.exportOptionInfo}>
                  <Text style={[styles.exportOptionTitle, { color: theme.textPrimary }]}>
                    1 &amp; 2. Production &amp; Packing Sheet (PDF)
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: theme.textSecondary }]}>
                    1. COOK (allergies first + totals) &amp; 2. PACK per-company crate checklists
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleExport('delivery_pdf')}
                style={[styles.exportOptionRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              >
                <Text style={styles.exportOptionIcon}>🚚</Text>
                <View style={styles.exportOptionInfo}>
                  <Text style={[styles.exportOptionTitle, { color: theme.textPrimary }]}>
                    3. Company Delivery Notes (PDF)
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: theme.textSecondary }]}>
                    Driver &amp; client sign-off sheet per company with dish summary &amp; allergy count
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleExport('delivery_report_pdf')}
                style={[styles.exportOptionRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              >
                <Text style={styles.exportOptionIcon}>📋</Text>
                <View style={styles.exportOptionInfo}>
                  <Text style={[styles.exportOptionTitle, { color: theme.textPrimary }]}>
                    4. Delivery Report by Sticker (PDF)
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: theme.textSecondary }]}>
                    One line per meal sticker (1 of N) in exact sticker sequence for reception check-off
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleExport('stickers_pdf')}
                style={[styles.exportOptionRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              >
                <Text style={styles.exportOptionIcon}>🏷️</Text>
                <View style={styles.exportOptionInfo}>
                  <Text style={[styles.exportOptionTitle, { color: theme.textPrimary }]}>
                    5. Meal Container Stickers — 3×7 A4 (PDF)
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: theme.textSecondary }]}>
                    21 stickers/page with recipient, dish, !! ALLERGY !! banner, EAT BY date &amp; 1 of N
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleExport('individual_delivery_pdf')}
                style={[styles.exportOptionRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              >
                <Text style={styles.exportOptionIcon}>✂️</Text>
                <View style={styles.exportOptionInfo}>
                  <Text style={[styles.exportOptionTitle, { color: theme.textPrimary }]}>
                    Individual Order Delivery Slips — 2/Page (PDF)
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: theme.textSecondary }]}>
                    2 per A4 page with cut line, Sticker X of N, item check-off &amp; recipient signature
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleExport('invoices_pdf')}
                style={[styles.exportOptionRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              >
                <Text style={styles.exportOptionIcon}>🧾</Text>
                <View style={styles.exportOptionInfo}>
                  <Text style={[styles.exportOptionTitle, { color: theme.textPrimary }]}>
                    Consolidated Tax Invoices (PDF)
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: theme.textSecondary }]}>
                    Official YKC tax invoices with PAID stamp, Billed/Delivered To &amp; line items
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setIsExportModalOpen(false)}
              style={[styles.closeExportBtn, { borderColor: theme.surfaceBorder }]}
            >
              <Text style={[styles.closeExportText, { color: theme.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- Filter Pickers --- */}
      {/* Company Picker Modal */}
      <Modal visible={isCompanyFilterModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.pickerModalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary, marginBottom: 12 }]}>
              Filter by Corporate Account
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {companyOptions.map((comp) => (
                <TouchableOpacity
                  key={comp}
                  onPress={() => {
                    setSelectedCompany(comp);
                    setIsCompanyFilterModalOpen(false);
                  }}
                  style={[
                    styles.pickerOptionRow,
                    selectedCompany === comp && { backgroundColor: theme.chipBg },
                  ]}
                >
                  <Text style={[styles.pickerOptionText, { color: selectedCompany === comp ? theme.primary : theme.textPrimary }]}>
                    {comp}
                  </Text>
                  {selectedCompany === comp && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setIsCompanyFilterModalOpen(false)} style={styles.pickerCloseBtn}>
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal visible={isDateFilterModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.pickerModalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <View style={{ marginBottom: 12, gap: 2 }}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary, textAlign: 'left' }]}>
                Filter by Delivery Date
              </Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                Select a scheduled date to view orders, prep summary &amp; exports
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {/* 1. All Dates Option */}
              {(() => {
                const isAllSelected = selectedDate === ALL_DATES;
                const totalOrdersCount = organizedDateOptions.reduce((s, d) => s + d.orderCount, 0);
                const totalMealsCount = organizedDateOptions.reduce((s, d) => s + d.mealCount, 0);
                return (
                  <TouchableOpacity
                    key={ALL_DATES}
                    onPress={() => {
                      setSelectedDate(ALL_DATES);
                      setIsDateFilterModalOpen(false);
                    }}
                    style={[
                      styles.pickerOptionRow,
                      {
                        borderWidth: 1,
                        borderColor: isAllSelected ? theme.primary : theme.surfaceBorder,
                        backgroundColor: isAllSelected ? theme.primaryMuted : theme.surface,
                        marginBottom: 8,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: isAllSelected ? theme.primary : theme.chipBg,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons
                          name="layers-outline"
                          size={16}
                          color={isAllSelected ? theme.textInverse : theme.brandGold}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.pickerOptionText,
                            { color: isAllSelected ? theme.primary : theme.textPrimary, fontWeight: '700' },
                          ]}
                        >
                          {ALL_DATES} ({organizedDateOptions.length} {organizedDateOptions.length === 1 ? 'Day' : 'Days'})
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 1 }}>
                          {totalOrdersCount} {totalOrdersCount === 1 ? 'order' : 'orders'} • {totalMealsCount}{' '}
                          {totalMealsCount === 1 ? 'meal' : 'meals'} scheduled
                        </Text>
                      </View>
                    </View>
                    {isAllSelected && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
                  </TouchableOpacity>
                );
              })()}

              {/* 2. Chronologically Sorted Date Options */}
              {organizedDateOptions.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: theme.textMuted }}>
                    No delivery dates with orders found.
                  </Text>
                </View>
              ) : (
                organizedDateOptions.map((item) => {
                  const isSelected = selectedDate === item.label;
                  const allDelivered = item.pendingCount === 0;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      onPress={() => {
                        setSelectedDate(item.label);
                        setIsDateFilterModalOpen(false);
                      }}
                      style={[
                        styles.pickerOptionRow,
                        {
                          borderWidth: 1,
                          borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                          backgroundColor: isSelected ? theme.primaryMuted : theme.surface,
                          marginBottom: 8,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            backgroundColor: isSelected ? theme.primary : theme.chipBg,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={16}
                            color={isSelected ? theme.textInverse : theme.brandGold}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.pickerOptionText,
                              { color: isSelected ? theme.primary : theme.textPrimary, fontWeight: '700' },
                            ]}
                          >
                            {item.label}
                          </Text>
                          <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 1 }}>
                            {item.isoDate !== item.label ? `${item.isoDate} • ` : ''}
                            {item.orderCount} {item.orderCount === 1 ? 'order' : 'orders'} • {item.mealCount}{' '}
                            {item.mealCount === 1 ? 'meal' : 'meals'}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View
                          style={{
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                            borderRadius: 6,
                            backgroundColor: allDelivered
                              ? 'rgba(67, 160, 71, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '700',
                              color: allDelivered ? '#43A047' : '#D97706',
                            }}
                          >
                            {allDelivered ? 'Delivered' : `${item.pendingCount} Active`}
                          </Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setIsDateFilterModalOpen(false)} style={styles.pickerCloseBtn}>
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  filterChipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  statusFilterBarWrap: {
    paddingBottom: 8,
  },
  statusFilterRow: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusFilterPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  segmentTrack: {
    flex: 1,
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
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  bulkBannerContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  bulkDeliveryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    borderRadius: 21,
  },
  bulkDeliveryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  prepStatsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prepHeaderNote: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  allergyCookFirstBanner: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#C62828',
    backgroundColor: '#FDECEC',
  },
  allergyBannerHeader: {
    backgroundColor: '#C62828',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  allergyBannerTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  allergyBannerBody: {
    padding: 10,
    gap: 6,
  },
  allergyBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  allergyBannerDish: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '800',
  },
  allergyBannerMeta: {
    color: '#C62828',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  prepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
  },
  qtyBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  prepCategoryText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  prepDishName: {
    fontSize: 14,
    fontWeight: '700',
  },
  prepSpecialNoteText: {
    fontSize: 11,
    color: '#C62828',
    fontWeight: '600',
  },
  orderCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
  },
  orderHeaderLeft: {
    flex: 1,
    minWidth: 140,
    gap: 2,
  },
  orderCompanyName: {
    fontSize: 15,
    fontWeight: '800',
  },
  orderLocationText: {
    fontSize: 12,
  },
  stickerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  stickerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  customerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
  },
  orderMetaText: {
    fontSize: 11,
  },
  dateSlotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 2,
  },
  dateSlotText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    flexShrink: 1,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '800',
  },
  itemsWrapper: {
    gap: 4,
    paddingVertical: 4,
  },
  itemLine: {
    gap: 2,
  },
  itemLineText: {
    fontSize: 13,
  },
  allergyTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDECEC',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#C62828',
  },
  allergyTagText: {
    color: '#C62828',
    fontSize: 10,
    fontWeight: '800',
  },
  actionRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.12)',
    gap: 8,
  },
  orderDocRow: {
    flexDirection: 'row',
    gap: 8,
  },
  singleDocBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
  },
  singleDocBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deliveredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 18,
  },
  deliveredPillText: {
    color: '#43A047',
    fontSize: 12,
    fontWeight: '800',
  },
  markDeliveredBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 19,
  },
  markDeliveredBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalSubMessage: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 1.3,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  exportModalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  exportModalHeader: {
    gap: 4,
    alignItems: 'center',
  },
  exportSubtitle: {
    fontSize: 12,
  },
  exportOptionsList: {
    gap: 10,
  },
  exportOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  exportOptionIcon: {
    fontSize: 22,
  },
  exportOptionInfo: {
    flex: 1,
    gap: 2,
  },
  exportOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  exportOptionDesc: {
    fontSize: 11,
  },
  closeExportBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  closeExportText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pickerModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  pickerOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pickerOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pickerCloseBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
});

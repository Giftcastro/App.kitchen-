// DISABLED: no screen opens this file. Remove the "// " prefixes to restore it.
export {};

// import React, { useState, useMemo } from 'react';
// import {
//   View,
//   Text,
//   ScrollView,
//   TouchableOpacity,
//   StyleSheet,
//   Alert,
//   Modal,
//   TextInput,
//   Platform,
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { BlurView } from 'expo-blur';
// import { useTheme } from '../../theme/ThemeContext';
// import { typography } from '../../theme';
// import { useCart } from '../../context/CartContext';
// import { OrderStatus, AggregatedPrepItem } from '../../types';
// import {
//   KitchenExports,
//   AdminActiveOrderRow,
//   buildFlatMealRecords,
// } from '../../services/kitchenExports';
//
// interface BusinessDay {
//   dateStr: string; // YYYY-MM-DD
//   tabLabel: string;
//   dayName: string;
//   formattedDate: string;
// }
//
// /**
//  * Calculates consecutive business delivery days in SAST (UTC+2),
//  * strictly skipping Saturdays and Sundays so Friday advances directly to Monday.
//  */
// function getBusinessDeliveryDates(): BusinessDay[] {
//   const now = new Date();
//   const sastOffsetMs = 2 * 60 * 60 * 1000;
//   const sastDate = new Date(now.getTime() + sastOffsetMs);
//
//   const current = new Date(sastDate.getUTCFullYear(), sastDate.getUTCMonth(), sastDate.getUTCDate());
//
//   // If today is a weekend, advance to Monday
//   if (current.getDay() === 6) {
//     current.setDate(current.getDate() + 2);
//   } else if (current.getDay() === 0) {
//     current.setDate(current.getDate() + 1);
//   }
//
//   const result: BusinessDay[] = [];
//   const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
//   const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
//
//   while (result.length < 3) {
//     if (current.getDay() !== 0 && current.getDay() !== 6) {
//       const yyyy = current.getFullYear();
//       const mm = String(current.getMonth() + 1).padStart(2, '0');
//       const dd = String(current.getDate()).padStart(2, '0');
//       const dateStr = `${yyyy}-${mm}-${dd}`;
//
//       const dayName = dayNames[current.getDay()];
//       const dayNum = current.getDate();
//       const monthName = monthNames[current.getMonth()];
//       const formattedDate = `${dayName}, ${dayNum} ${monthName}`;
//
//       let prefix = 'Today';
//       if (result.length === 1) prefix = 'Tomorrow';
//       if (result.length === 2) prefix = dayName;
//
//       result.push({
//         dateStr,
//         tabLabel: `${prefix} (${dayName}, ${dayNum} ${monthName})`,
//         dayName,
//         formattedDate,
//       });
//     }
//     current.setDate(current.getDate() + 1);
//   }
//
//   return result;
// }
//
// export const DailyDispatchTab: React.FC = () => {
//   const { theme, isDark } = useTheme();
//   const {
//     orderHistory,
//     categories,
//     corporateAccounts,
//     getBatchSiteGroups,
//     updateBatchStatus,
//   } = useCart();
//
//   const businessDays = useMemo(() => getBusinessDeliveryDates(), []);
//   const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
//   const activeDay = businessDays[selectedDayIdx] || businessDays[0];
//   const targetDateString = activeDay.dateStr;
//
//   const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
//   const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
//   const [goodsSearchQuery, setGoodsSearchQuery] = useState<string>('');
//
//   const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>({
//     site_intellect_fl3: true,
//   });
//   const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
//
//   const matchingOrdersForDate = useMemo(() => {
//     return orderHistory.filter((ord) => {
//       const dateMatch =
//         ord.targetDeliveryDate === targetDateString ||
//         ord.status === 'kitchen_prepping' ||
//         ord.status === 'out_for_delivery';
//       if (!dateMatch) return false;
//
//       if (selectedCompanyFilter !== 'all') {
//         const compMatch =
//           (ord.companyName && ord.companyName.toLowerCase().includes(selectedCompanyFilter.toLowerCase())) ||
//           ord.companyLocation.toLowerCase().includes(selectedCompanyFilter.toLowerCase()) ||
//           ord.deliveryFloor.toLowerCase().includes(selectedCompanyFilter.toLowerCase());
//         if (!compMatch) return false;
//       }
//       return true;
//     });
//   }, [orderHistory, targetDateString, selectedCompanyFilter]);
//
//   const dispatchExportRows: AdminActiveOrderRow[] = useMemo(() => {
//     return matchingOrdersForDate.map((o) => {
//       const company =
//         o.companyName ||
//         corporateAccounts.find((c) => o.companyLocation?.includes(c.companyName))?.companyName ||
//         corporateAccounts[0]?.companyName ||
//         'Corporate Partner';
//
//       const customerName = o.customerName
//         ? `${o.customerName}${o.customerEmail ? ` (${o.customerEmail})` : ''}`
//         : 'Corporate Customer';
//
//       return {
//         order: o,
//         companyName: company,
//         locationName: o.companyLocation || 'Corporate Campus',
//         customerName,
//         deliveryDateLabel: o.deliveryDateFormatted || o.targetDeliveryDate,
//       };
//     });
//   }, [matchingOrdersForDate, corporateAccounts]);
//
//   const flatDispatchMeals = useMemo(() => {
//     return buildFlatMealRecords(dispatchExportRows);
//   }, [dispatchExportRows]);
//
//   const allergyDispatchMeals = useMemo(() => {
//     return flatDispatchMeals.filter((m) => m.isAllergy);
//   }, [flatDispatchMeals]);
//
//   const filteredPrepItems = useMemo(() => {
//     const map: Record<string, AggregatedPrepItem> = {};
//
//     matchingOrdersForDate.forEach((ord) => {
//       ord.items.forEach((item) => {
//         const dishId = item.menuItem.id;
//         const cat = categories.find((c) => c.id === item.menuItem.categoryId);
//         const catName = cat ? cat.name : (item.menuItem.categoryName || 'Mains');
//         const catId = item.menuItem.categoryId;
//
//         if (selectedCategoryFilter !== 'all' && catId !== selectedCategoryFilter) {
//           return;
//         }
//
//         if (goodsSearchQuery.trim()) {
//           const q = goodsSearchQuery.trim().toLowerCase();
//           const nameMatches = item.menuItem.name.toLowerCase().includes(q);
//           const ingredientMatches = item.menuItem.ingredients
//             ? item.menuItem.ingredients.toLowerCase().includes(q)
//             : false;
//           if (!nameMatches && !ingredientMatches) {
//             return;
//           }
//         }
//
//         if (!map[dishId]) {
//           map[dishId] = {
//             dishId,
//             dishName: item.menuItem.name,
//             categoryName: catName,
//             totalQuantity: 0,
//             allergyFlagsCount: 0,
//             allergyNotesSummary: [],
//           };
//         }
//
//         map[dishId].totalQuantity += item.quantity;
//         if (item.allergyNotes) {
//           map[dishId].allergyFlagsCount += item.quantity;
//           if (!map[dishId].allergyNotesSummary?.includes(item.allergyNotes)) {
//             map[dishId].allergyNotesSummary?.push(item.allergyNotes);
//           }
//         }
//       });
//     });
//
//     return Object.values(map).sort((a, b) => b.totalQuantity - a.totalQuantity);
//   }, [matchingOrdersForDate, categories, selectedCategoryFilter, goodsSearchQuery]);
//
//   const totalFilteredMealsCount = filteredPrepItems.reduce((sum, it) => sum + it.totalQuantity, 0);
//   const siteGroups = getBatchSiteGroups(targetDateString);
//
//   const isAnyFilterActive =
//     selectedCompanyFilter !== 'all' ||
//     selectedCategoryFilter !== 'all' ||
//     goodsSearchQuery.trim().length > 0;
//
//   const handleClearFilters = () => {
//     setSelectedCompanyFilter('all');
//     setSelectedCategoryFilter('all');
//     setGoodsSearchQuery('');
//   };
//
//   const toggleSiteExpand = (siteId: string) => {
//     setExpandedSites((prev) => ({
//       ...prev,
//       [siteId]: !prev[siteId],
//     }));
//   };
//
//   const handlePrintConfirm = async () => {
//     setIsPrintModalOpen(false);
//     if (dispatchExportRows.length > 0) {
//       const exporter = new KitchenExports(
//         dispatchExportRows,
//         selectedCompanyFilter === 'all' ? 'All Companies' : selectedCompanyFilter,
//         activeDay.formattedDate
//       );
//       try {
//         await exporter.productionSheetPdf();
//       } catch {
//         // Fallback alert below
//       }
//     }
//     Alert.alert(
//       'Production Sheet Ready',
//       `1. COOK & 2. PACK Production Sheet for ${activeDay.formattedDate} (${totalFilteredMealsCount} portions) generated for the kitchen station.`
//     );
//   };
//
//   const handleQuickDispatchExport = async (mode: 'stickers' | 'workbook') => {
//     setIsPrintModalOpen(false);
//     if (dispatchExportRows.length === 0) {
//       Alert.alert('No Orders', 'No dispatch orders found for the current selection.');
//       return;
//     }
//     const exporter = new KitchenExports(
//       dispatchExportRows,
//       selectedCompanyFilter === 'all' ? 'All Companies' : selectedCompanyFilter,
//       activeDay.formattedDate
//     );
//     try {
//       if (mode === 'stickers') {
//         await exporter.mealStickersPdf();
//       } else {
//         await exporter.dailyKitchenWorkbookExcel();
//       }
//     } catch (err: any) {
//       Alert.alert('Export Error', err?.message || 'Could not generate document.');
//     }
//   };
//
//   const handleToggleBatchStatus = async (siteId: string, currentStatus: OrderStatus) => {
//     let nextStatus: OrderStatus = 'out_for_delivery';
//     if (currentStatus === 'kitchen_prepping' || currentStatus === 'paid_scheduled') {
//       nextStatus = 'out_for_delivery';
//     } else if (currentStatus === 'out_for_delivery') {
//       nextStatus = 'delivered';
//     } else {
//       nextStatus = 'out_for_delivery';
//     }
//
//     await updateBatchStatus(siteId, nextStatus);
//
//     Alert.alert(
//       'Batch Status Updated',
//       `Drop location updated to '${nextStatus.replace('_', ' ').toUpperCase()}'. Notifications dispatched.`
//     );
//   };
//
//   return (
//     <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
//       <View style={[styles.dateSegment, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         {businessDays.map((day, idx) => {
//           const isSelected = selectedDayIdx === idx;
//           return (
//             <TouchableOpacity
//               key={day.dateStr}
//               activeOpacity={0.8}
//               onPress={() => setSelectedDayIdx(idx)}
//               style={[
//                 styles.dateTabBtn,
//                 isSelected && [
//                   styles.dateTabBtnActive,
//                   { backgroundColor: isDark ? '#FFFFFF' : '#121212', borderColor: isDark ? '#FFFFFF' : '#000000' },
//                 ],
//               ]}
//             >
//               <Text
//                 style={[
//                   styles.dateTabText,
//                   {
//                     color: isSelected
//                       ? isDark ? '#121212' : '#FFFFFF'
//                       : theme.textPrimary,
//                     fontWeight: isSelected ? '800' : '600',
//                     fontSize: 12,
//                   },
//                 ]}
//               >
//                 {idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : day.dayName}
//               </Text>
//               <Text
//                 style={{
//                   color: isSelected
//                     ? isDark ? '#121212' : '#FFFFFF'
//                     : theme.textSecondary,
//                   fontSize: 10,
//                   marginTop: 1,
//                 }}
//               >
//                 {day.formattedDate}
//               </Text>
//             </TouchableOpacity>
//           );
//         })}
//       </View>
//
//       <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         <View style={styles.summaryTopRow}>
//           <View style={{ flex: 1, marginRight: 10 }}>
//             <Text style={[styles.summaryLabel, { color: theme.textSecondary, fontFamily: typography.bodyBold }]}>
//               CHEF DISPATCH PRODUCTION SHEET
//             </Text>
//             <Text
//               style={[styles.summaryDate, { color: theme.textPrimary, fontFamily: typography.heading, flexShrink: 1 }]}
//               numberOfLines={2}
//             >
//               {activeDay.formattedDate} • 12:00 PM Drop
//             </Text>
//           </View>
//
//           <TouchableOpacity
//             activeOpacity={0.85}
//             onPress={() => setIsPrintModalOpen(true)}
//             style={[styles.printBtn, { backgroundColor: isDark ? '#FFFFFF' : '#121212' }]}
//           >
//             <Ionicons name="print-outline" size={16} color={isDark ? '#121212' : '#FFFFFF'} />
//             <Text style={[styles.printBtnText, { color: isDark ? '#121212' : '#FFFFFF', fontFamily: typography.bodyBold }]}>
//               Print Sheet
//             </Text>
//           </TouchableOpacity>
//         </View>
//
//         <View style={styles.summaryMetricsRow}>
//           <View style={[styles.metricItem, { backgroundColor: theme.surfaceHighlight }]}>
//             <Text style={[styles.metricNumber, { color: theme.textPrimary, fontFamily: typography.heading }]}>
//               {totalFilteredMealsCount}
//             </Text>
//             <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Portions to Cook</Text>
//           </View>
//
//           <View style={[styles.metricItem, { backgroundColor: theme.surfaceHighlight }]}>
//             <Text style={[styles.metricNumber, { color: theme.textPrimary, fontFamily: typography.heading }]}>
//               {filteredPrepItems.length}
//             </Text>
//             <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Dishes</Text>
//           </View>
//
//           <View style={[styles.metricItem, { backgroundColor: theme.surfaceHighlight }]}>
//             <Text style={[styles.metricNumber, { color: theme.textPrimary, fontFamily: typography.heading }]}>
//               {siteGroups.length}
//             </Text>
//             <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Floor Drops</Text>
//           </View>
//         </View>
//       </View>
//
//       <View style={[styles.filterCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         <View style={styles.filterHeaderRow}>
//           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
//             <Ionicons name="funnel-outline" size={16} color={theme.textPrimary} />
//             <Text style={[styles.filterTitle, { color: theme.textPrimary, fontFamily: typography.bodyBold }]}>
//               CHEF PREP FILTERS
//             </Text>
//           </View>
//           {isAnyFilterActive && (
//             <TouchableOpacity onPress={handleClearFilters} style={styles.clearFilterBtn}>
//               <Ionicons name="close-circle-outline" size={14} color={theme.textPrimary} />
//               <Text style={[styles.clearFilterText, { color: theme.textPrimary, fontFamily: typography.bodyBold }]}>
//                 Reset
//               </Text>
//             </TouchableOpacity>
//           )}
//         </View>
//
//         <View style={[styles.searchBox, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}>
//           <Ionicons name="search" size={16} color={theme.textSecondary} />
//           <TextInput
//             value={goodsSearchQuery}
//             onChangeText={setGoodsSearchQuery}
//             placeholder="Filter by goods / dish name (e.g. Tuna, Salmon, Curry)..."
//             placeholderTextColor={theme.textMuted}
//             style={[styles.searchInput, { color: theme.textPrimary }]}
//           />
//           {goodsSearchQuery.length > 0 && (
//             <TouchableOpacity onPress={() => setGoodsSearchQuery('')}>
//               <Ionicons name="close-circle" size={16} color={theme.textMuted} />
//             </TouchableOpacity>
//           )}
//         </View>
//
//         <Text style={[styles.subFilterLabel, { color: theme.textSecondary }]}>FILTER BY COMPANY:</Text>
//         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
//           <TouchableOpacity
//             onPress={() => setSelectedCompanyFilter('all')}
//             style={[
//               styles.filterPill,
//               { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder },
//               selectedCompanyFilter === 'all' && [
//                 styles.filterPillActive,
//                 { backgroundColor: isDark ? '#FFFFFF' : '#121212', borderColor: isDark ? '#FFFFFF' : '#000000' },
//               ],
//             ]}
//           >
//             <Text
//               style={[
//                 styles.filterPillText,
//                 {
//                   color: selectedCompanyFilter === 'all' ? (isDark ? '#121212' : '#FFFFFF') : theme.textSecondary,
//                   fontFamily: typography.bodyBold,
//                 },
//               ]}
//             >
//               All Companies
//             </Text>
//           </TouchableOpacity>
//
//           {corporateAccounts.map((corp) => {
//             const isSelected = selectedCompanyFilter === corp.companyName;
//             return (
//               <TouchableOpacity
//                 key={corp.id}
//                 onPress={() => setSelectedCompanyFilter(corp.companyName)}
//                 style={[
//                   styles.filterPill,
//                   { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder },
//                   isSelected && [
//                     styles.filterPillActive,
//                     { backgroundColor: isDark ? '#FFFFFF' : '#121212', borderColor: isDark ? '#FFFFFF' : '#000000' },
//                   ],
//                 ]}
//               >
//                 <Text
//                   style={[
//                     styles.filterPillText,
//                     {
//                       color: isSelected ? (isDark ? '#121212' : '#FFFFFF') : theme.textSecondary,
//                       fontFamily: typography.bodyBold,
//                     },
//                   ]}
//                 >
//                   {corp.companyName}
//                 </Text>
//               </TouchableOpacity>
//             );
//           })}
//         </ScrollView>
//
//         <Text style={[styles.subFilterLabel, { color: theme.textSecondary, marginTop: 10 }]}>FILTER BY CATEGORY:</Text>
//         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
//           <TouchableOpacity
//             onPress={() => setSelectedCategoryFilter('all')}
//             style={[
//               styles.filterPill,
//               { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder },
//               selectedCategoryFilter === 'all' && [
//                 styles.filterPillActive,
//                 { backgroundColor: isDark ? '#FFFFFF' : '#121212', borderColor: isDark ? '#FFFFFF' : '#000000' },
//               ],
//             ]}
//           >
//             <Text
//               style={[
//                 styles.filterPillText,
//                 {
//                   color: selectedCategoryFilter === 'all' ? (isDark ? '#121212' : '#FFFFFF') : theme.textSecondary,
//                   fontFamily: typography.bodyBold,
//                 },
//               ]}
//             >
//               All Categories
//             </Text>
//           </TouchableOpacity>
//
//           {categories.map((cat) => {
//             const isSelected = selectedCategoryFilter === cat.id;
//             return (
//               <TouchableOpacity
//                 key={cat.id}
//                 onPress={() => setSelectedCategoryFilter(cat.id)}
//                 style={[
//                   styles.filterPill,
//                   { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder },
//                   isSelected && [
//                     styles.filterPillActive,
//                     { backgroundColor: isDark ? '#FFFFFF' : '#121212', borderColor: isDark ? '#FFFFFF' : '#000000' },
//                   ],
//                 ]}
//               >
//                 <Text
//                   style={[
//                     styles.filterPillText,
//                     {
//                       color: isSelected ? (isDark ? '#121212' : '#FFFFFF') : theme.textSecondary,
//                       fontFamily: typography.bodyBold,
//                     },
//                   ]}
//                 >
//                   {cat.name}
//                 </Text>
//               </TouchableOpacity>
//             );
//           })}
//         </ScrollView>
//       </View>
//
//       <View style={styles.manifestHeaderRow}>
//         <Text style={[styles.sectionHeading, { color: theme.textSecondary, fontFamily: typography.bodyBold }]}>
//           CHEF&apos;S PRODUCTION SHEET • {filteredPrepItems.length} UNIQUE DISHES
//         </Text>
//       </View>
//
//       <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         {filteredPrepItems.length === 0 ? (
//           <View style={styles.emptyPrepBox}>
//             <Ionicons name="restaurant-outline" size={32} color={theme.textMuted} />
//             <Text style={[styles.emptyPrepText, { color: theme.textSecondary, fontFamily: typography.bodyBold }]}>
//               No prep orders match the current filter selection.
//             </Text>
//             {isAnyFilterActive && (
//               <TouchableOpacity onPress={handleClearFilters} style={styles.resetBtn}>
//                 <Text style={[styles.resetBtnText, { color: theme.textPrimary, fontFamily: typography.bodyBold }]}>
//                   Reset All Filters
//                 </Text>
//               </TouchableOpacity>
//             )}
//           </View>
//         ) : (
//           filteredPrepItems.map((item, idx) => (
//             <View key={item.dishId || idx}>
//               {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />}
//               <View style={styles.chefItemRow}>
//                 <View
//                   style={[
//                     styles.portionBox,
//                     {
//                       backgroundColor: isDark ? '#242426' : '#121212',
//                       borderColor: isDark ? '#3C3C42' : '#000000',
//                     },
//                   ]}
//                 >
//                   <Text
//                     style={[
//                       styles.portionNumber,
//                       { color: isDark ? '#F7F2E8' : '#FFFFFF', fontFamily: typography.heading },
//                     ]}
//                   >
//                     {item.totalQuantity}x
//                   </Text>
//                   <Text
//                     style={[
//                       styles.portionLabel,
//                       { color: isDark ? '#A1A1A6' : '#E0E0E0', fontFamily: typography.bodyBold },
//                     ]}
//                   >
//                     PORTIONS
//                   </Text>
//                 </View>
//
//                 <View style={styles.chefItemInfo}>
//                   <Text style={[styles.chefItemName, { color: theme.textPrimary, fontFamily: typography.bodyBold }]}>
//                     {item.dishName}
//                   </Text>
//                   <View style={styles.categoryPillRow}>
//                     <View style={[styles.catBadge, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}>
//                       <Text style={[styles.catBadgeText, { color: theme.textSecondary, fontFamily: typography.bodyBold }]}>
//                         {item.categoryName.toUpperCase()}
//                       </Text>
//                     </View>
//                   </View>
//
//                   {item.allergyNotesSummary && item.allergyNotesSummary.length > 0 && (
//                     <View style={styles.allergiesBox}>
//                       {item.allergyNotesSummary.map((note, nIdx) => (
//                         <View key={nIdx} style={[styles.allergyTag, { backgroundColor: '#FDECEC' }]}>
//                           <Ionicons name="warning" size={12} color="#C62828" />
//                           <Text style={[styles.allergyText, { color: '#C62828', fontFamily: typography.bodyBold }]}>
//                             ALLERGY / NOTE: {note}
//                           </Text>
//                         </View>
//                       ))}
//                     </View>
//                   )}
//                 </View>
//               </View>
//             </View>
//           ))
//         )}
//       </View>
//
//       <Text style={[styles.sectionHeading, { color: theme.textSecondary, fontFamily: typography.bodyBold, marginTop: 14 }]}>
//         PANTRY DROP LOGISTICS ({siteGroups.length} LOCATIONS)
//       </Text>
//
//       <View style={styles.sitesList}>
//         {siteGroups.map((site) => {
//           const isExpanded = !!expandedSites[site.id];
//           const isDelivered = site.status === 'delivered';
//           const isOut = site.status === 'out_for_delivery';
//
//           return (
//             <View
//               key={site.id}
//               style={[styles.siteCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
//             >
//               <TouchableOpacity
//                 activeOpacity={0.8}
//                 onPress={() => toggleSiteExpand(site.id)}
//                 style={styles.siteHeader}
//               >
//                 <View style={styles.siteHeaderLeft}>
//                   <Ionicons name="business" size={18} color={theme.textPrimary} />
//                   <View>
//                     <Text style={[styles.siteName, { color: theme.textPrimary, fontFamily: typography.bodyBold }]}>
//                       {site.companyName}
//                     </Text>
//                     <Text style={[styles.siteFloor, { color: theme.textSecondary }]}>
//                       {site.deliveryFloor} • {site.totalMeals} Meals ({site.recipients.length} orders)
//                     </Text>
//                   </View>
//                 </View>
//
//                 <Ionicons
//                   name={isExpanded ? 'chevron-up' : 'chevron-down'}
//                   size={18}
//                   color={theme.textSecondary}
//                 />
//               </TouchableOpacity>
//
//               <View style={[styles.siteStatusRow, { backgroundColor: theme.surfaceHighlight }]}>
//                 <View style={styles.statusPillWrapper}>
//                   <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Stage:</Text>
//                   <View
//                     style={[
//                       styles.statusPill,
//                       {
//                         backgroundColor: isDelivered
//                           ? theme.successSurface
//                           : isOut
//                           ? theme.goldWarningSurface
//                           : theme.surface,
//                         borderColor: theme.surfaceBorder,
//                         borderWidth: 0.5,
//                       },
//                     ]}
//                   >
//                     <Text
//                       style={[
//                         styles.statusPillText,
//                         {
//                           color: isDelivered
//                             ? theme.success
//                             : isOut
//                             ? theme.goldWarning
//                             : theme.textPrimary,
//                           fontFamily: typography.bodyBold,
//                         },
//                       ]}
//                     >
//                       {site.status.replace(/_/g, ' ').toUpperCase()}
//                     </Text>
//                   </View>
//                 </View>
//
//                 <TouchableOpacity
//                   activeOpacity={0.85}
//                   onPress={() => handleToggleBatchStatus(site.id, site.status)}
//                   style={[styles.advanceStatusBtn, { backgroundColor: isDark ? '#FFFFFF' : '#121212' }]}
//                 >
//                   <Text style={[styles.advanceStatusBtnText, { color: isDark ? '#121212' : '#FFFFFF', fontFamily: typography.bodyBold }]}>
//                     {isOut ? 'Mark Delivered ✔' : 'Set Out for Delivery →'}
//                   </Text>
//                 </TouchableOpacity>
//               </View>
//
//               {isExpanded && (
//                 <View style={styles.manifestBox}>
//                   <Text style={[styles.manifestHeading, { color: theme.textSecondary, fontFamily: typography.bodyBold }]}>
//                     INDIVIDUAL LABELED CONTAINERS:
//                   </Text>
//                   {site.recipients.map((rec, rIdx) => (
//                     <View key={rIdx} style={styles.recipientRow}>
//                       <View style={styles.recLeft}>
//                         <Text style={[styles.recName, { color: theme.textPrimary, fontFamily: typography.bodyBold }]}>
//                           {rec.clientName} ({rec.clientEmail})
//                         </Text>
//                         <Text style={[styles.recDish, { color: theme.textSecondary }]}>
//                           • {rec.mealsSummary}
//                         </Text>
//                         {rec.allergyNotes && (
//                           <Text style={[styles.recAllergy, { color: '#C62828', fontFamily: typography.bodyBold }]}>
//                             Note: {rec.allergyNotes}
//                           </Text>
//                         )}
//                       </View>
//                       <Text style={[styles.recOrderRef, { color: theme.textMuted }]}>
//                         {rec.orderNumber}
//                       </Text>
//                     </View>
//                   ))}
//                 </View>
//               )}
//             </View>
//           );
//         })}
//       </View>
//
//       <Modal visible={isPrintModalOpen} transparent animationType="slide" onRequestClose={() => setIsPrintModalOpen(false)}>
//         <View style={styles.modalOverlay}>
//           <BlurView
//             intensity={Platform.OS === 'ios' ? 60 : 95}
//             tint={isDark ? 'dark' : 'light'}
//             style={StyleSheet.absoluteFill}
//           />
//           <View
//             style={[
//               StyleSheet.absoluteFill,
//               { backgroundColor: isDark ? 'rgba(0,0,0,0.68)' : 'rgba(15,23,42,0.45)' },
//             ]}
//           />
//           <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
//             <View style={styles.modalHeader}>
//               <View>
//                 <Text style={[styles.modalTitle, { color: theme.textPrimary, fontFamily: typography.bodyBold }]}>
//                   1. COOK — What to Cook Manifest
//                 </Text>
//                 <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
//                   {activeDay.formattedDate} • Meals: {totalFilteredMealsCount} • Allergies: {allergyDispatchMeals.length}
//                 </Text>
//               </View>
//               <TouchableOpacity onPress={() => setIsPrintModalOpen(false)}>
//                 <Ionicons name="close" size={20} color={theme.textPrimary} />
//               </TouchableOpacity>
//             </View>
//
//             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
//               <View style={[styles.printSheetPaper, { backgroundColor: '#FFFFFF', borderColor: '#E0E0E0' }]}>
//                 <Text style={styles.printHeader}>your kitchen co. — 1. COOK — WHAT TO COOK</Text>
//                 <Text style={styles.printMeta}>
//                   Date: {activeDay.formattedDate} | Meals: {totalFilteredMealsCount} | Allergies: {allergyDispatchMeals.length}
//                 </Text>
//                 {selectedCompanyFilter !== 'all' && (
//                   <Text style={styles.printMeta}>Company Filter: {selectedCompanyFilter}</Text>
//                 )}
//
//                 {allergyDispatchMeals.length > 0 && (
//                   <View style={styles.printAllergyBox}>
//                     <View style={styles.printAllergyHeader}>
//                       <Text style={styles.printAllergyHeaderText}>
//                         !! ALLERGIES - COOK FIRST, SEAL &amp; LABEL SEPARATELY
//                       </Text>
//                     </View>
//                     {allergyDispatchMeals.map((a, i) => (
//                       <View key={i} style={styles.printAllergyRow}>
//                         <Text style={styles.printAllergyDish}>1x {a.meal}</Text>
//                         <Text style={styles.printAllergyMeta}>
//                           {a.notes} — {a.recipientName} ({a.company})
//                         </Text>
//                       </View>
//                     ))}
//                   </View>
//                 )}
//
//                 <View style={styles.printDivider} />
//
//                 <Text style={styles.printSectionTitle}>COOKING QUANTITIES BY DISH:</Text>
//                 {filteredPrepItems.map((item, idx) => (
//                   <View key={idx} style={styles.printItemRow}>
//                     <Text style={styles.printItemName}>• {item.dishName} ({item.categoryName})</Text>
//                     <Text style={styles.printItemQty}>QTY: {item.totalQuantity}</Text>
//                   </View>
//                 ))}
//
//                 <View style={styles.printDivider} />
//                 <Text style={styles.printMeta}>your kitchen co. · iwantykc@csggroup.co.za</Text>
//               </View>
//
//               <View style={{ gap: 8 }}>
//                 <TouchableOpacity
//                   activeOpacity={0.85}
//                   onPress={handlePrintConfirm}
//                   style={[styles.confirmPrintBtn, { backgroundColor: isDark ? '#FFFFFF' : '#121212' }]}
//                 >
//                   <Ionicons name="print" size={16} color={isDark ? '#121212' : '#FFFFFF'} />
//                   <Text style={[styles.confirmPrintBtnText, { color: isDark ? '#121212' : '#FFFFFF', fontFamily: typography.bodyBold }]}>
//                     Download 1 &amp; 2. Production &amp; Packing PDF
//                   </Text>
//                 </TouchableOpacity>
//
//                 <View style={{ flexDirection: 'row', gap: 8 }}>
//                   <TouchableOpacity
//                     activeOpacity={0.85}
//                     onPress={() => handleQuickDispatchExport('stickers')}
//                     style={[styles.secondaryPrintBtn, { borderColor: theme.surfaceBorder, backgroundColor: theme.surface }]}
//                   >
//                     <Ionicons name="pricetag-outline" size={15} color={theme.textPrimary} />
//                     <Text style={[styles.secondaryPrintBtnText, { color: theme.textPrimary }]}>
//                       5. Meal Stickers PDF
//                     </Text>
//                   </TouchableOpacity>
//
//                   <TouchableOpacity
//                     activeOpacity={0.85}
//                     onPress={() => handleQuickDispatchExport('workbook')}
//                     style={[styles.secondaryPrintBtn, { borderColor: theme.surfaceBorder, backgroundColor: theme.surface }]}
//                   >
//                     <Ionicons name="grid-outline" size={15} color={theme.textPrimary} />
//                     <Text style={[styles.secondaryPrintBtnText, { color: theme.textPrimary }]}>
//                       Daily Excel (.xlsx)
//                     </Text>
//                   </TouchableOpacity>
//                 </View>
//               </View>
//             </ScrollView>
//           </View>
//         </View>
//       </Modal>
//
//       <View style={styles.footerSpacing} />
//     </ScrollView>
//   );
// };
//
// const styles = StyleSheet.create({
//   scroll: {
//     paddingHorizontal: 16,
//     paddingTop: 12,
//     paddingBottom: 40,
//   },
//   dateSegment: {
//     flexDirection: 'row',
//     borderRadius: 14,
//     padding: 4,
//     borderWidth: 1,
//     marginBottom: 12,
//   },
//   dateTabBtn: {
//     flex: 1,
//     paddingVertical: 9,
//     paddingHorizontal: 4,
//     alignItems: 'center',
//     justifyContent: 'center',
//     borderRadius: 10,
//     borderWidth: 1,
//     borderColor: 'transparent',
//   },
//   dateTabBtnActive: {
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.15,
//     shadowRadius: 3,
//     elevation: 2,
//   },
//   dateTabText: {
//     fontSize: 11,
//     textAlign: 'center',
//   },
//   summaryCard: {
//     borderRadius: 16,
//     padding: 16,
//     borderWidth: 1,
//     marginBottom: 12,
//   },
//   summaryTopRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 14,
//   },
//   summaryLabel: {
//     fontSize: 10,
//     letterSpacing: 0.5,
//   },
//   summaryDate: {
//     fontSize: 17,
//     marginTop: 2,
//   },
//   printBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: 10,
//   },
//   printBtnText: {
//     fontSize: 12,
//   },
//   summaryMetricsRow: {
//     flexDirection: 'row',
//     gap: 10,
//   },
//   metricItem: {
//     flex: 1,
//     borderRadius: 12,
//     padding: 10,
//     alignItems: 'center',
//   },
//   metricNumber: {
//     fontSize: 22,
//   },
//   metricLabel: {
//     fontSize: 11,
//     marginTop: 2,
//   },
//   filterCard: {
//     borderRadius: 16,
//     padding: 14,
//     borderWidth: 1,
//     marginBottom: 14,
//   },
//   filterHeaderRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 10,
//   },
//   filterTitle: {
//     fontSize: 12,
//     letterSpacing: 0.5,
//   },
//   clearFilterBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 8,
//     paddingVertical: 2,
//   },
//   clearFilterText: {
//     fontSize: 11,
//   },
//   searchBox: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderRadius: 10,
//     borderWidth: 1,
//     paddingHorizontal: 10,
//     paddingVertical: 7,
//     gap: 8,
//     marginBottom: 10,
//   },
//   searchInput: {
//     flex: 1,
//     fontSize: 13,
//     padding: 0,
//   },
//   subFilterLabel: {
//     fontSize: 10,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//     marginBottom: 6,
//   },
//   filterPillsRow: {
//     gap: 6,
//     paddingBottom: 2,
//   },
//   filterPill: {
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderRadius: 8,
//     borderWidth: 1,
//   },
//   filterPillActive: {
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.15,
//     shadowRadius: 2,
//     elevation: 2,
//   },
//   filterPillText: {
//     fontSize: 11,
//   },
//   manifestHeaderRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 8,
//   },
//   sectionHeading: {
//     fontSize: 11,
//     letterSpacing: 0.5,
//     marginBottom: 8,
//   },
//   card: {
//     borderRadius: 16,
//     padding: 14,
//     borderWidth: 1,
//     marginBottom: 14,
//   },
//   emptyPrepBox: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 28,
//     gap: 8,
//   },
//   emptyPrepText: {
//     fontSize: 13,
//     textAlign: 'center',
//   },
//   resetBtn: {
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 8,
//     borderWidth: 1,
//     marginTop: 4,
//   },
//   resetBtnText: {
//     fontSize: 12,
//   },
//   chefItemRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingVertical: 10,
//     gap: 12,
//   },
//   portionBox: {
//     borderRadius: 12,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     alignItems: 'center',
//     justifyContent: 'center',
//     minWidth: 70,
//     borderWidth: 1,
//   },
//   portionNumber: {
//     fontSize: 22,
//     lineHeight: 24,
//   },
//   portionLabel: {
//     fontSize: 8,
//     letterSpacing: 0.5,
//     marginTop: 2,
//   },
//   chefItemInfo: {
//     flex: 1,
//   },
//   chefItemName: {
//     fontSize: 15,
//   },
//   categoryPillRow: {
//     flexDirection: 'row',
//     marginTop: 4,
//   },
//   catBadge: {
//     paddingHorizontal: 6,
//     paddingVertical: 2,
//     borderRadius: 6,
//     borderWidth: 0.5,
//   },
//   catBadgeText: {
//     fontSize: 9,
//     letterSpacing: 0.3,
//   },
//   allergiesBox: {
//     marginTop: 6,
//     gap: 4,
//   },
//   allergyTag: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 6,
//     paddingVertical: 3,
//     borderRadius: 6,
//     alignSelf: 'flex-start',
//   },
//   allergyText: {
//     fontSize: 10,
//   },
//   divider: {
//     height: 1,
//     marginVertical: 4,
//   },
//   sitesList: {
//     gap: 12,
//   },
//   siteCard: {
//     borderRadius: 16,
//     borderWidth: 1,
//     overflow: 'hidden',
//   },
//   siteHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     padding: 14,
//   },
//   siteHeaderLeft: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 10,
//     flex: 1,
//   },
//   siteName: {
//     fontSize: 14,
//   },
//   siteFloor: {
//     fontSize: 12,
//     marginTop: 2,
//   },
//   siteStatusRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingHorizontal: 14,
//     paddingVertical: 8,
//   },
//   statusPillWrapper: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//   },
//   statusLabel: {
//     fontSize: 11,
//   },
//   statusPill: {
//     paddingHorizontal: 6,
//     paddingVertical: 2,
//     borderRadius: 4,
//   },
//   statusPillText: {
//     fontSize: 10,
//   },
//   advanceStatusBtn: {
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderRadius: 8,
//   },
//   advanceStatusBtnText: {
//     fontSize: 11,
//   },
//   manifestBox: {
//     padding: 14,
//     gap: 8,
//     borderTopWidth: 1,
//     borderTopColor: 'rgba(0,0,0,0.06)',
//   },
//   manifestHeading: {
//     fontSize: 10,
//     letterSpacing: 0.5,
//   },
//   recipientRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'flex-start',
//     paddingVertical: 4,
//   },
//   recLeft: {
//     flex: 1,
//   },
//   recName: {
//     fontSize: 12,
//   },
//   recDish: {
//     fontSize: 11,
//     marginTop: 1,
//   },
//   recAllergy: {
//     fontSize: 10,
//     marginTop: 2,
//   },
//   recOrderRef: {
//     fontSize: 10,
//   },
//   footerSpacing: {
//     height: 30,
//   },
//   modalOverlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0, 0, 0, 0.75)',
//     justifyContent: 'center',
//     padding: 20,
//   },
//   modalCard: {
//     borderRadius: 20,
//     borderWidth: 1,
//     maxHeight: '85%',
//     padding: 18,
//   },
//   modalHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'flex-start',
//     marginBottom: 14,
//   },
//   modalTitle: {
//     fontSize: 16,
//   },
//   modalSub: {
//     fontSize: 12,
//     marginTop: 2,
//   },
//   modalScroll: {
//     paddingBottom: 10,
//   },
//   printSheetPaper: {
//     padding: 14,
//     borderRadius: 8,
//     borderWidth: 1,
//     marginBottom: 14,
//   },
//   printHeader: {
//     color: '#000000',
//     fontSize: 13,
//     fontWeight: '900',
//     textAlign: 'center',
//   },
//   printMeta: {
//     color: '#444444',
//     fontSize: 10,
//     textAlign: 'center',
//     marginTop: 2,
//   },
//   printAllergyBox: {
//     marginTop: 8,
//     borderRadius: 6,
//     overflow: 'hidden',
//     borderWidth: 1,
//     borderColor: '#C62828',
//     backgroundColor: '#FDECEC',
//   },
//   printAllergyHeader: {
//     backgroundColor: '#C62828',
//     paddingVertical: 4,
//     paddingHorizontal: 8,
//   },
//   printAllergyHeaderText: {
//     color: '#FFFFFF',
//     fontSize: 9,
//     fontWeight: '800',
//   },
//   printAllergyRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//   },
//   printAllergyDish: {
//     color: '#111111',
//     fontSize: 10,
//     fontWeight: '800',
//   },
//   printAllergyMeta: {
//     color: '#C62828',
//     fontSize: 9,
//     fontWeight: '700',
//   },
//   printDivider: {
//     height: 1,
//     backgroundColor: '#CCCCCC',
//     marginVertical: 8,
//   },
//   printSectionTitle: {
//     color: '#000000',
//     fontSize: 11,
//     fontWeight: '800',
//     marginBottom: 4,
//   },
//   printItemRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     paddingVertical: 2,
//   },
//   printItemName: {
//     color: '#222222',
//     fontSize: 11,
//     fontWeight: '600',
//   },
//   printItemQty: {
//     color: '#000000',
//     fontSize: 11,
//     fontWeight: '800',
//   },
//   confirmPrintBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//     borderRadius: 12,
//     paddingVertical: 12,
//   },
//   confirmPrintBtnText: {
//     fontSize: 13,
//   },
//   secondaryPrintBtn: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 6,
//     borderRadius: 10,
//     borderWidth: 1,
//     paddingVertical: 10,
//   },
//   secondaryPrintBtnText: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
// });
//

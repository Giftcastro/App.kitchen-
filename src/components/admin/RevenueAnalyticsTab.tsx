// DISABLED: no screen opens this file. Remove the "// " prefixes to restore it.
export {};

// import React, { useState, useMemo } from 'react';
// import {
//   View,
//   Text,
//   ScrollView,
//   TouchableOpacity,
//   TextInput,
//   StyleSheet,
//   Alert,
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { useTheme } from '../../theme/ThemeContext';
// import { generateWeekdayOptions, parseDateISO, formatDateISO } from '../../utils/sastTime';
// import { WHITELISTED_COMPANY_DOMAINS } from '../../data/mockData';
// import { DeliveryDateOption } from '../../types';
//
// type TimeframeOption = '7d' | '30d' | 'quarter' | 'ytd' | 'custom';
//
// export const RevenueAnalyticsTab: React.FC = () => {
//   const { theme, isDark } = useTheme();
//   const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>('7d');
//   const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all'); // 'all' or isoString
//   const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
//   const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
//   const [isPushingData, setIsPushingData] = useState<boolean>(false);
//
//   // Custom Date Range State
//   const [customStartDate, setCustomStartDate] = useState<string>('2026-08-10');
//   const [customEndDate, setCustomEndDate] = useState<string>('2026-08-28');
//
//   // Dynamic business days matching active timeframe
//   const availableWeekdays = useMemo(() => {
//     if (selectedTimeframe === '7d') {
//       return generateWeekdayOptions(undefined, 5);
//     }
//     if (selectedTimeframe === '30d') {
//       return generateWeekdayOptions(undefined, 22);
//     }
//     if (selectedTimeframe === 'quarter') {
//       return generateWeekdayOptions(undefined, 30);
//     }
//     if (selectedTimeframe === 'ytd') {
//       return generateWeekdayOptions(undefined, 40);
//     }
//     if (selectedTimeframe === 'custom') {
//       try {
//         const start = parseDateISO(customStartDate);
//         const end = parseDateISO(customEndDate);
//         if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
//           return generateWeekdayOptions(undefined, 10);
//         }
//         const days: DeliveryDateOption[] = [];
//         const curr = new Date(start);
//         while (curr <= end && days.length < 50) {
//           const dow = curr.getDay();
//           if (dow !== 0 && dow !== 6) {
//             const iso = formatDateISO(curr);
//             const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow];
//             const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][curr.getMonth()];
//             days.push({
//               dateString: iso,
//               dayName,
//               dayNumber: curr.getDate(),
//               monthName,
//               year: curr.getFullYear(),
//               fullFormattedDate: `${dayName}, ${curr.getDate()} ${monthName} ${curr.getFullYear()}`,
//               isAvailable: true,
//               isLocked: false,
//               isHoliday: false,
//               cutoffDeadlineFormatted: '',
//               noticeBannerText: '',
//             });
//           }
//           curr.setDate(curr.getDate() + 1);
//         }
//         return days.length > 0 ? days : generateWeekdayOptions(undefined, 10);
//       } catch {
//         return generateWeekdayOptions(undefined, 10);
//       }
//     }
//     return generateWeekdayOptions(undefined, 10);
//   }, [selectedTimeframe, customStartDate, customEndDate]);
//
//   const categoriesList = [
//     { id: 'all', name: 'All Categories' },
//     { id: 'cat_mains', name: 'Mains & Bowls' },
//     { id: 'cat_chefs_choice', name: "Chef's Choice" },
//     { id: 'cat_salads', name: 'Salads & Wraps' },
//     { id: 'cat_desserts', name: 'Desserts & Snacks' },
//     { id: 'cat_beverages', name: 'Beverages' },
//   ];
//
//   // Daily breakdown values for the chart & day-level inspection
//   const dailyBreakdown = useMemo(() => {
//     const maxBars = selectedTimeframe === '7d' ? 5 : selectedTimeframe === '30d' ? 22 : 30;
//     return availableWeekdays.slice(0, maxBars).map((day, idx) => {
//       // Deterministic realistic numbers per day
//       const baseRev = 7800 + (idx * 640) % 3100 + (day.dayName === 'Fri' ? 1500 : 0);
//       const meals = Math.round(baseRev / 85);
//       return {
//         isoString: day.dateString,
//         dayLabel: `${day.dayName} ${day.dayNumber}`,
//         fullDate: day.fullFormattedDate,
//         revenue: baseRev,
//         revenueFormatted: `R ${(baseRev / 1000).toFixed(1)}k`,
//         meals,
//         batchStatus: day.isLocked ? 'Dispatched' : 'Scheduled',
//       };
//     });
//   }, [availableWeekdays, selectedTimeframe]);
//
//   // Dynamic analytics metrics based on day, company, timeframe, and category
//   const analyticsData = useMemo(() => {
//     const isSingleDay = selectedDayFilter !== 'all';
//     const singleDayData = dailyBreakdown.find((d) => d.isoString === selectedDayFilter);
//
//     if (isSingleDay && singleDayData) {
//       const gross = singleDayData.revenue;
//       const vat = gross * (15 / 115);
//       const net = gross - vat;
//       return {
//         isSingleDay: true,
//         selectedDayLabel: singleDayData.fullDate,
//         grossRevenueFormatted: `R ${gross.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
//         vatFormatted: `R ${vat.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
//         netFormatted: `R ${net.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
//         totalMeals: singleDayData.meals.toString(),
//         avgMealsPerDay: singleDayData.meals,
//         growthPct: '+16.2%',
//         activeOrders: Math.round(singleDayData.meals * 0.85),
//       };
//     }
//
//     const multiplier =
//       selectedTimeframe === '7d'
//         ? 1
//         : selectedTimeframe === '30d'
//         ? 4.2
//         : selectedTimeframe === 'quarter'
//         ? 12.8
//         : selectedTimeframe === 'ytd'
//         ? 48.0
//         : Math.max(1, availableWeekdays.length / 5);
//
//     const companyMultiplier = selectedCompanyFilter === 'all' ? 1.0 : 0.65;
//     const catMultiplier = selectedCategoryFilter === 'all' ? 1.0 : 0.35;
//
//     const baseRev = 38400 * companyMultiplier * catMultiplier;
//     const grossRevenue = baseRev * multiplier;
//     const vat = grossRevenue * (15 / 115);
//     const net = grossRevenue - vat;
//     const baseMeals = 480 * companyMultiplier * catMultiplier;
//     const totalMeals = Math.floor(baseMeals * multiplier);
//
//     return {
//       isSingleDay: false,
//       selectedDayLabel: `Aggregate (${selectedTimeframe.toUpperCase()})`,
//       grossRevenueFormatted: `R ${grossRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
//       vatFormatted: `R ${vat.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
//       netFormatted: `R ${net.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
//       totalMeals: totalMeals.toLocaleString('en-ZA'),
//       avgMealsPerDay: Math.floor(totalMeals / (selectedTimeframe === '7d' ? 5 : 20)),
//       growthPct: selectedTimeframe === '7d' ? '+14.8%' : '+22.4%',
//       activeOrders: Math.round(totalMeals * 0.85),
//     };
//   }, [selectedDayFilter, dailyBreakdown, selectedTimeframe, selectedCompanyFilter, selectedCategoryFilter]);
//
//   const handlePushPowerBI = () => {
//     setIsPushingData(true);
//     setTimeout(() => {
//       setIsPushingData(false);
//       Alert.alert(
//         'Power BI DirectQuery Pipeline Sync',
//         `DirectQuery dataset updated successfully.\nPayload: ${analyticsData.totalMeals} rows pushed to dataset 'KitchenCo_Executive_Prod' in Microsoft Fabric tenant.`
//       );
//     }, 900);
//   };
//
//   const handleExportCSV = () => {
//     Alert.alert(
//       'CSV Master Export',
//       `Master CSV dataset exported with 3 sheets:\n1. Orders & 15% VAT Invoices\n2. Corporate Distance & Tier Manifests\n3. Chef Daily Batch Quantities`,
//       [{ text: 'Download CSV' }]
//     );
//   };
//
//   return (
//     <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
//       {/* 1. Timeframe Filter Toolbar */}
//       <View style={[styles.timeframeSegment, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         {[
//           { key: '7d', label: '7 Days' },
//           { key: '30d', label: '30 Days' },
//           { key: 'quarter', label: 'Quarter' },
//           { key: 'ytd', label: 'YTD' },
//           { key: 'custom', label: 'Custom' },
//         ].map((tf) => (
//           <TouchableOpacity
//             key={tf.key}
//             activeOpacity={0.8}
//             onPress={() => {
//               setSelectedTimeframe(tf.key as TimeframeOption);
//               setSelectedDayFilter('all');
//             }}
//             style={[
//               styles.timeframeBtn,
//               selectedTimeframe === tf.key && {
//                 backgroundColor:theme.primary,
//               },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.timeframeText,
//                 { color: theme.textSecondary },
//                 selectedTimeframe === tf.key && {
//                   color:theme.onPrimary,
//                   fontWeight: '800',
//                 },
//               ]}
//             >
//               {tf.label}
//             </Text>
//           </TouchableOpacity>
//         ))}
//       </View>
//
//       {/* Custom Date Range Selector */}
//       {selectedTimeframe === 'custom' && (
//         <View style={[styles.customRangeCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//           <Text style={[styles.customRangeTitle, { color: theme.textPrimary }]}>Custom Analytics Date Range</Text>
//           <View style={styles.customRangeInputsRow}>
//             <View style={styles.customDateInputWrapper}>
//               <Text style={[styles.customDateLabel, { color: theme.textSecondary }]}>Start Date</Text>
//               <TextInput
//                 style={[
//                   styles.customDateInput,
//                   { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary },
//                 ]}
//                 value={customStartDate}
//                 onChangeText={setCustomStartDate}
//                 placeholder="2026-08-10"
//                 placeholderTextColor={theme.textMuted}
//               />
//             </View>
//             <View style={styles.customDateInputWrapper}>
//               <Text style={[styles.customDateLabel, { color: theme.textSecondary }]}>End Date</Text>
//               <TextInput
//                 style={[
//                   styles.customDateInput,
//                   { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary },
//                 ]}
//                 value={customEndDate}
//                 onChangeText={setCustomEndDate}
//                 placeholder="2026-08-28"
//                 placeholderTextColor={theme.textMuted}
//               />
//             </View>
//           </View>
//           <View style={styles.customPresetsRow}>
//             <TouchableOpacity
//               activeOpacity={0.7}
//               onPress={() => {
//                 setCustomStartDate('2026-08-14');
//                 setCustomEndDate('2026-08-28');
//               }}
//               style={[styles.presetBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}
//             >
//               <Text style={[styles.presetBtnText, { color: theme.textPrimary }]}>Last 14 Days</Text>
//             </TouchableOpacity>
//             <TouchableOpacity
//               activeOpacity={0.7}
//               onPress={() => {
//                 setCustomStartDate('2026-07-01');
//                 setCustomEndDate('2026-08-28');
//               }}
//               style={[styles.presetBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}
//             >
//               <Text style={[styles.presetBtnText, { color: theme.textPrimary }]}>Last 60 Days</Text>
//             </TouchableOpacity>
//             <TouchableOpacity
//               activeOpacity={0.7}
//               onPress={() => {
//                 setCustomStartDate('2026-08-01');
//                 setCustomEndDate('2026-08-31');
//               }}
//               style={[styles.presetBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}
//             >
//               <Text style={[styles.presetBtnText, { color: theme.textPrimary }]}>Aug Full Month</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       )}
//
//       {/* 2. Interactive Delivery Day / Date Picker Filter */}
//       <View style={styles.sectionHeaderRow}>
//         <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
//           Filter By Delivery Day ({availableWeekdays.length} Days in Period)
//         </Text>
//         {selectedDayFilter !== 'all' && (
//           <TouchableOpacity
//             activeOpacity={0.7}
//             onPress={() => setSelectedDayFilter('all')}
//             hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
//           >
//             <Text style={[styles.resetFilterText, { color: theme.primary }]}>Reset to Aggregate</Text>
//           </TouchableOpacity>
//         )}
//       </View>
//
//       <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
//         {/* All Days Chip */}
//         <TouchableOpacity
//           activeOpacity={0.8}
//           onPress={() => setSelectedDayFilter('all')}
//           style={[
//             styles.filterChip,
//             { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
//             selectedDayFilter === 'all' && {
//               backgroundColor:theme.primary,
//               borderColor:theme.primary,
//             },
//           ]}
//         >
//           <Ionicons
//             name="layers-outline"
//             size={13}
//             color={selectedDayFilter === 'all' ? theme.onPrimary : theme.textSecondary}
//           />
//           <Text
//             style={[
//               styles.filterChipText,
//               { color: selectedDayFilter === 'all' ? theme.onPrimary : theme.textPrimary },
//               selectedDayFilter === 'all' && { fontWeight: '700' },
//             ]}
//           >
//             All Days ({availableWeekdays.length})
//           </Text>
//         </TouchableOpacity>
//
//         {/* Business Weekdays */}
//         {availableWeekdays.map((day) => {
//           const isSelected = selectedDayFilter === day.dateString;
//           const dayPadded = String(day.dayNumber).padStart(2, '0');
//
//           return (
//             <TouchableOpacity
//               key={day.dateString}
//               activeOpacity={0.8}
//               onPress={() => setSelectedDayFilter(day.dateString)}
//               style={[
//                 styles.filterChip,
//                 { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
//                 isSelected && {
//                   backgroundColor:theme.primary,
//                   borderColor:theme.primary,
//                 },
//               ]}
//             >
//               <Ionicons
//                 name="calendar-outline"
//                 size={12}
//                 color={isSelected ? theme.onPrimary : theme.textSecondary}
//               />
//               <Text
//                 style={[
//                   styles.filterChipText,
//                   { color: isSelected ? theme.onPrimary : theme.textPrimary },
//                   isSelected && { fontWeight: '700' },
//                 ]}
//               >
//                 {day.dayName}, {dayPadded} {day.monthName}
//               </Text>
//             </TouchableOpacity>
//           );
//         })}
//       </ScrollView>
//
//       {/* 3. Filter by Company Account */}
//       <View style={styles.sectionHeaderRow}>
//         <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Filter By Company</Text>
//       </View>
//       <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
//         <TouchableOpacity
//           activeOpacity={0.8}
//           onPress={() => setSelectedCompanyFilter('all')}
//           style={[
//             styles.filterChip,
//             { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
//             selectedCompanyFilter === 'all' && {
//               backgroundColor:theme.primary,
//               borderColor:theme.primary,
//             },
//           ]}
//         >
//           <Text
//             style={[
//               styles.filterChipText,
//               { color: selectedCompanyFilter === 'all' ? theme.onPrimary : theme.textPrimary },
//               selectedCompanyFilter === 'all' && { fontWeight: '700' },
//             ]}
//           >
//             All Companies
//           </Text>
//         </TouchableOpacity>
//
//         {WHITELISTED_COMPANY_DOMAINS.map((comp) => {
//           const isSelected = selectedCompanyFilter === comp.id;
//           return (
//             <TouchableOpacity
//               key={comp.id}
//               activeOpacity={0.8}
//               onPress={() => setSelectedCompanyFilter(comp.id)}
//               style={[
//                 styles.filterChip,
//                 { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
//                 isSelected && {
//                   backgroundColor:theme.primary,
//                   borderColor:theme.primary,
//                 },
//               ]}
//             >
//               <Ionicons
//                 name="business-outline"
//                 size={12}
//                 color={isSelected ? theme.onPrimary : theme.textSecondary}
//               />
//               <Text
//                 style={[
//                   styles.filterChipText,
//                   { color: isSelected ? theme.onPrimary : theme.textPrimary },
//                   isSelected && { fontWeight: '700' },
//                 ]}
//               >
//                 {comp.companyName}
//               </Text>
//             </TouchableOpacity>
//           );
//         })}
//       </ScrollView>
//
//       {/* 4. Active Scope Banner */}
//       <View style={[styles.scopeBanner, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}>
//         <Ionicons name="information-circle-outline" size={15} color={theme.primary} />
//         <Text style={[styles.scopeBannerText, { color: theme.textSecondary }]}>
//           Viewing:{' '}
//           <Text style={{ fontWeight: '700', color: theme.textPrimary }}>
//             {analyticsData.selectedDayLabel}
//           </Text>
//           {selectedCompanyFilter !== 'all' && ' • Filtered by Company'}
//         </Text>
//       </View>
//
//       {/* 5. Executive Financial KPI Cards */}
//       <View style={styles.metricsGrid}>
//         {/* Metric 1: Revenue */}
//         <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//           <View style={styles.metricHeader}>
//             <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>GROSS SALES</Text>
//             <Ionicons name="trending-up" size={16} color={theme.success} />
//           </View>
//           <Text style={[styles.metricValue, { color: theme.primary }]}>
//             {analyticsData.grossRevenueFormatted}
//           </Text>
//           <Text style={[styles.metricSub, { color: theme.success }]}>
//             {analyticsData.growthPct} vs prev period
//           </Text>
//         </View>
//
//         {/* Metric 2: Meals Delivered */}
//         <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//           <View style={styles.metricHeader}>
//             <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>MEALS DISPATCHED</Text>
//             <Ionicons name="restaurant" size={16} color={theme.primary} />
//           </View>
//           <Text style={[styles.metricValue, { color: theme.textPrimary }]}>
//             {analyticsData.totalMeals}
//           </Text>
//           <Text style={[styles.metricSub, { color: theme.textSecondary }]}>
//             {analyticsData.isSingleDay ? 'Batch 12:00 PM Drop' : `~${analyticsData.avgMealsPerDay} meals / day`}
//           </Text>
//         </View>
//
//         {/* Metric 3: VAT & Tax */}
//         <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//           <View style={styles.metricHeader}>
//             <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>15% VAT INVOICED</Text>
//             <Ionicons name="receipt-outline" size={16} color={theme.goldWarning} />
//           </View>
//           <Text style={[styles.metricValueSmall, { color: theme.textPrimary }]}>
//             {analyticsData.vatFormatted}
//           </Text>
//           <Text style={[styles.metricSub, { color: theme.textSecondary }]}>
//             Net: {analyticsData.netFormatted}
//           </Text>
//         </View>
//
//         {/* Metric 4: Total Orders */}
//         <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//           <View style={styles.metricHeader}>
//             <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>CLIENT ORDERS</Text>
//             <Ionicons name="bag-check-outline" size={16} color={theme.success} />
//           </View>
//           <Text style={[styles.metricValue, { color: theme.success }]}>
//             {analyticsData.activeOrders}
//           </Text>
//           <Text style={[styles.metricSub, { color: theme.textSecondary }]}>Zero-waste batch drops</Text>
//         </View>
//       </View>
//
//       {/* 6. Daily Batch Sales Chart (Tap to Filter) */}
//       <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         <View style={styles.cardHeaderRow}>
//           <View>
//             <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Daily Batch Sales (Tap Bar to Inspect)</Text>
//             <Text style={[styles.cardSub, { color: theme.textSecondary }]}>12:00 PM SAST Scheduled Drops</Text>
//           </View>
//           <Text style={[styles.cardTag, { color: theme.primary }]}>ZAR</Text>
//         </View>
//
//         {/* Interactive Bar Chart */}
//         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScrollContainer}>
//           {dailyBreakdown.map((bar) => {
//             const isSelected = selectedDayFilter === bar.isoString;
//             const maxRev = 12000;
//             const barHeightPct = Math.min(Math.round((bar.revenue / maxRev) * 100), 100);
//
//             return (
//               <TouchableOpacity
//                 key={bar.isoString}
//                 activeOpacity={0.8}
//                 onPress={() => setSelectedDayFilter(isSelected ? 'all' : bar.isoString)}
//                 style={styles.barCol}
//               >
//                 <Text style={[styles.barAmount, { color: isSelected ? theme.primary : theme.textSecondary }]}>
//                   {bar.revenueFormatted}
//                 </Text>
//                 <View style={[styles.barTrack, isSelected && { borderColor:theme.primary, borderWidth: 1.5 }]}>
//                   <View
//                     style={[
//                       styles.barFill,
//                       {
//                         height: `${barHeightPct}%`,
//                         backgroundColor: isSelected
//                           ? theme.primary
//                           : theme.primaryMuted,
//                       },
//                     ]}
//                   />
//                 </View>
//                 <Text style={[styles.barDay, { color: isSelected ? theme.primary : theme.textSecondary, fontWeight: isSelected ? '700' : '500' }]}>
//                   {bar.dayLabel}
//                 </Text>
//               </TouchableOpacity>
//             );
//           })}
//         </ScrollView>
//       </View>
//
//       {/* 7. Category Volume Breakdown */}
//       <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Category Sales Distribution</Text>
//         <View style={styles.distRows}>
//           <View style={styles.distRow}>
//             <Text style={[styles.distLabel, { color: theme.textPrimary }]}>Mains & Bowls</Text>
//             <View style={[styles.distBarTrack, { backgroundColor: theme.surfaceHighlight }]}>
//               <View style={[styles.distBarFill, { width: '42%', backgroundColor:theme.primary}]} />
//             </View>
//             <Text style={[styles.distValue, { color: theme.textPrimary }]}>42%</Text>
//           </View>
//
//           <View style={styles.distRow}>
//             <Text style={[styles.distLabel, { color: theme.textPrimary }]}>Chef's Choice Cycles</Text>
//             <View style={[styles.distBarTrack, { backgroundColor: theme.surfaceHighlight }]}>
//               <View style={[styles.distBarFill, { width: '31%', backgroundColor: theme.goldWarning }]} />
//             </View>
//             <Text style={[styles.distValue, { color: theme.textPrimary }]}>31%</Text>
//           </View>
//
//           <View style={styles.distRow}>
//             <Text style={[styles.distLabel, { color: theme.textPrimary }]}>Salads & Wraps</Text>
//             <View style={[styles.distBarTrack, { backgroundColor: theme.surfaceHighlight }]}>
//               <View style={[styles.distBarFill, { width: '16%', backgroundColor: theme.success }]} />
//             </View>
//             <Text style={[styles.distValue, { color: theme.textPrimary }]}>16%</Text>
//           </View>
//
//           <View style={styles.distRow}>
//             <Text style={[styles.distLabel, { color: theme.textPrimary }]}>Desserts & Beverages</Text>
//             <View style={[styles.distBarTrack, { backgroundColor: theme.surfaceHighlight }]}>
//               <View style={[styles.distBarFill, { width: '11%', backgroundColor: theme.primaryLight }]} />
//             </View>
//             <Text style={[styles.distValue, { color: theme.textPrimary }]}>11%</Text>
//           </View>
//         </View>
//       </View>
//
//       {/* 8. Power BI Direct Integration Hub */}
//       <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         <View style={styles.cardHeaderRow}>
//           <View style={styles.biHeaderLeft}>
//             <Ionicons name="bar-chart" size={18} color={theme.goldWarning} />
//             <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Power BI Direct Integration</Text>
//           </View>
//           <View style={[styles.statusPill, { backgroundColor: theme.successSurface }]}>
//             <Text style={[styles.statusPillText, { color: theme.success }]}>Online Sync</Text>
//           </View>
//         </View>
//
//         <Text style={[styles.biDesc, { color: theme.textSecondary }]}>
//           Realtime telemetry pipeline connected to Microsoft Azure Power BI service workspace `KitchenCo_Corp_BI`.
//         </Text>
//
//         <View style={styles.biActionsRow}>
//           <TouchableOpacity
//             activeOpacity={0.85}
//             onPress={handlePushPowerBI}
//             style={[styles.biPushBtn, { backgroundColor:theme.primary}]}
//             disabled={isPushingData}
//           >
//             <Ionicons name="cloud-upload" size={16} color={theme.onPrimary} />
//             <Text style={[styles.biPushBtnText, { color:theme.onPrimary}]}>
//               {isPushingData ? 'Syncing...' : 'Push to Power BI'}
//             </Text>
//           </TouchableOpacity>
//
//           <TouchableOpacity
//             activeOpacity={0.85}
//             onPress={handleExportCSV}
//             style={[styles.exportCsvBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder }]}
//           >
//             <Ionicons name="download-outline" size={16} color={theme.textPrimary} />
//             <Text style={[styles.exportCsvBtnText, { color: theme.textPrimary }]}>Export CSV</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     </ScrollView>
//   );
// };
//
// const styles = StyleSheet.create({
//   scroll: {
//     padding: 16,
//     paddingBottom: 40,
//   },
//   timeframeSegment: {
//     flexDirection: 'row',
//     borderRadius: 12,
//     borderWidth: 1,
//     padding: 4,
//     marginBottom: 16,
//   },
//   timeframeBtn: {
//     flex: 1,
//     paddingVertical: 8,
//     alignItems: 'center',
//     justifyContent: 'center',
//     borderRadius: 8,
//   },
//   timeframeText: {
//     fontSize: 12,
//     fontWeight: '600',
//   },
//   sectionHeaderRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     marginBottom: 8,
//     marginTop: 4,
//   },
//   sectionTitle: {
//     fontSize: 13,
//     fontWeight: '700',
//     letterSpacing: 0.1,
//   },
//   resetFilterText: {
//     fontSize: 12,
//     fontWeight: '600',
//   },
//   filterChipsRow: {
//     flexDirection: 'row',
//     gap: 8,
//     paddingBottom: 12,
//   },
//   filterChip: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//     paddingHorizontal: 12,
//     paddingVertical: 7,
//     borderRadius: 20,
//     borderWidth: 1,
//   },
//   filterChipText: {
//     fontSize: 12,
//     fontWeight: '500',
//   },
//   scopeBanner: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: 10,
//     borderWidth: 1,
//     marginBottom: 16,
//   },
//   scopeBannerText: {
//     fontSize: 12,
//   },
//   metricsGrid: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: 12,
//     marginBottom: 16,
//   },
//   metricCard: {
//     width: '48%',
//     padding: 14,
//     borderRadius: 14,
//     borderWidth: 1,
//   },
//   metricHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 6,
//   },
//   metricLabel: {
//     fontSize: 10,
//     fontWeight: '800',
//     letterSpacing: 0.5,
//   },
//   metricValue: {
//     fontSize: 18,
//     fontWeight: '800',
//     marginBottom: 4,
//   },
//   metricValueSmall: {
//     fontSize: 15,
//     fontWeight: '800',
//     marginBottom: 4,
//   },
//   metricSub: {
//     fontSize: 11,
//     fontWeight: '500',
//   },
//   card: {
//     padding: 16,
//     borderRadius: 16,
//     borderWidth: 1,
//     marginBottom: 16,
//   },
//   cardHeaderRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 16,
//   },
//   cardTitle: {
//     fontSize: 15,
//     fontWeight: '700',
//   },
//   cardSub: {
//     fontSize: 11,
//     marginTop: 2,
//   },
//   cardTag: {
//     fontSize: 11,
//     fontWeight: '800',
//   },
//   chartScrollContainer: {
//     flexDirection: 'row',
//     alignItems: 'flex-end',
//     minWidth: '100%',
//     gap: 12,
//     paddingHorizontal: 4,
//     height: 140,
//     paddingTop: 10,
//   },
//   chartContainer: {
//     flexDirection: 'row',
//     alignItems: 'flex-end',
//     justifyContent: 'space-between',
//     height: 140,
//     paddingTop: 10,
//   },
//   barCol: {
//     width: 50,
//     minWidth: 46,
//     alignItems: 'center',
//     height: '100%',
//   },
//   barAmount: {
//     fontSize: 10,
//     fontWeight: '600',
//     marginBottom: 4,
//   },
//   barTrack: {
//     flex: 1,
//     width: 18,
//     backgroundColor: 'rgba(150,150,150,0.1)',
//     borderRadius: 6,
//     justifyContent: 'flex-end',
//     overflow: 'hidden',
//   },
//   barFill: {
//     width: '100%',
//     borderRadius: 6,
//   },
//   barDay: {
//     fontSize: 10,
//     fontWeight: '500',
//     marginTop: 6,
//   },
//   customRangeCard: {
//     padding: 14,
//     borderRadius: 14,
//     borderWidth: 1,
//     marginBottom: 16,
//     gap: 10,
//   },
//   customRangeTitle: {
//     fontSize: 13,
//     fontWeight: '700',
//   },
//   customRangeInputsRow: {
//     flexDirection: 'row',
//     gap: 10,
//   },
//   customDateInputWrapper: {
//     flex: 1,
//   },
//   customDateLabel: {
//     fontSize: 11,
//     fontWeight: '600',
//     marginBottom: 4,
//   },
//   customDateInput: {
//     borderWidth: 1,
//     borderRadius: 8,
//     paddingHorizontal: 10,
//     paddingVertical: 8,
//     fontSize: 12,
//     fontWeight: '600',
//   },
//   customPresetsRow: {
//     flexDirection: 'row',
//     gap: 8,
//     flexWrap: 'wrap',
//     marginTop: 2,
//   },
//   presetBtn: {
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderRadius: 6,
//     borderWidth: 1,
//   },
//   presetBtnText: {
//     fontSize: 11,
//     fontWeight: '600',
//   },
//   distRows: {
//     gap: 12,
//   },
//   distRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//   },
//   distLabel: {
//     width: 130,
//     fontSize: 12.5,
//     fontWeight: '600',
//   },
//   distBarTrack: {
//     flex: 1,
//     height: 8,
//     borderRadius: 4,
//     marginHorizontal: 10,
//     overflow: 'hidden',
//   },
//   distBarFill: {
//     height: '100%',
//     borderRadius: 4,
//   },
//   distValue: {
//     width: 32,
//     fontSize: 12,
//     fontWeight: '700',
//     textAlign: 'right',
//   },
//   biHeaderLeft: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//   },
//   statusPill: {
//     paddingHorizontal: 8,
//     paddingVertical: 3,
//     borderRadius: 6,
//   },
//   statusPillText: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   biDesc: {
//     fontSize: 12.5,
//     lineHeight: 18,
//     marginBottom: 16,
//   },
//   biActionsRow: {
//     flexDirection: 'row',
//     gap: 10,
//   },
//   biPushBtn: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//     height: 44,
//     borderRadius: 10,
//   },
//   biPushBtnText: {
//     fontSize: 13,
//     fontWeight: '700',
//   },
//   exportCsvBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 6,
//     height: 44,
//     paddingHorizontal: 16,
//     borderRadius: 10,
//     borderWidth: 1,
//   },
//   exportCsvBtnText: {
//     fontSize: 13,
//     fontWeight: '600',
//   },
// });
//

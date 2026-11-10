// DISABLED: no screen opens this file. Remove the "// " prefixes to restore it.
export {};

// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   ScrollView,
//   TouchableOpacity,
//   StyleSheet,
//   Switch,
//   Alert,
//   Modal,
//   TextInput,
//   Platform,
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { BlurView } from 'expo-blur';
//
// import { useTheme } from '../../theme/ThemeContext';
// import { useCart } from '../../context/CartContext';
// import { EIGHT_WEEK_CYCLE_DATA } from '../../data/mockData';
// import { CycleDayPlan } from '../../types';
//
// export const CycleControlTab: React.FC = () => {
//   const { theme, isDark } = useTheme();
//   const {
//     cycleWeeks,
//     activeCycleWeekNumber,
//     isAdvanceCycleLocked,
//     setActiveCycleWeek,
//     toggleAdvanceCycleLock,
//     updateCycleDayPlan,
//   } = useCart();
//
//   // Selected Week for detail modal
//   const [selectedWeekDetail, setSelectedWeekDetail] = useState<number | null>(null);
//   const [selectedDayToEdit, setSelectedDayToEdit] = useState<CycleDayPlan | null>(null);
//
//   //Edit Day Plan form states
//   const [editMainMeal, setEditMainMeal] = useState<string>('');
//   const [editVegMeal, setEditVegMeal] = useState<string>('');
//   const [editHealthyMeal, setEditHealthyMeal] = useState<string>('');
//
//   const [editCurryMeal, setEditCurryMeal] = useState<string>('');
//   const [editSandwichMeal, setEditSandwichMeal] = useState<string>('');
//
//   const handleSetCycle = (weekNum: number) => {
//     Alert.alert(
//       'Set Active Cycle',
//       `Activate 'Week ${weekNum}' as the base live rotation for Chef's Choice advance menu?`,
//       [
//         { text: 'Cancel', style: 'cancel' },
//         {
//           text: 'Activate Cycle',
//           onPress: () => {
//             setActiveCycleWeek(weekNum);
//             setSelectedWeekDetail(null);
//           },
//         },
//       ]
//     );
//   };
//
//   const activeWeek = cycleWeeks.find((w) => w.weekNumber === activeCycleWeekNumber) || cycleWeeks[0];
//
//   const selectedWeekData = selectedWeekDetail
//     ? EIGHT_WEEK_CYCLE_DATA.find((w) => w.week === selectedWeekDetail)
//     : null;
//
//   const handleOpenDayEdit = (dayPlan: CycleDayPlan) => {
//     setSelectedDayToEdit(dayPlan);
//     setEditMainMeal(dayPlan.main_meal);
//     setEditVegMeal(dayPlan.vegetarian_meal);
//     setEditHealthyMeal(dayPlan.healthy_meal);
//     setEditCurryMeal(dayPlan.curry_of_the_day || '');
//     setEditSandwichMeal(dayPlan.gourmet_sandwich || '');
//   };
//
//   const handleSaveDayPlan = async () => {
//     if (!selectedWeekDetail || !selectedDayToEdit) return;
//
//     await updateCycleDayPlan(selectedWeekDetail, selectedDayToEdit.day, {
//       main_meal: editMainMeal.trim() || selectedDayToEdit.main_meal,
//       vegetarian_meal: editVegMeal.trim() || selectedDayToEdit.vegetarian_meal,
//       healthy_meal: editHealthyMeal.trim() || selectedDayToEdit.healthy_meal,
//       curry_of_the_day: editCurryMeal.trim() || selectedDayToEdit.curry_of_the_day,
//       gourmet_sandwich: editSandwichMeal.trim() || selectedDayToEdit.gourmet_sandwich,
//     });
//
//     setSelectedDayToEdit(null);
//     Alert.alert('Recipe Plan Saved', `${selectedDayToEdit.day} menu plan updated for Week ${selectedWeekDetail}.`);
//   };
//
//   return (
//     <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
//       {/* 1. Active Cycle Indicator Card */}
//       <View style={[styles.activeCard, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}>
//         <View style={styles.activeTop}>
//           <View style={[styles.badge, { backgroundColor: theme.primary }]}>
//             <Text style={styles.badgeText}>LIVE CYCLE</Text>
//           </View>
//           <Text style={[styles.activeDates, { color: theme.textSecondary }]}>
//             Dynamic Auto-Advance Engine Enabled
//           </Text>
//         </View>
//
//         <Text style={[styles.activeTitle, { color: theme.textPrimary }]}>
//           Currently Active Base: Week {activeWeek.weekNumber} of 8-Week Rotation
//         </Text>
//         <Text style={[styles.activeDesc, { color: theme.textSecondary }]}>
//           {activeWeek.title} — {activeWeek.description} ({activeWeek.mealCount} configured meals)
//         </Text>
//       </View>
//
//       {/* 2. Advance Ordering Lock Toggle */}
//       <View style={[styles.toggleCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         <View style={styles.toggleLeft}>
//           <Ionicons
//             name={isAdvanceCycleLocked ? 'lock-closed' : 'lock-open-outline'}
//             size={20}
//             color={isAdvanceCycleLocked ? theme.goldWarning : theme.primary}
//           />
//           <View style={styles.toggleTextContainer}>
//             <Text style={[styles.toggleTitle, { color: theme.textPrimary }]}>
//               Advance 2-Week Ordering Lock
//             </Text>
//             <Text style={[styles.toggleSubtitle, { color: theme.textSecondary }]}>
//               {isAdvanceCycleLocked
//                 ? 'Next week cycle is locked for admin chef review'
//                 : 'Users can browse and schedule lunches up to 14 weekdays out'}
//             </Text>
//           </View>
//         </View>
//
//         <Switch
//           value={!isAdvanceCycleLocked}
//           onValueChange={toggleAdvanceCycleLock}
//           trackColor={{ false: theme.surfaceBorder, true: theme.primary }}
//           thumbColor="#FFFFFF"
//         />
//       </View>
//
//       {/* 3. 8-Week Cycle Grid Selector */}
//       <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
//         8-WEEK ROTATING CHEF'S CHOICE CALENDAR
//       </Text>
//
//       <View style={styles.cycleGrid}>
//         {cycleWeeks.map((week) => {
//           const isActive = week.status === 'active_now';
//           const isNext = week.status === 'scheduled_next';
//
//           return (
//             <TouchableOpacity
//               key={week.weekNumber}
//               activeOpacity={0.8}
//               onPress={() => setSelectedWeekDetail(week.weekNumber)}
//               style={[
//                 styles.weekCard,
//                 { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
//                 isActive && { borderColor: theme.primary, backgroundColor: theme.primaryMuted },
//                 isNext && { borderColor: theme.goldWarning },
//               ]}
//             >
//               <View style={styles.weekHeaderRow}>
//                 <View style={styles.weekNumberBadge}>
//                   <Text style={[styles.weekNumberText, { color: theme.primary }]}>
//                     WEEK {week.weekNumber}
//                   </Text>
//                 </View>
//
//                 {isActive ? (
//                   <View style={[styles.statusTag, { backgroundColor: theme.successSurface }]}>
//                     <Text style={[styles.statusTagText, { color: theme.success }]}>Active Now</Text>
//                   </View>
//                 ) : isNext ? (
//                   <View style={[styles.statusTag, { backgroundColor: theme.goldWarningSurface }]}>
//                     <Text style={[styles.statusTagText, { color: theme.goldWarning }]}>Scheduled Next</Text>
//                   </View>
//                 ) : null}
//               </View>
//
//               <Text style={[styles.weekTitle, { color: theme.textPrimary }]}>{week.title}</Text>
//               <Text style={[styles.weekDesc, { color: theme.textSecondary }]} numberOfLines={2}>
//                 {week.description}
//               </Text>
//               <Text style={[styles.weekMeta, { color: theme.textMuted }]}>
//                 {week.mealCount} Recipes Configured • Tap to Inspect
//               </Text>
//
//               <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />
//
//               <View style={styles.weekActions}>
//                 {!isActive && (
//                   <TouchableOpacity
//                     activeOpacity={0.8}
//                     onPress={() => handleSetCycle(week.weekNumber)}
//                     style={[styles.setCycleBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
//                   >
//                     <Text style={[styles.setCycleBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
//                       Set as Live Cycle
//                     </Text>
//                   </TouchableOpacity>
//                 )}
//
//                 <TouchableOpacity
//                   onPress={() => setSelectedWeekDetail(week.weekNumber)}
//                   style={styles.editMealsBtn}
//                 >
//                   <Text style={[styles.editMealsBtnText, { color: theme.primary }]}>
//                     View & Edit Days →
//                   </Text>
//                 </TouchableOpacity>
//               </View>
//             </TouchableOpacity>
//           );
//         })}
//       </View>
//
//       {/* ========================================================================= */}
//       {/* MODAL: WEEK RECIPE DETAIL & DAILY PLANS                                   */}
//       {/* ========================================================================= */}
//       {selectedWeekDetail && selectedWeekData && (
//         <Modal
//           visible={!!selectedWeekDetail}
//           transparent
//           animationType="slide"
//           onRequestClose={() => setSelectedWeekDetail(null)}
//         >
//           <View style={styles.modalOverlay}>
//             <BlurView
//               intensity={Platform.OS === 'ios' ? 60 : 95}
//               tint={isDark ? 'dark' : 'light'}
//               style={StyleSheet.absoluteFill}
//             />
//             <View
//               style={[
//                 StyleSheet.absoluteFill,
//                 { backgroundColor: isDark ? 'rgba(0,0,0,0.68)' : 'rgba(15,23,42,0.45)' },
//               ]}
//             />
//             <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
//               <View style={styles.modalHeader}>
//                 <View style={styles.modalHeaderLeft}>
//                   <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
//                     Week {selectedWeekDetail}: {cycleWeeks.find((w) => w.weekNumber === selectedWeekDetail)?.title || 'Chef Specials'}
//                   </Text>
//                   <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
//                     5-Day Daily Recipe Matrix (Main, Veg, Healthy, Curry, Sandwich)
//                   </Text>
//                 </View>
//
//                 <TouchableOpacity
//                   onPress={() => setSelectedWeekDetail(null)}
//                   style={[styles.closeBtn, { backgroundColor: theme.surface }]}
//                 >
//                   <Ionicons name="close" size={20} color={theme.textPrimary} />
//                 </TouchableOpacity>
//               </View>
//
//               <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
//                 {selectedWeekData.days.map((dayPlan) => (
//                   <View
//                     key={dayPlan.day}
//                     style={[styles.dayCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
//                   >
//                     <View style={styles.dayHeader}>
//                       <Text style={[styles.dayTitle, { color: theme.textPrimary }]}>{dayPlan.day}</Text>
//                       <TouchableOpacity
//                         onPress={() => handleOpenDayEdit(dayPlan)}
//                         style={[styles.editDayBtn, { backgroundColor: theme.surfaceHighlight }]}
//                       >
//                         <Ionicons name="pencil" size={12} color={theme.primary} />
//                         <Text style={[styles.editDayBtnText, { color: theme.primary }]}>Edit Recipes</Text>
//                       </TouchableOpacity>
//                     </View>
//
//                     <View style={styles.dishEntry}>
//                       <Text style={[styles.dishType, { color: theme.primary }]}>Main Meal:</Text>
//                       <Text style={[styles.dishDesc, { color: theme.textPrimary }]}>{dayPlan.main_meal}</Text>
//                     </View>
//
//                     <View style={styles.dishEntry}>
//                       <Text style={[styles.dishType, { color: theme.success }]}>Vegetarian:</Text>
//                       <Text style={[styles.dishDesc, { color: theme.textPrimary }]}>{dayPlan.vegetarian_meal}</Text>
//                     </View>
//
//                     <View style={styles.dishEntry}>
//                       <Text style={[styles.dishType, { color: theme.goldWarning }]}>Health Meal:</Text>
//                       <Text style={[styles.dishDesc, { color: theme.textPrimary }]}>{dayPlan.healthy_meal}</Text>
//                     </View>
//
//                     {dayPlan.curry_of_the_day && (
//                       <View style={styles.dishEntry}>
//                         <Text style={[styles.dishType, { color: theme.textSecondary }]}>Curry of Day:</Text>
//                         <Text style={[styles.dishDesc, { color: theme.textPrimary }]}>{dayPlan.curry_of_the_day}</Text>
//                       </View>
//                     )}
//
//                     {dayPlan.gourmet_sandwich && (
//                       <View style={styles.dishEntry}>
//                         <Text style={[styles.dishType, { color: theme.textSecondary }]}>Sandwich:</Text>
//                         <Text style={[styles.dishDesc, { color: theme.textPrimary }]}>{dayPlan.gourmet_sandwich}</Text>
//                       </View>
//                     )}
//                   </View>
//                 ))}
//
//                 {activeCycleWeekNumber !== selectedWeekDetail && (
//                   <TouchableOpacity
//                     onPress={() => handleSetCycle(selectedWeekDetail)}
//                     style={[styles.activateModalBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
//                   >
//                     <Text style={[styles.activateModalBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
//                       Set Week {selectedWeekDetail} as Live Cycle
//                     </Text>
//                   </TouchableOpacity>
//                 )}
//               </ScrollView>
//             </View>
//           </View>
//         </Modal>
//       )}
//
//       {/* ========================================================================= */}
//       {/* NESTED MODAL: EDIT SPECIFIC DAY PLAN RECIPES                              */}
//       {/* ========================================================================= */}
//       {selectedDayToEdit && (
//         <Modal
//           visible={!!selectedDayToEdit}
//           transparent
//           animationType="fade"
//           onRequestClose={() => setSelectedDayToEdit(null)}
//         >
//           <View style={styles.modalOverlay}>
//             <BlurView
//               intensity={Platform.OS === 'ios' ? 60 : 95}
//               tint={isDark ? 'dark' : 'light'}
//               style={StyleSheet.absoluteFill}
//             />
//             <View
//               style={[
//                 StyleSheet.absoluteFill,
//                 { backgroundColor: isDark ? 'rgba(0,0,0,0.68)' : 'rgba(15,23,42,0.45)' },
//               ]}
//             />
//             <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight, maxHeight: '80%' }]}>
//               <View style={styles.modalHeader}>
//                 <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
//                   Edit {selectedDayToEdit.day} Recipes
//                 </Text>
//                 <TouchableOpacity onPress={() => setSelectedDayToEdit(null)}>
//                   <Ionicons name="close" size={20} color={theme.textPrimary} />
//                 </TouchableOpacity>
//               </View>
//
//               <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
//                 <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Main Meal Description</Text>
//                 <TextInput
//                   style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, color: theme.textPrimary }]}
//                   value={editMainMeal}
//                   onChangeText={setEditMainMeal}
//                   multiline
//                 />
//
//                 <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Vegetarian Meal Description</Text>
//                 <TextInput
//                   style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, color: theme.textPrimary }]}
//                   value={editVegMeal}
//                   onChangeText={setEditVegMeal}
//                   multiline
//                 />
//
//                 <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Health Meal Description</Text>
//                 <TextInput
//                   style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, color: theme.textPrimary }]}
//                   value={editHealthyMeal}
//                   onChangeText={setEditHealthyMeal}
//                   multiline
//                 />
//
//                 <TouchableOpacity
//                   activeOpacity={0.85}
//                   onPress={handleSaveDayPlan}
//                   style={[styles.activateModalBtn, { backgroundColor: theme.primary, marginTop: 16 }]}
//                 >
//                   <Text style={[styles.activateModalBtnText, { color: '#FFFFFF' }]}>
//                     Save Recipe Changes
//                   </Text>
//                 </TouchableOpacity>
//               </ScrollView>
//             </View>
//           </View>
//         </Modal>
//       )}
//
//       <View style={styles.footerSpacing} />
//     </ScrollView>
//   );
// };
//
// const styles = StyleSheet.create({
//   scroll: {
//     padding: 16,
//     paddingBottom: 40,
//     gap: 14,
//   },
//   activeCard: {
//     borderRadius: 18,
//     padding: 18,
//     borderWidth: 1.5,
//     gap: 8,
//   },
//   activeTop: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//   },
//   badge: {
//     paddingHorizontal: 8,
//     paddingVertical: 3,
//     borderRadius: 6,
//   },
//   badgeText: {
//     color: '#FFFFFF',
//     fontSize: 10,
//     fontWeight: '800',
//     letterSpacing: 0.5,
//   },
//   activeDates: {
//     fontSize: 12,
//     fontWeight: '600',
//   },
//   activeTitle: {
//     fontSize: 16,
//     fontWeight: '800',
//   },
//   activeDesc: {
//     fontSize: 13,
//     lineHeight: 18,
//   },
//   toggleCard: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     padding: 14,
//     borderRadius: 16,
//     borderWidth: 1,
//   },
//   toggleLeft: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 12,
//     flex: 1,
//     paddingRight: 10,
//   },
//   toggleTextContainer: {
//     flex: 1,
//   },
//   toggleTitle: {
//     fontSize: 14,
//     fontWeight: '700',
//   },
//   toggleSubtitle: {
//     fontSize: 12,
//     marginTop: 2,
//   },
//   sectionHeading: {
//     fontSize: 11,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//     marginHorizontal: 4,
//   },
//   cycleGrid: {
//     gap: 12,
//   },
//   weekCard: {
//     borderRadius: 16,
//     padding: 16,
//     borderWidth: 1,
//     gap: 6,
//   },
//   weekHeaderRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },
//   weekNumberBadge: {
//     paddingHorizontal: 6,
//     paddingVertical: 2,
//     borderRadius: 4,
//   },
//   weekNumberText: {
//     fontSize: 11,
//     fontWeight: '800',
//   },
//   statusTag: {
//     paddingHorizontal: 8,
//     paddingVertical: 2,
//     borderRadius: 6,
//   },
//   statusTagText: {
//     fontSize: 10,
//     fontWeight: '700',
//   },
//   weekTitle: {
//     fontSize: 15,
//     fontWeight: '800',
//   },
//   weekDesc: {
//     fontSize: 12,
//     lineHeight: 16,
//   },
//   weekMeta: {
//     fontSize: 11,
//     marginTop: 2,
//   },
//   divider: {
//     height: 1,
//     marginVertical: 6,
//   },
//   weekActions: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     gap: 8,
//   },
//   setCycleBtn: {
//     paddingHorizontal: 12,
//     paddingVertical: 7,
//     borderRadius: 8,
//   },
//   setCycleBtnText: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   editMealsBtn: {
//     paddingVertical: 4,
//   },
//   editMealsBtnText: {
//     fontSize: 12,
//     fontWeight: '600',
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
//   modalHeaderLeft: {
//     flex: 1,
//   },
//   modalTitle: {
//     fontSize: 16,
//     fontWeight: '800',
//   },
//   modalSubtitle: {
//     fontSize: 12,
//     marginTop: 2,
//   },
//   closeBtn: {
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   modalScroll: {
//     paddingBottom: 10,
//     gap: 10,
//   },
//   dayCard: {
//     borderRadius: 12,
//     borderWidth: 1,
//     padding: 12,
//     gap: 6,
//   },
//   dayHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 4,
//   },
//   dayTitle: {
//     fontSize: 14,
//     fontWeight: '800',
//   },
//   editDayBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 8,
//     paddingVertical: 3,
//     borderRadius: 6,
//   },
//   editDayBtnText: {
//     fontSize: 10,
//     fontWeight: '700',
//   },
//   dishEntry: {
//     gap: 2,
//   },
//   dishType: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   dishDesc: {
//     fontSize: 12,
//     lineHeight: 16,
//   },
//   activateModalBtn: {
//     borderRadius: 12,
//     paddingVertical: 12,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginTop: 8,
//   },
//   activateModalBtnText: {
//     fontSize: 13,
//     fontWeight: '700',
//   },
//   inputLabel: {
//     fontSize: 11,
//     fontWeight: '700',
//     marginTop: 6,
//   },
//   input: {
//     borderWidth: 1,
//     borderRadius: 8,
//     padding: 10,
//     fontSize: 12,
//     minHeight: 50,
//   },
// });
//

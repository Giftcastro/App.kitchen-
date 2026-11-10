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
//   Platform,
//   TouchableWithoutFeedback,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Ionicons } from '@expo/vector-icons';
// import { useTheme } from '../theme/ThemeContext';
// import { useAuth } from '../context/AuthContext';
// import { useCart } from '../context/CartContext';
// import { DeliveryProgressTracker } from '../components/DeliveryProgressTracker';
// import { OrderHistoryItem } from '../types';
// import { TaxInvoiceModal } from '../components/TaxInvoiceModal';
// import { DisputeModal } from '../components/DisputeModal';
// import { RatingBar } from '../components/RatingBar';
//
// interface DeliveryTrackerScreenProps {
//   onNavigateToMenu: () => void;
//   onNavigateToProfile?: () => void;
//   onNavigateToHistory?: () => void;
// }
//
// export const DeliveryTrackerScreen: React.FC<DeliveryTrackerScreenProps> = ({
//   onNavigateToMenu,
// }) => {
//   const { theme, isDark } = useTheme();
//   const { currentUser } = useAuth();
//   const { orderHistory, submitOrderRating, reportOrderNonDelivery } = useCart();
//
//   // Selected Order for the History & Invoice Detail Pop-up Modal
//   const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<OrderHistoryItem | null>(null);
//   const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<OrderHistoryItem | null>(null);
//   const [disputeOrder, setDisputeOrder] = useState<OrderHistoryItem | null>(null);
//
//   // Rating state in detail modal
//   const [tempRating, setTempRating] = useState<number>(5);
//   const [ratingFeedback, setRatingFeedback] = useState<string>('');
//
//   // Normalize today's date string YYYY-MM-DD
//   const todayStr = useMemo(() => {
//     return new Date().toISOString().split('T')[0];
//   }, []);
//
//   // Partition orders into: Today's Orders, Upcoming Future Orders, and Past Delivered Orders
//   const { todayOrders, upcomingOrders, pastOrders } = useMemo(() => {
//     const today: OrderHistoryItem[] = [];
//     const upcoming: OrderHistoryItem[] = [];
//     const past: OrderHistoryItem[] = [];
//
//     orderHistory.forEach((ord) => {
//       if (ord.targetDeliveryDate === todayStr && ord.status !== 'delivered') {
//         today.push(ord);
//       } else if (ord.targetDeliveryDate > todayStr && ord.status !== 'delivered') {
//         upcoming.push(ord);
//       } else {
//         past.push(ord);
//       }
//     });
//
//     return { todayOrders: today, upcomingOrders: upcoming, pastOrders: past };
//   }, [orderHistory, todayStr]);
//
//   // Primary active order for today's tracker (or latest active)
//   const activeTodayOrder: OrderHistoryItem | null =
//     todayOrders[0] || (orderHistory.length > 0 && orderHistory[0].status !== 'delivered' ? orderHistory[0] : null);
//
//   const currentStage = activeTodayOrder ? activeTodayOrder.stage : 2;
//
//   // Helper to check 30-day rating window eligibility
//   const isEligibleForRating = (orderDateStr: string) => {
//     try {
//       const orderDate = new Date(orderDateStr).getTime();
//       const now = new Date().getTime();
//       const diffDays = (now - orderDate) / (1000 * 60 * 60 * 24);
//       return diffDays <= 30;
//     } catch {
//       return true;
//     }
//   };
//
//   const handleOpenDetailModal = (order: OrderHistoryItem) => {
//     setSelectedHistoryOrder(order);
//     setTempRating(order.rating?.rating || 5);
//     setRatingFeedback(order.rating?.feedback || '');
//   };
//
//   const handleSubmitRating = async () => {
//     if (!selectedHistoryOrder) return;
//     await submitOrderRating(selectedHistoryOrder.id, tempRating, ratingFeedback);
//     Alert.alert('Thank You!', 'Your meal rating and feedback were shared with the Executive Head Chef.');
//     setSelectedHistoryOrder(null);
//   };
//
//   return (
//     <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
//       {/* 1. Header Bar */}
//       <View style={[styles.headerBar, { backgroundColor: theme.background, borderBottomColor: theme.surfaceBorder }]}>
//         <View>
//           <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Live Delivery Tracker</Text>
//           <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
//             Batch Drop strictly at 12:00 PM SAST
//           </Text>
//         </View>
//
//         <TouchableOpacity
//           onPress={onNavigateToMenu}
//           style={[styles.menuShortcutBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
//         >
//           <Ionicons name="restaurant" size={14} color={isDark ? '#000000' : '#FFFFFF'} />
//           <Text style={[styles.menuShortcutText, { color: isDark ? '#000000' : '#FFFFFF' }]}>+ Order</Text>
//         </TouchableOpacity>
//       </View>
//
//       <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
//         {/* ========================================================================= */}
//         {/* SECTION 1: TODAY'S DELIVERY STATUS & PENDING MEALS                        */}
//         {/* ========================================================================= */}
//         <View style={styles.sectionHeaderRow}>
//           <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Today's Delivery Progress</Text>
//           <View style={[styles.timePill, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}>
//             <Ionicons name="time-outline" size={12} color={theme.primary} />
//             <Text style={[styles.timePillText, { color: theme.primary }]}>12:00 PM SAST Drop</Text>
//           </View>
//         </View>
//
//         {activeTodayOrder ? (
//           <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//             {/* Order Reference Identifier */}
//             <View style={styles.refRow}>
//               <View style={styles.refLeft}>
//                 <Text style={[styles.refLabel, { color: theme.textSecondary }]}>ACTIVE ORDER</Text>
//                 <Text style={[styles.refNumber, { color: theme.textPrimary }]}>
//                   {activeTodayOrder.orderNumber}
//                 </Text>
//               </View>
//               <View style={styles.refRight}>
//                 <Text style={[styles.refTotal, { color: theme.primary }]}>
//                   R {activeTodayOrder.totalPaid.toFixed(2)}
//                 </Text>
//                 <View style={[styles.verifiedBadge, { backgroundColor: theme.successSurface }]}>
//                   <Ionicons name="shield-checkmark" size={11} color={theme.success} />
//                   <Text style={[styles.verifiedBadgeText, { color: theme.success }]}>Payment Verified</Text>
//                 </View>
//               </View>
//             </View>
//
//             {/* 4-Stage Progress Tracker (View Only) */}
//             <DeliveryProgressTracker
//               currentStage={currentStage}
//               deliveryDateFormatted={activeTodayOrder.deliveryDateFormatted}
//             />
//
//             {/* Scheduled Meals List for Today */}
//             <View style={[styles.todayMealsBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
//               <Text style={[styles.todayMealsHeading, { color: theme.textSecondary }]}>
//                 MEALS IN PRODUCTION ({activeTodayOrder.items.reduce((s, i) => s + i.quantity, 0)})
//               </Text>
//
//               {activeTodayOrder.items.map((item) => (
//                 <View key={item.id} style={styles.mealItemRow}>
//                   <View style={styles.mealItemLeft}>
//                     <View style={styles.mealTitleRow}>
//                       <Text style={[styles.mealName, { color: theme.textPrimary }]}>
//                         {item.quantity}x {item.menuItem.name}
//                       </Text>
//                       {item.size === 'large' && (
//                         <View style={[styles.largeBadge, { backgroundColor: theme.surfaceHighlight }]}>
//                           <Text style={[styles.largeBadgeText, { color: theme.textPrimary }]}>Large</Text>
//                         </View>
//                       )}
//                     </View>
//
//                     {item.selectedAddOns && item.selectedAddOns.length > 0 && (
//                       <Text style={[styles.addOnsText, { color: theme.textSecondary }]}>
//                         + {item.selectedAddOns.map((a) => a.name).join(', ')}
//                       </Text>
//                     )}
//
//                     {item.allergyNotes ? (
//                       <View style={[styles.allergyTag, { backgroundColor: theme.goldWarningSurface }]}>
//                         <Ionicons name="alert-circle" size={12} color={theme.goldWarning} />
//                         <Text style={[styles.allergyTagText, { color: theme.goldWarning }]}>
//                           Chef Note: {item.allergyNotes}
//                         </Text>
//                       </View>
//                     ) : null}
//                   </View>
//
//                   <Text style={[styles.mealPrice, { color: theme.textPrimary }]}>
//                     R {item.totalPrice.toFixed(2)}
//                   </Text>
//                 </View>
//               ))}
//             </View>
//
//             {/* Pantry Drop-off Instructions Banner */}
//             <View style={[styles.pantryBanner, { backgroundColor: theme.surfaceHighlight }]}>
//               <Ionicons name="location" size={16} color={theme.primary} />
//               <Text style={[styles.pantryBannerText, { color: theme.textSecondary }]}>
//                 Delivered to: <Text style={[styles.boldPantryText, { color: theme.textPrimary }]}>{currentUser?.deliveryFloor || 'Floor 3 (Reception Pantry)'}</Text>
//               </Text>
//             </View>
//           </View>
//         ) : (
//           <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//             <Ionicons name="calendar-outline" size={36} color={theme.textMuted} />
//             <Text style={[styles.emptyCardTitle, { color: theme.textPrimary }]}>
//               No meals scheduled for today
//             </Text>
//             <Text style={[styles.emptyCardSubtitle, { color: theme.textSecondary }]}>
//               Order before 9:00 AM SAST (48h advance) to schedule your lunch drops.
//             </Text>
//             <TouchableOpacity
//               onPress={onNavigateToMenu}
//               style={[styles.exploreBtn, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}
//             >
//               <Text style={[styles.exploreBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
//                 Browse Advance Menu
//               </Text>
//             </TouchableOpacity>
//           </View>
//         )}
//
//         {/* ========================================================================= */}
//         {/* SECTION 2: UPCOMING SCHEDULED DELIVERIES                                  */}
//         {/* ========================================================================= */}
//         {upcomingOrders.length > 0 && (
//           <View style={styles.sectionWrapper}>
//             <View style={styles.sectionHeaderRow}>
//               <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
//                 Upcoming Scheduled Deliveries ({upcomingOrders.length})
//               </Text>
//             </View>
//
//             {upcomingOrders.map((ord) => (
//               <TouchableOpacity
//                 key={ord.id}
//                 activeOpacity={0.8}
//                 onPress={() => handleOpenDetailModal(ord)}
//                 style={[styles.upcomingCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
//               >
//                 <View style={styles.upcomingTop}>
//                   <View style={[styles.dateChip, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}>
//                     <Ionicons name="calendar" size={13} color={theme.primary} />
//                     <Text style={[styles.dateChipText, { color: theme.primary }]}>
//                       {ord.deliveryDateFormatted}
//                     </Text>
//                   </View>
//
//                   <View style={[styles.statusTag, { backgroundColor: theme.surfaceHighlight }]}>
//                     <Text style={[styles.statusTagText, { color: theme.textSecondary }]}>Scheduled Drop</Text>
//                   </View>
//                 </View>
//
//                 <View style={styles.upcomingItems}>
//                   {ord.items.map((it) => (
//                     <Text key={it.id} style={[styles.upcomingItemText, { color: theme.textPrimary }]} numberOfLines={1}>
//                       • {it.quantity}x {it.menuItem.name} {it.size === 'large' ? '(Large)' : ''}
//                     </Text>
//                   ))}
//                 </View>
//
//                 <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />
//
//                 <View style={styles.upcomingBottom}>
//                   <Text style={[styles.upcomingTotal, { color: theme.primary }]}>
//                     Total Paid: R {ord.totalPaid.toFixed(2)}
//                   </Text>
//                   <Text style={[styles.viewDetailLink, { color: theme.textSecondary }]}>
//                     View Details →
//                   </Text>
//                 </View>
//               </TouchableOpacity>
//             ))}
//           </View>
//         )}
//
//         {/* ========================================================================= */}
//         {/* SECTION 3: FULL PAST ORDERS & TAX INVOICES                                */}
//         {/* ========================================================================= */}
//         <View style={styles.sectionWrapper}>
//           <View style={styles.sectionHeaderRow}>
//             <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
//               Order History & Invoices ({pastOrders.length})
//             </Text>
//           </View>
//
//           {pastOrders.length === 0 ? (
//             <View style={[styles.emptyHistoryBox, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//               <Ionicons name="receipt-outline" size={32} color={theme.textMuted} />
//               <Text style={[styles.emptyHistoryText, { color: theme.textSecondary }]}>
//                 No past deliveries recorded yet.
//               </Text>
//             </View>
//           ) : (
//             pastOrders.map((ord) => (
//               <TouchableOpacity
//                 key={ord.id}
//                 activeOpacity={0.8}
//                 onPress={() => handleOpenDetailModal(ord)}
//                 style={[styles.historyCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
//               >
//                 <View style={styles.historyTopRow}>
//                   <View>
//                     <Text style={[styles.historyOrderNumber, { color: theme.textPrimary }]}>
//                       {ord.orderNumber}
//                     </Text>
//                     <Text style={[styles.historyDate, { color: theme.textSecondary }]}>
//                       {ord.deliveryDateFormatted}
//                     </Text>
//                   </View>
//
//                   <View style={styles.historyPriceCol}>
//                     <Text style={[styles.historyPrice, { color: theme.primary }]}>
//                       R {ord.totalPaid.toFixed(2)}
//                     </Text>
//                     <View style={[styles.deliveredTag, { backgroundColor: theme.successSurface }]}>
//                       <Text style={[styles.deliveredTagText, { color: theme.success }]}>Delivered</Text>
//                     </View>
//                   </View>
//                 </View>
//
//                 <View style={styles.historyMealsSummary}>
//                   {ord.items.map((it) => (
//                     <Text key={it.id} style={[styles.historyMealLine, { color: theme.textSecondary }]} numberOfLines={1}>
//                       {it.quantity}x {it.menuItem.name} {it.size === 'large' ? '(Large)' : ''}
//                     </Text>
//                   ))}
//                 </View>
//
//                 {/* Rating Badge if rated */}
//                 {ord.rating && (
//                   <View style={styles.ratedRow}>
//                     <Ionicons name="star" size={13} color="#EAB308" />
//                     <Text style={[styles.ratedScore, { color: theme.textPrimary }]}>
//                       {ord.rating.rating}/5 Rated
//                     </Text>
//                   </View>
//                 )}
//               </TouchableOpacity>
//             ))
//           )}
//         </View>
//
//         <View style={styles.bottomSpacer} />
//       </ScrollView>
//
//       {/* ========================================================================= */}
//       {/* POP-UP MODAL: ORDER DETAILS, INVOICE & 30-DAY RATING                       */}
//       {/* ========================================================================= */}
//       {selectedHistoryOrder && (
//         <Modal
//           visible={!!selectedHistoryOrder}
//           transparent
//           animationType="fade"
//           onRequestClose={() => setSelectedHistoryOrder(null)}
//         >
//           <TouchableWithoutFeedback onPress={() => setSelectedHistoryOrder(null)}>
//             <View style={styles.modalOverlay}>
//               <TouchableWithoutFeedback>
//                 <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
//                   {/* Modal Header */}
//                   <View style={styles.modalHeader}>
//                     <View style={styles.modalHeaderLeft}>
//                       <Text style={[styles.modalOrderNumber, { color: theme.textPrimary }]}>
//                         {selectedHistoryOrder.orderNumber}
//                       </Text>
//                       <Text style={[styles.modalDateText, { color: theme.textSecondary }]}>
//                         {selectedHistoryOrder.deliveryDateFormatted} • 12:00 PM Drop
//                       </Text>
//                     </View>
//
//                     <TouchableOpacity
//                       onPress={() => setSelectedHistoryOrder(null)}
//                       style={[styles.modalCloseBtn, { backgroundColor: theme.surface }]}
//                     >
//                       <Ionicons name="close" size={20} color={theme.textPrimary} />
//                     </TouchableOpacity>
//                   </View>
//
//                   <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
//                     {/* Line Items Breakdown */}
//                     <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>ORDER ITEMS</Text>
//                     <View style={[styles.modalItemsBox, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//                       {selectedHistoryOrder.items.map((it) => (
//                         <View key={it.id} style={styles.modalItemRow}>
//                           <View style={styles.modalItemInfo}>
//                             <Text style={[styles.modalItemName, { color: theme.textPrimary }]}>
//                               {it.quantity}x {it.menuItem.name} {it.size === 'large' ? '(Large)' : ''}
//                             </Text>
//                             {it.selectedAddOns && it.selectedAddOns.length > 0 && (
//                               <Text style={[styles.modalAddOns, { color: theme.textSecondary }]}>
//                                 + {it.selectedAddOns.map((a) => a.name).join(', ')}
//                               </Text>
//                             )}
//                             {it.allergyNotes && (
//                               <Text style={[styles.modalNote, { color: theme.goldWarning }]}>
//                                 Note: {it.allergyNotes}
//                               </Text>
//                             )}
//                           </View>
//                           <Text style={[styles.modalItemPrice, { color: theme.textPrimary }]}>
//                             R {it.totalPrice.toFixed(2)}
//                           </Text>
//                         </View>
//                       ))}
//                     </View>
//
//                     {/* Financial Calculations */}
//                     <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>FINANCIAL SUMMARY</Text>
//                     <View style={[styles.financeCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//                       <View style={styles.financeRow}>
//                         <Text style={[styles.financeLabel, { color: theme.textSecondary }]}>Item Subtotal</Text>
//                         <Text style={[styles.financeValue, { color: theme.textPrimary }]}>
//                           R {selectedHistoryOrder.itemSubtotal.toFixed(2)}
//                         </Text>
//                       </View>
//
//                       <View style={styles.financeRow}>
//                         <Text style={[styles.financeLabel, { color: theme.textSecondary }]}>
//                           Corporate Delivery Fee (0-15km)
//                         </Text>
//                         <Text style={[styles.financeValue, { color: theme.textPrimary }]}>
//                           R {selectedHistoryOrder.deliveryFee.toFixed(2)}
//                         </Text>
//                       </View>
//
//                       {selectedHistoryOrder.discountZar && selectedHistoryOrder.discountZar > 0 ? (
//                         <View style={styles.financeRow}>
//                           <Text style={[styles.financeLabel, { color: theme.textPrimary }]}>Corporate Discount</Text>
//                           <Text style={[styles.financeValue, { color: theme.textPrimary, fontWeight: '700' }]}>
//                             -R {selectedHistoryOrder.discountZar.toFixed(2)}
//                           </Text>
//                         </View>
//                       ) : null}
//
//                       <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />
//
//                       <View style={styles.financeTotalRow}>
//                         <Text style={[styles.financeTotalLabel, { color: theme.textPrimary }]}>Total Paid (ZAR)</Text>
//                         <Text style={[styles.financeTotalValue, { color: theme.textPrimary }]}>
//                           R {selectedHistoryOrder.totalPaid.toFixed(2)}
//                         </Text>
//                       </View>
//                     </View>
//
//                     {/* Actions: Tax Invoice PDF Button */}
//                     <TouchableOpacity
//                       activeOpacity={0.85}
//                       onPress={() => {
//                         setSelectedInvoiceOrder(selectedHistoryOrder);
//                       }}
//                       style={[styles.invoiceBtn, { backgroundColor: isDark ? '#FFFFFF' : '#121212' }]}
//                     >
//                       <Ionicons name="document-text-outline" size={16} color={isDark ? '#121212' : '#FFFFFF'} />
//                       <Text style={[styles.invoiceBtnText, { color: isDark ? '#121212' : '#FFFFFF' }]}>
//                         View Tax Invoice (PDF)
//                       </Text>
//                     </TouchableOpacity>
//
//                     {/* Meal Rating & Feedback Section (Strictly restricted to Delivered status) */}
//                     <View style={[styles.ratingSection, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//                       <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>
//                         MEAL RATING & FEEDBACK
//                       </Text>
//
//                       {selectedHistoryOrder.status === 'delivered' ? (
//                         isEligibleForRating(selectedHistoryOrder.targetDeliveryDate) ? (
//                           <>
//                             <Text style={[styles.ratingPrompt, { color: theme.textPrimary }]}>
//                               How was your corporate meal?
//                             </Text>
//                             <RatingBar rating={tempRating} onRatingChange={setTempRating} />
//
//                             <TouchableOpacity
//                               activeOpacity={0.85}
//                               onPress={handleSubmitRating}
//                               style={[styles.submitRatingBtn, { backgroundColor: theme.primary }]}
//                             >
//                               <Text style={[styles.submitRatingBtnText, { color: theme.textInverse }]}>Submit Rating to Head Chef</Text>
//                             </TouchableOpacity>
//                           </>
//                         ) : (
//                           <View style={styles.ratingExpiredBox}>
//                             <Ionicons name="time-outline" size={16} color={theme.textMuted} />
//                             <Text style={[styles.ratingExpiredText, { color: theme.textMuted }]}>
//                               Rating window closed (Standard 30-day post-delivery policy).
//                             </Text>
//                           </View>
//                         )
//                       ) : (
//                         <View style={[styles.ratingExpiredBox, { backgroundColor: theme.surfaceHighlight, padding: 12, borderRadius: 10 }]}>
//                           <Ionicons name="lock-closed-outline" size={16} color={theme.textSecondary} />
//                           <Text style={[styles.ratingExpiredText, { color: theme.textSecondary }]}>
//                             Rating unlocks once your meal has been delivered (12:00 PM SAST drop).
//                           </Text>
//                         </View>
//                       )}
//                     </View>
//
//                     {/* Dispute Escalation */}
//                     <TouchableOpacity
//                       onPress={() => {
//                         setDisputeOrder(selectedHistoryOrder);
//                       }}
//                       style={styles.disputeBtn}
//                     >
//                       <Ionicons name="help-buoy-outline" size={14} color={theme.error} />
//                       <Text style={[styles.disputeBtnText, { color: theme.error }]}>
//                         Report Non-Delivery / Lodge Dispute Ticket
//                       </Text>
//                     </TouchableOpacity>
//                   </ScrollView>
//                 </View>
//               </TouchableWithoutFeedback>
//             </View>
//           </TouchableWithoutFeedback>
//         </Modal>
//       )}
//
//       {/* Tax Invoice PDF Modal */}
//       <TaxInvoiceModal
//         visible={!!selectedInvoiceOrder}
//         order={selectedInvoiceOrder}
//         onClose={() => setSelectedInvoiceOrder(null)}
//       />
//
//       {/* Dispute Modal */}
//       <DisputeModal
//         visible={!!disputeOrder}
//         order={disputeOrder}
//         userEmail={currentUser?.email || ''}
//         userName={currentUser?.fullName || 'Alex Vance'}
//         onClose={() => setDisputeOrder(null)}
//         onConfirmDispute={async (orderId: string, reason: string) => {
//           await reportOrderNonDelivery(orderId, reason);
//           setDisputeOrder(null);
//           setSelectedHistoryOrder(null);
//         }}
//       />
//     </SafeAreaView>
//   );
// };
//
// const styles = StyleSheet.create({
//   safeArea: {
//     flex: 1,
//   },
//   headerBar: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderBottomWidth: 1,
//   },
//   headerTitle: {
//     fontSize: 20,
//     fontWeight: '800',
//     letterSpacing: -0.3,
//   },
//   headerSubtitle: {
//     fontSize: 12,
//     fontWeight: '500',
//     marginTop: 2,
//   },
//   menuShortcutBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: 10,
//   },
//   menuShortcutText: {
//     fontSize: 12,
//     fontWeight: '700',
//   },
//   scrollContent: {
//     paddingHorizontal: 16,
//     paddingTop: 16,
//     paddingBottom: 100,
//   },
//   sectionHeaderRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 10,
//   },
//   sectionTitle: {
//     fontSize: 15,
//     fontWeight: '800',
//     letterSpacing: -0.2,
//   },
//   timePill: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 8,
//     paddingVertical: 3,
//     borderRadius: 6,
//     borderWidth: 1,
//   },
//   timePillText: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   card: {
//     borderRadius: 16,
//     borderWidth: 1,
//     padding: 16,
//     marginBottom: 20,
//   },
//   refRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'flex-start',
//     marginBottom: 14,
//   },
//   refLeft: {
//     flex: 1,
//   },
//   refLabel: {
//     fontSize: 10,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },
//   refNumber: {
//     fontSize: 16,
//     fontWeight: '800',
//     marginTop: 2,
//   },
//   refRight: {
//     alignItems: 'flex-end',
//     gap: 4,
//   },
//   refTotal: {
//     fontSize: 16,
//     fontWeight: '800',
//   },
//   verifiedBadge: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 3,
//     paddingHorizontal: 6,
//     paddingVertical: 2,
//     borderRadius: 4,
//   },
//   verifiedBadgeText: {
//     fontSize: 10,
//     fontWeight: '700',
//   },
//   todayMealsBox: {
//     borderRadius: 12,
//     borderWidth: 1,
//     padding: 12,
//     marginTop: 14,
//   },
//   todayMealsHeading: {
//     fontSize: 10,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//     marginBottom: 8,
//   },
//   mealItemRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'flex-start',
//     paddingVertical: 6,
//   },
//   mealItemLeft: {
//     flex: 1,
//     paddingRight: 10,
//   },
//   mealTitleRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     flexWrap: 'wrap',
//     gap: 6,
//   },
//   mealName: {
//     fontSize: 13,
//     fontWeight: '700',
//   },
//   largeBadge: {
//     paddingHorizontal: 5,
//     paddingVertical: 1,
//     borderRadius: 4,
//   },
//   largeBadgeText: {
//     fontSize: 9,
//     fontWeight: '800',
//   },
//   addOnsText: {
//     fontSize: 11,
//     fontWeight: '500',
//     marginTop: 2,
//   },
//   allergyTag: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 6,
//     paddingVertical: 2,
//     borderRadius: 4,
//     marginTop: 4,
//     alignSelf: 'flex-start',
//   },
//   allergyTagText: {
//     fontSize: 10,
//     fontWeight: '600',
//   },
//   mealPrice: {
//     fontSize: 13,
//     fontWeight: '700',
//   },
//   pantryBanner: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//     padding: 12,
//     borderRadius: 10,
//     marginTop: 12,
//   },
//   pantryBannerText: {
//     fontSize: 12,
//     flex: 1,
//   },
//   boldPantryText: {
//     fontWeight: '700',
//   },
//   emptyCard: {
//     borderRadius: 16,
//     borderWidth: 1,
//     padding: 24,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginBottom: 20,
//     gap: 8,
//   },
//   emptyCardTitle: {
//     fontSize: 15,
//     fontWeight: '700',
//     marginTop: 4,
//   },
//   emptyCardSubtitle: {
//     fontSize: 12,
//     textAlign: 'center',
//     marginBottom: 8,
//   },
//   exploreBtn: {
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     borderRadius: 10,
//   },
//   exploreBtnText: {
//     fontSize: 13,
//     fontWeight: '700',
//   },
//   sectionWrapper: {
//     marginBottom: 20,
//   },
//   upcomingCard: {
//     borderRadius: 14,
//     borderWidth: 1,
//     padding: 14,
//     marginBottom: 10,
//   },
//   upcomingTop: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 8,
//   },
//   dateChip: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 5,
//     paddingHorizontal: 8,
//     paddingVertical: 3,
//     borderRadius: 6,
//     borderWidth: 1,
//   },
//   dateChipText: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   statusTag: {
//     paddingHorizontal: 6,
//     paddingVertical: 2,
//     borderRadius: 4,
//   },
//   statusTagText: {
//     fontSize: 10,
//     fontWeight: '600',
//   },
//   upcomingItems: {
//     gap: 3,
//     marginVertical: 4,
//   },
//   upcomingItemText: {
//     fontSize: 13,
//     fontWeight: '600',
//   },
//   divider: {
//     height: 1,
//     marginVertical: 10,
//   },
//   upcomingBottom: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },
//   upcomingTotal: {
//     fontSize: 13,
//     fontWeight: '700',
//   },
//   viewDetailLink: {
//     fontSize: 12,
//     fontWeight: '600',
//   },
//   emptyHistoryBox: {
//     borderRadius: 14,
//     borderWidth: 1,
//     padding: 20,
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 6,
//   },
//   emptyHistoryText: {
//     fontSize: 13,
//   },
//   historyCard: {
//     borderRadius: 14,
//     borderWidth: 1,
//     padding: 14,
//     marginBottom: 10,
//   },
//   historyTopRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'flex-start',
//     marginBottom: 6,
//   },
//   historyOrderNumber: {
//     fontSize: 14,
//     fontWeight: '700',
//   },
//   historyDate: {
//     fontSize: 11,
//     marginTop: 2,
//   },
//   historyPriceCol: {
//     alignItems: 'flex-end',
//     gap: 4,
//   },
//   historyPrice: {
//     fontSize: 14,
//     fontWeight: '800',
//   },
//   deliveredTag: {
//     paddingHorizontal: 6,
//     paddingVertical: 2,
//     borderRadius: 4,
//   },
//   deliveredTagText: {
//     fontSize: 10,
//     fontWeight: '700',
//   },
//   historyMealsSummary: {
//     gap: 2,
//     marginTop: 4,
//   },
//   historyMealLine: {
//     fontSize: 12,
//   },
//   ratedRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     marginTop: 8,
//   },
//   ratedScore: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   bottomSpacer: {
//     height: 20,
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
//     maxHeight: '88%',
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
//   modalOrderNumber: {
//     fontSize: 17,
//     fontWeight: '800',
//   },
//   modalDateText: {
//     fontSize: 12,
//     marginTop: 2,
//   },
//   modalCloseBtn: {
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   modalScroll: {
//     paddingBottom: 10,
//   },
//   modalSectionTitle: {
//     fontSize: 11,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//     marginBottom: 6,
//   },
//   modalItemsBox: {
//     borderRadius: 12,
//     borderWidth: 1,
//     padding: 10,
//     marginBottom: 14,
//   },
//   modalItemRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'flex-start',
//     paddingVertical: 6,
//   },
//   modalItemInfo: {
//     flex: 1,
//     paddingRight: 10,
//   },
//   modalItemName: {
//     fontSize: 13,
//     fontWeight: '700',
//   },
//   modalAddOns: {
//     fontSize: 11,
//     marginTop: 1,
//   },
//   modalNote: {
//     fontSize: 11,
//     marginTop: 2,
//   },
//   modalItemPrice: {
//     fontSize: 13,
//     fontWeight: '700',
//   },
//   financeCard: {
//     borderRadius: 12,
//     borderWidth: 1,
//     padding: 12,
//     marginBottom: 14,
//   },
//   financeRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     paddingVertical: 3,
//   },
//   financeLabel: {
//     fontSize: 12,
//   },
//   financeValue: {
//     fontSize: 12,
//     fontWeight: '600',
//   },
//   financeTotalRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingTop: 2,
//   },
//   financeTotalLabel: {
//     fontSize: 14,
//     fontWeight: '800',
//   },
//   financeTotalValue: {
//     fontSize: 15,
//     fontWeight: '800',
//   },
//   invoiceBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//     paddingVertical: 13,
//     borderRadius: 12,
//     marginBottom: 14,
//   },
//   invoiceBtnText: {
//     fontSize: 13,
//     fontWeight: '700',
//   },
//   ratingSection: {
//     borderRadius: 12,
//     borderWidth: 1,
//     padding: 12,
//     marginBottom: 10,
//   },
//   ratingPrompt: {
//     fontSize: 13,
//     fontWeight: '600',
//     marginBottom: 8,
//   },
//   submitRatingBtn: {
//     borderRadius: 8,
//     paddingVertical: 10,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginTop: 10,
//   },
//   submitRatingBtnText: {
//     color: '#FFFFFF',
//     fontSize: 12,
//     fontWeight: '700',
//   },
//   ratingExpiredBox: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//     paddingVertical: 6,
//   },
//   ratingExpiredText: {
//     fontSize: 11,
//   },
//   disputeBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 6,
//     paddingVertical: 8,
//   },
//   disputeBtnText: {
//     fontSize: 12,
//     fontWeight: '600',
//   },
// });
//

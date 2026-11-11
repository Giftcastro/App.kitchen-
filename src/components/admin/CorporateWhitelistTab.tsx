// DISABLED: no screen opens this file. Remove the "// " prefixes to restore it.
export {};

// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   ScrollView,
//   TouchableOpacity,
//   TextInput,
//   Modal,
//   StyleSheet,
//   Alert,
//   Platform,
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { BlurView } from 'expo-blur';
// import { useTheme } from '../../theme/ThemeContext';
// import { useCart } from '../../context/CartContext';
// import { getDeliveryFeeForDistance } from '../../data/mockData';
// import { CorporateAccount } from '../../types';
//
// /**
//  *
//  * @constructor
//  */
//
// export const CorporateWhitelistTab: React.FC = () => {
//   const { theme, isDark } = useTheme();
//   const {
//     corporateAccounts,
//     addCorporateAccount,
//     updateCorporateAccountDistance,
//     updateCorporateAccountDiscount,
//     addDomainToAccount,
//   } = useCart();
//
//   // Modal states
//   const [isAddAccountOpen, setIsAddAccountOpen] = useState<boolean>(false);
//   const [isAddDomainOpen, setIsAddDomainOpen] = useState<boolean>(false);
//   const [isEditDistanceOpen, setIsEditDistanceOpen] = useState<boolean>(false);
//   const [isEditDiscountOpen, setIsEditDiscountOpen] = useState<boolean>(false);
//   const [selectedAccountId, setSelectedAccountId] = useState<string>('');
//
//   // Form states
//   const [companyName, setCompanyName] = useState<string>('');
//   const [primaryDomain, setPrimaryDomain] = useState<string>('');
//   const [deliveryLocation, setDeliveryLocation] = useState<string>('');
//   const [distanceKmInput, setDistanceKmInput] = useState<string>('8.0');
//   const [discountPercentageInput, setDiscountPercentageInput] = useState<string>('0');
//   const [newDomainSuffix, setNewDomainSuffix] = useState<string>('');
//   const [editDistanceValue, setEditDistanceValue] = useState<string>('8.0');
//   const [editDiscountType, setEditDiscountType] = useState<'percentage' | 'fixed_zar'>('percentage');
//   const [editDiscountValue, setEditDiscountValue] = useState<string>('0');
//
//   const handleCreateAccount = async () => {
//     if (!companyName.trim() || !primaryDomain.trim() || !distanceKmInput.trim()) {
//       Alert.alert('Missing Fields', 'Please provide company name, email domain, and distance.');
//       return;
//     }
//
//     const distNum = parseFloat(distanceKmInput);
//     if (isNaN(distNum) || distNum <= 0) {
//       Alert.alert('Invalid Distance', 'Please enter a valid distance in kilometers.');
//       return;
//     }
//
//     const discountNum = parseFloat(discountPercentageInput) || 0;
//     const cleanDomain = primaryDomain.replace(/^@/, '').trim().toLowerCase();
//     const loc = deliveryLocation.trim() || 'Corporate Campus Reception';
//
//     await addCorporateAccount(companyName.trim(), cleanDomain, [loc], distNum, 'percentage', discountNum);
//
//     setCompanyName('');
//     setPrimaryDomain('');
//     setDeliveryLocation('');
//     setDistanceKmInput('8.0');
//     setDiscountPercentageInput('0');
//     setIsAddAccountOpen(false);
//
//     Alert.alert(
//       'Corporate Partner Registered',
//       `${companyName} is registered (${distNum}km, R${getDeliveryFeeForDistance(distNum)} delivery fee tier, ${discountNum}% discount). Employees with @${cleanDomain} can now register.`
//     );
//   };
//
//   const handleAddDomain = async () => {
//     if (!newDomainSuffix.trim() || !selectedAccountId) {
//       Alert.alert('Missing Field', 'Please enter the domain extension.');
//       return;
//     }
//
//     const cleanDomain = newDomainSuffix.replace(/^@/, '').trim().toLowerCase();
//     await addDomainToAccount(selectedAccountId, cleanDomain);
//
//     setNewDomainSuffix('');
//     setIsAddDomainOpen(false);
//     Alert.alert('Domain Whitelisted', `@${cleanDomain} is now whitelisted for this corporate account.`);
//   };
//
//   const handleUpdateDistance = async () => {
//     const distNum = parseFloat(editDistanceValue);
//     if (isNaN(distNum) || distNum <= 0 || !selectedAccountId) {
//       Alert.alert('Invalid Distance', 'Please enter a valid positive distance in km.');
//       return;
//     }
//
//     await updateCorporateAccountDistance(selectedAccountId, distNum);
//     setIsEditDistanceOpen(false);
//     Alert.alert('Distance Updated', `Distance set to ${distNum} km. Delivery fee is now R${getDeliveryFeeForDistance(distNum).toFixed(2)}.`);
//   };
//
//   const handleOpenEditDiscount = (account: CorporateAccount) => {
//     setSelectedAccountId(account.id);
//     setEditDiscountType(account.discountType || 'percentage');
//     setEditDiscountValue(
//       account.discountValue !== undefined
//         ? String(account.discountValue)
//         : String(account.discountPercentage || 0)
//     );
//     setIsEditDiscountOpen(true);
//   };
//
//   const handleUpdateDiscount = async () => {
//     const val = parseFloat(editDiscountValue);
//     if (isNaN(val) || val < 0 || !selectedAccountId) {
//       Alert.alert('Invalid Value', 'Please enter a valid non-negative number.');
//       return;
//     }
//     if (editDiscountType === 'percentage' && val > 100) {
//       Alert.alert('Invalid Percentage', 'Percentage discount cannot exceed 100%.');
//       return;
//     }
//
//     await updateCorporateAccountDiscount(selectedAccountId, editDiscountType, val);
//     setIsEditDiscountOpen(false);
//     Alert.alert(
//       'Corporate Discount Updated',
//       `Corporate discount set to ${editDiscountType === 'percentage' ? `${val}%` : `R ${val.toFixed(2)}`}. Applied automatically to all employee orders.`
//     );
//   };
//
//   return (
//     <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
//       {/* Header & Add Button */}
//       <View style={styles.sectionHeaderRow}>
//         <View>
//           <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
//             Corporate Partner Accounts ({corporateAccounts.length})
//           </Text>
//           <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
//             Domain-gated corporate access, distance tiers & pantries
//           </Text>
//         </View>
//
//         <TouchableOpacity
//           activeOpacity={0.85}
//           onPress={() => setIsAddAccountOpen(true)}
//           style={[styles.addAccountBtn, { backgroundColor:theme.primary}]}
//         >
//           <Ionicons name="add" size={16} color={theme.onPrimary} />
//           <Text style={[styles.addAccountBtnText, { color:theme.onPrimary}]}>+ New Client</Text>
//         </TouchableOpacity>
//       </View>
//
//       {/* Corporate Accounts List */}
//       <View style={styles.accountsList}>
//         {corporateAccounts.map((account) => {
//           const dist = account.distanceKm !== undefined ? account.distanceKm : 8.0;
//           const fee = getDeliveryFeeForDistance(dist);
//
//           return (
//             <View
//               key={account.id}
//               style={[styles.accountCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//               {/* Top Row: Company Name & Active Users */}
//               <View style={styles.accountTopRow}>
//                 <View style={styles.companyTitleCol}>
//                   <View style={styles.companyNameRow}>
//                     <Ionicons name="business" size={18} color={theme.primary} />
//                     <Text style={[styles.companyNameText, { color: theme.textPrimary }]}>
//                       {account.companyName}
//                     </Text>
//                   </View>
//                   <Text style={[styles.createdText, { color: theme.textMuted }]}>
//                     Partner since {new Date(account.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
//                   </Text>
//                 </View>
//
//                 <View style={[styles.usersBadge, { backgroundColor: theme.primaryMuted }]}>
//                   <Text style={[styles.usersBadgeText, { color: theme.primary }]}>
//                     {account.activeUsersCount} Active Profiles
//                   </Text>
//                 </View>
//               </View>
//
//               {/* Distance & Delivery Fee Tier Box */}
//               <View style={[styles.tierBox, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorderLight }]}>
//                 <View style={styles.tierLeft}>
//                   <Ionicons name="navigate-circle" size={18} color={theme.primary} />
//                   <View>
//                     <Text style={[styles.tierTitle, { color: theme.textPrimary }]}>
//                       Distance: {dist.toFixed(1)} km from Central Kitchen
//                     </Text>
//                     <Text style={[styles.tierSub, { color: theme.textSecondary }]}>
//                       Delivery Tier Fee: <Text style={[styles.tierFeeBold, { color: theme.primary }]}>R {fee.toFixed(2)}</Text>
//                     </Text>
//                   </View>
//                 </View>
//
//                 <TouchableOpacity
//                   onPress={() => {
//                     setSelectedAccountId(account.id);
//                     setEditDistanceValue(dist.toString());
//                     setIsEditDistanceOpen(true);
//                   }}
//                   style={[styles.editDistBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
//                 >
//                   <Ionicons name="pencil" size={12} color={theme.textPrimary} />
//                   <Text style={[styles.editDistBtnText, { color: theme.textPrimary }]}>Edit km</Text>
//                 </TouchableOpacity>
//               </View>
//
//               {/* Corporate Discount Row */}
//               <View style={[styles.tierBox, { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorderLight, marginTop: 8 }]}>
//                 <View style={styles.tierLeft}>
//                   <Ionicons name="pricetag" size={18} color={theme.textPrimary} />
//                   <View>
//                     <Text style={[styles.tierTitle, { color: theme.textPrimary }]}>
//                       Corporate Discount: {account.discountType === 'fixed_zar'
//                         ? `R ${(account.discountValue || 0).toFixed(2)} Fixed OFF`
//                         : `${account.discountValue !== undefined ? account.discountValue : (account.discountPercentage || 0)}% OFF`}
//                     </Text>
//                     <Text style={[styles.tierSub, { color: theme.textSecondary }]}>
//                       Automatic subtotal reduction on employee orders
//                     </Text>
//                   </View>
//                 </View>
//
//                 <TouchableOpacity
//                   onPress={() => handleOpenEditDiscount(account)}
//                   style={[styles.editDistBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
//                 >
//                   <Ionicons name="pencil" size={12} color={theme.textPrimary} />
//                   <Text style={[styles.editDistBtnText, { color: theme.textPrimary }]}>Edit Discount</Text>
//                 </TouchableOpacity>
//               </View>
//
//
//
//               {/* Designated Delivery Locations */}
//               <View style={styles.locationsSection}>
//                 <Text style={[styles.blockLabel, { color: theme.textSecondary }]}>DESIGNATED PANTRY DROP-OFF POINTS:</Text>
//                 {account.locations.map((loc, idx) => (
//                   <View key={idx} style={styles.locationItemRow}>
//                     <Ionicons name="location-outline" size={14} color={theme.primary} />
//                     <Text style={[styles.locationItemText, { color: theme.textSecondary }]}>{loc}</Text>
//                   </View>
//                 ))}
//               </View>
//             </View>
//           );
//         })}
//       </View>
//
//       {/* ========================================================================= */}
//       {/* MODAL: ADD CORPORATE CLIENT (WITH DISTANCE KM)                            */}
//       {/* ========================================================================= */}
//       <Modal visible={isAddAccountOpen} transparent animationType="slide" onRequestClose={() => setIsAddAccountOpen(false)}>
//         <View style={styles.modalOverlay}>
//           <BlurView
//             intensity={Platform.OS === 'ios' ? 60 : 95}
//             tint={isDark ? 'dark' : 'light'}
//             style={StyleSheet.absoluteFill}
//           />
//           <View
//             style={[
//               StyleSheet.absoluteFill,
//               { backgroundColor:theme.overlay},
//             ]}
//           />
//           <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
//             <View style={styles.modalHeader}>
//               <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Add Corporate Partner</Text>
//               <TouchableOpacity onPress={() => setIsAddAccountOpen(false)}>
//                 <Ionicons name="close" size={20} color={theme.textPrimary} />
//               </TouchableOpacity>
//             </View>
//
//             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
//               <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Company Legal Name</Text>
//               <TextInput
//                 style={[styles.modalInput, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, color: theme.textPrimary }]}
//                 placeholder="e.g. Intellect Design Arena"
//                 placeholderTextColor={theme.textMuted}
//                 value={companyName}
//                 onChangeText={setCompanyName}
//               />
//
//               <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Primary Email Domain (@domain.com)</Text>
//               <TextInput
//                 style={[styles.modalInput, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, color: theme.textPrimary }]}
//                 placeholder="e.g. intellectdesign.com"
//                 placeholderTextColor={theme.textMuted}
//                 value={primaryDomain}
//                 onChangeText={setPrimaryDomain}
//                 autoCapitalize="none"
//               />
//
//               <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
//                 Distance from Kitchen (km) — Compulsory for Tiered Delivery Fee
//               </Text>
//               <TextInput
//                 style={[styles.modalInput, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, color: theme.textPrimary }]}
//                 placeholder="e.g. 8.0"
//                 placeholderTextColor={theme.textMuted}
//                 value={distanceKmInput}
//                 onChangeText={setDistanceKmInput}
//                 keyboardType="numeric"
//               />
//
//               {distanceKmInput && !isNaN(parseFloat(distanceKmInput)) && (
//                 <View style={[styles.feePreviewBox, { backgroundColor: theme.surfaceHighlight }]}>
//                   <Text style={[styles.feePreviewText, { color: theme.primary }]}>
//                     Calculated Delivery Fee: R {getDeliveryFeeForDistance(parseFloat(distanceKmInput)).toFixed(2)}
//                   </Text>
//                 </View>
//               )}
//
//               <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Corporate Building & Floor Location</Text>
//               <TextInput
//                 style={[styles.modalInput, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, color: theme.textPrimary }]}
//                 placeholder="e.g. 10 Katherine Street, Building 2, Floor 3"
//                 placeholderTextColor={theme.textMuted}
//                 value={deliveryLocation}
//                 onChangeText={setDeliveryLocation}
//               />
//
//               <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
//                 Corporate Discount (%) — Applied to Employee Orders
//               </Text>
//               <TextInput
//                 style={[styles.modalInput, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, color: theme.textPrimary }]}
//                 placeholder="e.g. 10 (or 0 for no discount)"
//                 placeholderTextColor={theme.textMuted}
//                 value={discountPercentageInput}
//                 onChangeText={setDiscountPercentageInput}
//                 keyboardType="numeric"
//               />
//
//               <TouchableOpacity
//                 activeOpacity={0.85}
//                 onPress={handleCreateAccount}
//                 style={[styles.saveBtn, { backgroundColor: theme.primary }]}
//               >
//                 <Text style={[styles.saveBtnText, { color: '#FFFFFF' }]}>
//                   Register Partner Account
//                 </Text>
//               </TouchableOpacity>
//             </ScrollView>
//           </View>
//         </View>
//       </Modal>
//
//       {/* ========================================================================= */}
//       {/* MODAL: EDIT CLIENT DISTANCE KM                                            */}
//       {/* ========================================================================= */}
//       <Modal visible={isEditDistanceOpen} transparent animationType="fade" onRequestClose={() => setIsEditDistanceOpen(false)}>
//         <View style={styles.modalOverlay}>
//           <BlurView
//             intensity={Platform.OS === 'ios' ? 60 : 95}
//             tint={isDark ? 'dark' : 'light'}
//             style={StyleSheet.absoluteFill}
//           />
//           <View
//             style={[
//               StyleSheet.absoluteFill,
//               { backgroundColor:theme.overlay},
//             ]}
//           />
//           <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight, maxHeight: '60%' }]}>
//             <View style={styles.modalHeader}>
//               <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Update Client Distance</Text>
//               <TouchableOpacity onPress={() => setIsEditDistanceOpen(false)}>
//                 <Ionicons name="close" size={20} color={theme.textPrimary} />
//               </TouchableOpacity>
//             </View>
//
//             <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Distance in Kilometers (km)</Text>
//             <TextInput
//               style={[styles.modalInput, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, color: theme.textPrimary }]}
//               value={editDistanceValue}
//               onChangeText={setEditDistanceValue}
//               keyboardType="numeric"
//             />
//
//             {editDistanceValue && !isNaN(parseFloat(editDistanceValue)) && (
//               <View style={[styles.feePreviewBox, { backgroundColor: theme.surfaceHighlight }]}>
//                 <Text style={[styles.feePreviewText, { color: theme.primary }]}>
//                   New Delivery Fee: R {getDeliveryFeeForDistance(parseFloat(editDistanceValue)).toFixed(2)}
//                 </Text>
//               </View>
//             )}
//
//             <TouchableOpacity
//               activeOpacity={0.85}
//               onPress={handleUpdateDistance}
//               style={[styles.saveBtn, { backgroundColor: theme.primary, marginTop: 12 }]}
//             >
//               <Text style={[styles.saveBtnText, { color: '#FFFFFF' }]}>
//                 Save Distance & Recalculate Fee
//               </Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//
//       {/* ========================================================================= */}
//       {/* MODAL: EDIT CORPORATE DISCOUNT (% OR FIXED RANDS)                          */}
//       {/* ========================================================================= */}
//       <Modal visible={isEditDiscountOpen} transparent animationType="fade" onRequestClose={() => setIsEditDiscountOpen(false)}>
//         <View style={styles.modalOverlay}>
//           <BlurView
//             intensity={Platform.OS === 'ios' ? 60 : 95}
//             tint={isDark ? 'dark' : 'light'}
//             style={StyleSheet.absoluteFill}
//           />
//           <View
//             style={[
//               StyleSheet.absoluteFill,
//               { backgroundColor:theme.overlay},
//             ]}
//           />
//           <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight, maxHeight: '65%' }]}>
//             <View style={styles.modalHeader}>
//               <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Set Corporate Discount</Text>
//               <TouchableOpacity onPress={() => setIsEditDiscountOpen(false)}>
//                 <Ionicons name="close" size={20} color={theme.textPrimary} />
//               </TouchableOpacity>
//             </View>
//
//             <Text style={[styles.editHelpText, { color: theme.textSecondary }]}>
//               Configure either a percentage discount or a fixed Rand amount deducted automatically on employee orders.
//             </Text>
//
//             {/* Discount Mode Selector (Dual Mode) */}
//             <View style={[styles.discountModeRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//               <TouchableOpacity
//                 activeOpacity={0.8}
//                 onPress={() => setEditDiscountType('percentage')}
//                 style={[
//                   styles.discountModeBtn,
//                   editDiscountType === 'percentage' && [
//                     styles.discountModeBtnActive,
//                     { backgroundColor:theme.primary},
//                   ],
//                 ]}
//               >
//                 <Text
//                   style={[
//                     styles.discountModeBtnText,
//                     { color: editDiscountType === 'percentage' ? theme.onPrimary : theme.textSecondary },
//                   ]}
//                 >
//                   Percentage (%)
//                 </Text>
//               </TouchableOpacity>
//
//               <TouchableOpacity
//                 activeOpacity={0.8}
//                 onPress={() => setEditDiscountType('fixed_zar')}
//                 style={[
//                   styles.discountModeBtn,
//                   editDiscountType === 'fixed_zar' && [
//                     styles.discountModeBtnActive,
//                     { backgroundColor:theme.primary},
//                   ],
//                 ]}
//               >
//                 <Text
//                   style={[
//                     styles.discountModeBtnText,
//                     { color: editDiscountType === 'fixed_zar' ? theme.onPrimary : theme.textSecondary },
//                   ]}
//                 >
//                   Fixed Rands (R)
//                 </Text>
//               </TouchableOpacity>
//             </View>
//
//             <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>
//               {editDiscountType === 'percentage'
//                 ? 'Discount Percentage (0 – 100%)'
//                 : 'Fixed Rand Discount (e.g. 25 for R25.00 OFF)'}
//             </Text>
//             <TextInput
//               style={[styles.modalInput, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, color: theme.textPrimary }]}
//               placeholder={editDiscountType === 'percentage' ? 'e.g. 10' : 'e.g. 25.00'}
//               placeholderTextColor={theme.textMuted}
//               value={editDiscountValue}
//               onChangeText={setEditDiscountValue}
//               keyboardType="numeric"
//             />
//
//             <TouchableOpacity
//               activeOpacity={0.85}
//               onPress={handleUpdateDiscount}
//               style={[styles.saveBtn, { backgroundColor:theme.primary, marginTop: 16 }]}
//             >
//               <Text style={[styles.saveBtnText, { color:theme.onPrimary}]}>
//                 Save Corporate Discount
//               </Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//
//       {/* ========================================================================= */}
//       {/* MODAL: ADD DOMAIN SUFFIX                                                  */}
//       {/* ========================================================================= */}
//       <Modal visible={isAddDomainOpen} transparent animationType="fade" onRequestClose={() => setIsAddDomainOpen(false)}>
//         <View style={styles.modalOverlay}>
//           <BlurView
//             intensity={Platform.OS === 'ios' ? 60 : 95}
//             tint={isDark ? 'dark' : 'light'}
//             style={StyleSheet.absoluteFill}
//           />
//           <View
//             style={[
//               StyleSheet.absoluteFill,
//               { backgroundColor:theme.overlay},
//             ]}
//           />
//           <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight, maxHeight: '50%' }]}>
//             <View style={styles.modalHeader}>
//               <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Whitelist New Domain</Text>
//               <TouchableOpacity onPress={() => setIsAddDomainOpen(false)}>
//                 <Ionicons name="close" size={20} color={theme.textPrimary} />
//               </TouchableOpacity>
//             </View>
//
//             <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Domain Suffix</Text>
//             <TextInput
//               style={[styles.modalInput, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, color: theme.textPrimary }]}
//               placeholder="e.g. intellectdesign.co.za"
//               placeholderTextColor={theme.textMuted}
//               value={newDomainSuffix}
//               onChangeText={setNewDomainSuffix}
//               autoCapitalize="none"
//             />
//
//             <TouchableOpacity
//               activeOpacity={0.85}
//               onPress={handleAddDomain}
//               style={[styles.saveBtn, { backgroundColor: theme.primary, marginTop: 12 }]}
//             >
//               <Text style={[styles.saveBtnText, { color: '#FFFFFF' }]}>
//                 Add Domain Suffix
//               </Text>
//             </TouchableOpacity>
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
//     padding: 16,
//     paddingBottom: 40,
//     gap: 14,
//   },
//   sectionHeaderRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },
//   sectionTitle: {
//     fontSize: 16,
//     fontWeight: '800',
//   },
//   sectionSub: {
//     fontSize: 12,
//     marginTop: 2,
//   },
//   addAccountBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: 10,
//   },
//   addAccountBtnText: {
//     fontSize: 12,
//     fontWeight: '700',
//   },
//   accountsList: {
//     gap: 14,
//   },
//   accountCard: {
//     borderRadius: 18,
//     borderWidth: 1,
//     padding: 16,
//     gap: 12,
//   },
//   accountTopRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'flex-start',
//   },
//   companyTitleCol: {
//     flex: 1,
//   },
//   companyNameRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//   },
//   companyNameText: {
//     fontSize: 16,
//     fontWeight: '800',
//   },
//   createdText: {
//     fontSize: 11,
//     marginTop: 2,
//   },
//   usersBadge: {
//     paddingHorizontal: 8,
//     paddingVertical: 3,
//     borderRadius: 6,
//   },
//   usersBadgeText: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   tierBox: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     padding: 10,
//     borderRadius: 10,
//     borderWidth: 1,
//   },
//   tierLeft: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//     flex: 1,
//   },
//   tierTitle: {
//     fontSize: 12,
//     fontWeight: '700',
//   },
//   tierSub: {
//     fontSize: 11,
//     marginTop: 1,
//   },
//   tierFeeBold: {
//     fontWeight: '800',
//   },
//   editDistBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//     borderRadius: 6,
//     borderWidth: 1,
//   },
//   editDistBtnText: {
//     fontSize: 11,
//     fontWeight: '600',
//   },
//   domainSection: {
//     gap: 6,
//   },
//   blockLabel: {
//     fontSize: 10,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },
//   domainsRow: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: 6,
//   },
//   domainPill: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//     borderRadius: 6,
//     borderWidth: 1,
//   },
//   domainText: {
//     fontSize: 12,
//     fontWeight: '600',
//   },
//   addDomainBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 2,
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//     borderRadius: 6,
//     borderWidth: 1,
//     borderStyle: 'dashed',
//   },
//   addDomainBtnText: {
//     fontSize: 11,
//     fontWeight: '600',
//   },
//   divider: {
//     height: 1,
//   },
//   locationsSection: {
//     gap: 4,
//   },
//   locationItemRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//     paddingVertical: 2,
//   },
//   locationItemText: {
//     fontSize: 12,
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
//     alignItems: 'center',
//     marginBottom: 14,
//   },
//   modalTitle: {
//     fontSize: 16,
//     fontWeight: '800',
//   },
//   modalScroll: {
//     paddingBottom: 10,
//   },
//   inputLabel: {
//     fontSize: 11,
//     fontWeight: '700',
//     marginTop: 10,
//     marginBottom: 4,
//   },
//   modalInput: {
//     borderWidth: 1,
//     borderRadius: 10,
//     padding: 10,
//     fontSize: 13,
//   },
//   feePreviewBox: {
//     padding: 8,
//     borderRadius: 6,
//     marginTop: 6,
//   },
//   feePreviewText: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   saveBtn: {
//     borderRadius: 12,
//     paddingVertical: 12,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginTop: 18,
//   },
//   saveBtnText: {
//     fontSize: 13,
//     fontWeight: '700',
//   },
//   editHelpText: {
//     fontSize: 12,
//     lineHeight: 17,
//     marginBottom: 8,
//   },
//   discountModeRow: {
//     flexDirection: 'row',
//     borderRadius: 10,
//     borderWidth: 1,
//     padding: 3,
//     marginTop: 6,
//   },
//   discountModeBtn: {
//     flex: 1,
//     paddingVertical: 8,
//     alignItems: 'center',
//     justifyContent: 'center',
//     borderRadius: 8,
//   },
//   discountModeBtnActive: {
//     elevation: 2,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.15,
//     shadowRadius: 2,
//   },
//   discountModeBtnText: {
//     fontSize: 12,
//     fontWeight: '700',
//   },
// });
//

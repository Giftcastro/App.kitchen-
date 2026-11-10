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
//   Platform,
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { useTheme } from '../../theme/ThemeContext';
// import { WHITELISTED_COMPANY_DOMAINS, DROPOFF_FLOORS } from '../../data/mockData';
// import { generateWeekdayOptions } from '../../utils/sastTime';
//
// type AudienceType = 'all' | 'company' | 'location';
// type NoticeCategory = 'cutoff' | 'dispatch' | 'menu' | 'holiday' | 'account';
//
// interface BroadcastRecord {
//   id: string;
//   timestamp: string;
//   title: string;
//   message: string;
//   audience: string;
//   channels: string[];
//   category: NoticeCategory;
//   recipientCount: number;
// }
//
// export const BroadcastNotificationsTab: React.FC = () => {
//   const { theme, isDark } = useTheme();
//
//   // Form states
//   const [audienceType, setAudienceType] = useState<AudienceType>('all');
//   const [selectedCompanyId, setSelectedCompanyId] = useState<string>(WHITELISTED_COMPANY_DOMAINS[0]?.id || '');
//   const [selectedLocation, setSelectedLocation] = useState<string>(DROPOFF_FLOORS[0]?.label || '');
//   const [selectedCategory, setSelectedCategory] = useState<NoticeCategory>('cutoff');
//   const [noticeTitle, setNoticeTitle] = useState<string>('Cutoff Extension Notice');
//   const [noticeMessage, setNoticeMessage] = useState<string>(
//     'Orders for today have been extended until 10:30 AM SAST due to extra kitchen prep capacity. Please complete your selection soon.'
//   );
//
//   // Channels state
//   const [channelInApp, setChannelInApp] = useState<boolean>(true);
//   const [channelEmail, setChannelEmail] = useState<boolean>(true);
//   const [channelSMS, setChannelSMS] = useState<boolean>(false);
//
//   const [isSending, setIsSending] = useState<boolean>(false);
//
//   // Past broadcast audit history
//   const [broadcastHistory, setBroadcastHistory] = useState<BroadcastRecord[]>([
//     {
//       id: 'bc_01',
//       timestamp: 'Today, 08:30 SAST',
//       title: 'Cutoff Extended to 10:30 AM SAST',
//       message: 'Orders for today have been extended until 10:30 AM SAST due to extra kitchen prep capacity.',
//       audience: 'All Corporate Clients',
//       channels: ['In-App', 'Email'],
//       category: 'cutoff',
//       recipientCount: 284,
//     },
//     {
//       id: 'bc_02',
//       timestamp: 'Yesterday, 11:45 SAST',
//       title: 'Dispatch On Track • Thermal Box Drop 12:00 PM',
//       message: 'Batch 12:00 PM drivers have departed. Food is sealed in insulated carriers.',
//       audience: 'Intellect Design Arena (Floor 3)',
//       channels: ['In-App', 'SMS'],
//       category: 'dispatch',
//       recipientCount: 142,
//     },
//   ]);
//
//   // Pre-fill message templates based on category
//   const handleSelectCategory = (cat: NoticeCategory) => {
//     setSelectedCategory(cat);
//     switch (cat) {
//       case 'cutoff':
//         setNoticeTitle('Cutoff Extension Notice');
//         setNoticeMessage(
//           'Orders for today have been extended until 10:30 AM SAST. Place your order before cutoff to guarantee batch delivery.'
//         );
//         break;
//       case 'dispatch':
//         setNoticeTitle('Delivery Dispatch Update');
//         setNoticeMessage(
//           'Our thermal delivery vans have departed the central kitchen. Expected arrival at your building reception is 12:00 PM SAST.'
//         );
//         break;
//       case 'menu':
//         setNoticeTitle('Menu & Special Batch Update');
//         setNoticeMessage(
//           'A special gluten-free and vegetarian Chef’s Choice cycle dish has been made available for tomorrow. Check the menu tab!'
//         );
//         break;
//       case 'holiday':
//         setNoticeTitle('Public Holiday Schedule Notice');
//         setNoticeMessage(
//           'Kitchen Co. central kitchens will be closed on the upcoming official statutory holiday. Normal batch delivery resumes the following weekday.'
//         );
//         break;
//       case 'account':
//         setNoticeTitle('Account & Security Notice');
//         setNoticeMessage(
//           'Please ensure your corporate email profile and preferred floor dropoff are up to date in your Profile tab.'
//         );
//         break;
//     }
//   };
//
//   const recipientCount = useMemo(() => {
//     if (audienceType === 'all') return 426;
//     if (audienceType === 'company') return 142;
//     return 68;
//   }, [audienceType]);
//
//   const handleSendBroadcast = () => {
//     if (!noticeTitle.trim() || !noticeMessage.trim()) {
//       Alert.alert('Missing Details', 'Please enter a title and message content for this notification.');
//       return;
//     }
//
//     const channels: string[] = [];
//     if (channelInApp) channels.push('In-App');
//     if (channelEmail) channels.push('Email');
//     if (channelSMS) channels.push('SMS');
//
//     if (channels.length === 0) {
//       Alert.alert('Select Channels', 'Please check at least one delivery channel (In-App, Email, or SMS).');
//       return;
//     }
//
//     const audienceLabel =
//       audienceType === 'all'
//         ? 'All Corporate Clients'
//         : audienceType === 'company'
//         ? (WHITELISTED_COMPANY_DOMAINS.find((c) => c.id === selectedCompanyId)?.companyName || 'Specific Company')
//         : `Location: ${selectedLocation}`;
//
//     Alert.alert(
//       'Confirm Broadcast Dispatch',
//       `Target: ${audienceLabel}\nRecipients: ~${recipientCount} users\nChannels: ${channels.join(', ')}\n\nDispatch notification now?`,
//       [
//         { text: 'Cancel', style: 'cancel' },
//         {
//           text: 'Send Broadcast',
//           style: 'default',
//           onPress: () => {
//             setIsSending(true);
//             setTimeout(() => {
//               setIsSending(false);
//               const newRecord: BroadcastRecord = {
//                 id: `bc_${Date.now()}`,
//                 timestamp: 'Just now (SAST)',
//                 title: noticeTitle.trim(),
//                 message: noticeMessage.trim(),
//                 audience: audienceLabel,
//                 channels,
//                 category: selectedCategory,
//                 recipientCount,
//               };
//               setBroadcastHistory([newRecord, ...broadcastHistory]);
//               Alert.alert(
//                 'Broadcast Sent',
//                 `Successfully dispatched '${noticeTitle}' to ${recipientCount} recipients across ${channels.join(', ')}.`
//               );
//             }, 800);
//           },
//         },
//       ]
//     );
//   };
//
//   return (
//     <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
//       {/* 1. Header Card */}
//       <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         <View style={styles.headerRow}>
//           <View style={[styles.iconBadge, { backgroundColor: theme.primaryMuted }]}>
//             <Ionicons name="notifications" size={20} color={theme.primary} />
//           </View>
//           <View style={{ flex: 1 }}>
//             <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Client Communications</Text>
//             <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
//               Broadcast operational alerts, cutoff extensions, and delivery notices.
//             </Text>
//           </View>
//         </View>
//       </View>
//
//       {/* 2. Compose Broadcast Card */}
//       <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>1. Target Audience</Text>
//         <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>Choose who receives this update</Text>
//
//         {/* Audience Selector Segment */}
//         <View style={[styles.segmentRow, { borderColor: theme.surfaceBorder }]}>
//           {[
//             { key: 'all', label: 'All Companies', icon: 'people' },
//             { key: 'company', label: 'By Company', icon: 'business' },
//             { key: 'location', label: 'By Location', icon: 'location' },
//           ].map((item) => (
//             <TouchableOpacity
//               key={item.key}
//               activeOpacity={0.8}
//               onPress={() => setAudienceType(item.key as AudienceType)}
//               style={[
//                 styles.segmentBtn,
//                 audienceType === item.key && {
//                   backgroundColor: isDark ? '#FFFFFF' : '#000000',
//                 },
//               ]}
//             >
//               <Ionicons
//                 name={item.icon as any}
//                 size={13}
//                 color={audienceType === item.key ? (isDark ? '#000000' : '#FFFFFF') : theme.textSecondary}
//               />
//               <Text
//                 style={[
//                   styles.segmentBtnText,
//                   { color: audienceType === item.key ? (isDark ? '#000000' : '#FFFFFF') : theme.textSecondary },
//                   audienceType === item.key && { fontWeight: '700' },
//                 ]}
//               >
//                 {item.label}
//               </Text>
//             </TouchableOpacity>
//           ))}
//         </View>
//
//         {/* Company Dropdown / List when 'company' selected */}
//         {audienceType === 'company' && (
//           <View style={styles.subSelectorBox}>
//             <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Select Company:</Text>
//             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
//               {WHITELISTED_COMPANY_DOMAINS.map((comp) => {
//                 const isSelected = selectedCompanyId === comp.id;
//                 return (
//                   <TouchableOpacity
//                     key={comp.id}
//                     activeOpacity={0.8}
//                     onPress={() => setSelectedCompanyId(comp.id)}
//                     style={[
//                       styles.choiceChip,
//                       { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder },
//                       isSelected && { backgroundColor: isDark ? '#FFFFFF' : '#121212', borderColor: isDark ? '#FFFFFF' : '#121212' },
//                     ]}
//                   >
//                     <Text style={[styles.choiceChipText, { color: isSelected ? (isDark ? '#121212' : '#FFFFFF') : theme.textPrimary }]}>
//                       {comp.companyName}
//                     </Text>
//                   </TouchableOpacity>
//                 );
//               })}
//             </ScrollView>
//           </View>
//         )}
//
//         {/* Location Dropdown / List when 'location' selected */}
//         {audienceType === 'location' && (
//           <View style={styles.subSelectorBox}>
//             <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Select Building Dropoff:</Text>
//             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
//               {DROPOFF_FLOORS.map((floor) => {
//                 const isSelected = selectedLocation === floor.label;
//                 return (
//                   <TouchableOpacity
//                     key={floor.id}
//                     activeOpacity={0.8}
//                     onPress={() => setSelectedLocation(floor.label)}
//                     style={[
//                       styles.choiceChip,
//                       { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder },
//                       isSelected && { backgroundColor: isDark ? '#FFFFFF' : '#121212', borderColor: isDark ? '#FFFFFF' : '#121212' },
//                     ]}
//                   >
//                     <Text style={[styles.choiceChipText, { color: isSelected ? (isDark ? '#121212' : '#FFFFFF') : theme.textPrimary }]}>
//                       {floor.label}
//                     </Text>
//                   </TouchableOpacity>
//                 );
//               })}
//             </ScrollView>
//           </View>
//         )}
//
//         {/* 2. Notice Template & Category */}
//         <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 18 }]}>
//           2. Issue Type & Quick Template
//         </Text>
//         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
//           {[
//             { key: 'cutoff', label: 'Cutoff Extension', icon: 'time-outline' },
//             { key: 'dispatch', label: 'Kitchen / Delay', icon: 'bicycle-outline' },
//             { key: 'menu', label: 'Menu Notice', icon: 'restaurant-outline' },
//             { key: 'holiday', label: 'Holiday Notice', icon: 'calendar-outline' },
//             { key: 'account', label: 'Security / Auth', icon: 'shield-checkmark-outline' },
//           ].map((cat) => {
//             const isSelected = selectedCategory === cat.key;
//             return (
//               <TouchableOpacity
//                 key={cat.key}
//                 activeOpacity={0.8}
//                 onPress={() => handleSelectCategory(cat.key as NoticeCategory)}
//                 style={[
//                   styles.categoryPill,
//                   { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder },
//                   isSelected && { backgroundColor: theme.primaryMuted, borderColor: theme.primary },
//                 ]}
//               >
//                 <Ionicons
//                   name={cat.icon as any}
//                   size={14}
//                   color={isSelected ? theme.primary : theme.textSecondary}
//                 />
//                 <Text
//                   style={[
//                     styles.categoryPillText,
//                     { color: isSelected ? theme.primary : theme.textSecondary },
//                     isSelected && { fontWeight: '700' },
//                   ]}
//                 >
//                   {cat.label}
//                 </Text>
//               </TouchableOpacity>
//             );
//           })}
//         </ScrollView>
//
//         {/* 3. Channels Multi-Select */}
//         <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 18 }]}>
//           3. Delivery Channels
//         </Text>
//         <View style={styles.channelsColumn}>
//           {/* In-App Banner */}
//           <TouchableOpacity
//             activeOpacity={0.8}
//             onPress={() => setChannelInApp(!channelInApp)}
//             style={[
//               styles.channelBoxResponsive,
//               { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder },
//               channelInApp && {
//                 borderColor: isDark ? '#FFFFFF' : '#121212',
//                 backgroundColor: isDark ? '#2A2A2C' : '#EFE9DC',
//               },
//             ]}
//           >
//             <Ionicons
//               name={channelInApp ? 'checkbox' : 'square-outline'}
//               size={18}
//               color={channelInApp ? theme.textPrimary : theme.textSecondary}
//             />
//             <View style={{ flex: 1 }}>
//               <Text style={[styles.channelTitle, { color: theme.textPrimary }]}>In-App Banner</Text>
//               <Text style={[styles.channelSub, { color: theme.textSecondary }]}>
//                 Urgent notification banner appearing inside the application
//               </Text>
//             </View>
//           </TouchableOpacity>
//
//           {/* Email Broadcast */}
//           <TouchableOpacity
//             activeOpacity={0.8}
//             onPress={() => setChannelEmail(!channelEmail)}
//             style={[
//               styles.channelBoxResponsive,
//               { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder },
//               channelEmail && {
//                 borderColor: isDark ? '#FFFFFF' : '#121212',
//                 backgroundColor: isDark ? '#2A2A2C' : '#EFE9DC',
//               },
//             ]}
//           >
//             <Ionicons
//               name={channelEmail ? 'checkbox' : 'square-outline'}
//               size={18}
//               color={channelEmail ? theme.textPrimary : theme.textSecondary}
//             />
//             <View style={{ flex: 1 }}>
//               <Text style={[styles.channelTitle, { color: theme.textPrimary }]}>Email Alert</Text>
//               <Text style={[styles.channelSub, { color: theme.textSecondary }]}>
//                 Direct corporate email notification sent to work inbox
//               </Text>
//             </View>
//           </TouchableOpacity>
//
//           {/* SMS Alert */}
//           <TouchableOpacity
//             activeOpacity={0.8}
//             onPress={() => setChannelSMS(!channelSMS)}
//             style={[
//               styles.channelBoxResponsive,
//               { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder },
//               channelSMS && {
//                 borderColor: isDark ? '#FFFFFF' : '#121212',
//                 backgroundColor: isDark ? '#2A2A2C' : '#EFE9DC',
//               },
//             ]}
//           >
//             <Ionicons
//               name={channelSMS ? 'checkbox' : 'square-outline'}
//               size={18}
//               color={channelSMS ? theme.textPrimary : theme.textSecondary}
//             />
//             <View style={{ flex: 1 }}>
//               <Text style={[styles.channelTitle, { color: theme.textPrimary }]}>SMS Alert</Text>
//               <Text style={[styles.channelSub, { color: theme.textSecondary }]}>
//                 Direct mobile phone SMS ping for urgent updates
//               </Text>
//             </View>
//           </TouchableOpacity>
//         </View>
//
//         {/* 4. Subject and Message Body */}
//         <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 18 }]}>
//           4. Content & Subject
//         </Text>
//
//         <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Title / Subject:</Text>
//         <TextInput
//           style={[
//             styles.textInput,
//             { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary },
//           ]}
//           value={noticeTitle}
//           onChangeText={setNoticeTitle}
//           placeholder="Notification subject..."
//           placeholderTextColor={theme.textMuted}
//         />
//
//         <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 10 }]}>Message Body:</Text>
//         <TextInput
//           style={[
//             styles.textArea,
//             { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary },
//           ]}
//           value={noticeMessage}
//           onChangeText={setNoticeMessage}
//           multiline
//           numberOfLines={3}
//           placeholder="Notification message body..."
//           placeholderTextColor={theme.textMuted}
//         />
//
//         {/* 5. Live Client Preview */}
//         <View style={[styles.previewContainer, { backgroundColor: isDark ? '#262628' : '#F1F5F9', borderColor: theme.surfaceBorder }]}>
//           <View style={styles.previewHeader}>
//             <Ionicons name="eye-outline" size={14} color={theme.textPrimary} />
//             <Text style={[styles.previewLabel, { color: theme.textPrimary }]}>Live Client In-App Preview</Text>
//           </View>
//           <Text style={[styles.previewTitle, { color: theme.textPrimary }]}>{noticeTitle || 'Notification Title'}</Text>
//           <Text style={[styles.previewMessage, { color: theme.textSecondary }]}>
//             {noticeMessage || 'Notification message will appear here for users in the target group.'}
//           </Text>
//         </View>
//
//         {/* 6. Dispatch Button (Danger Red styled like Sign Out) */}
//         <TouchableOpacity
//           activeOpacity={0.85}
//           onPress={handleSendBroadcast}
//           disabled={isSending}
//           style={[
//             styles.sendBtn,
//             {
//               backgroundColor: theme.errorSurface,
//               borderColor: theme.errorBorder,
//               borderWidth: 1,
//             },
//           ]}
//         >
//           <Ionicons name="paper-plane" size={16} color={theme.error} />
//           <Text style={[styles.sendBtnText, { color: theme.error }]}>
//             {isSending ? 'Dispatching...' : `Dispatch Broadcast (${recipientCount} Recipients)`}
//           </Text>
//         </TouchableOpacity>
//       </View>
//
//       {/* 3. Broadcast History Log */}
//       <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
//         <View style={styles.historyHeaderRow}>
//           <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Recent Broadcasts</Text>
//           <Text style={[styles.historyCount, { color: theme.textSecondary }]}>{broadcastHistory.length} sent</Text>
//         </View>
//
//         <View style={styles.historyList}>
//           {broadcastHistory.map((item) => (
//             <View
//               key={item.id}
//               style={[
//                 styles.historyItem,
//                 { backgroundColor: theme.surfaceHighlight, borderColor: theme.surfaceBorder },
//               ]}
//             >
//               <View style={styles.historyTopRow}>
//                 <Text style={[styles.historyItemTitle, { color: theme.textPrimary }]}>{item.title}</Text>
//                 <View style={[styles.deliveredPill, { backgroundColor: theme.successSurface }]}>
//                   <Text style={[styles.deliveredPillText, { color: theme.success }]}>Delivered</Text>
//                 </View>
//               </View>
//
//               <Text style={[styles.historyItemMessage, { color: theme.textSecondary }]} numberOfLines={2}>
//                 {item.message}
//               </Text>
//
//               <View style={styles.historyMetaRow}>
//                 <View style={styles.historyMetaCol}>
//                   <Ionicons name="people-outline" size={12} color={theme.textSecondary} />
//                   <Text style={[styles.historyMetaText, { color: theme.textSecondary }]}>{item.audience}</Text>
//                 </View>
//                 <View style={styles.historyMetaCol}>
//                   <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
//                   <Text style={[styles.historyMetaText, { color: theme.textSecondary }]}>{item.timestamp}</Text>
//                 </View>
//                 <View style={styles.historyMetaCol}>
//                   <Ionicons name="megaphone-outline" size={12} color={theme.textSecondary} />
//                   <Text style={[styles.historyMetaText, { color: theme.textSecondary }]}>{item.channels.join(', ')}</Text>
//                 </View>
//               </View>
//             </View>
//           ))}
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
//   headerCard: {
//     padding: 16,
//     borderRadius: 16,
//     borderWidth: 1,
//     marginBottom: 16,
//   },
//   headerRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 12,
//   },
//   iconBadge: {
//     width: 42,
//     height: 42,
//     borderRadius: 12,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   headerTitle: {
//     fontSize: 16,
//     fontWeight: '700',
//   },
//   headerSubtitle: {
//     fontSize: 12,
//     marginTop: 2,
//     lineHeight: 16,
//   },
//   card: {
//     padding: 16,
//     borderRadius: 16,
//     borderWidth: 1,
//     marginBottom: 16,
//   },
//   sectionTitle: {
//     fontSize: 13,
//     fontWeight: '700',
//     letterSpacing: 0.2,
//   },
//   sectionSub: {
//     fontSize: 11,
//     marginTop: 2,
//     marginBottom: 10,
//   },
//   segmentRow: {
//     flexDirection: 'row',
//     borderRadius: 10,
//     borderWidth: 1,
//     padding: 3,
//     marginBottom: 12,
//   },
//   segmentBtn: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 6,
//     paddingVertical: 8,
//     borderRadius: 8,
//   },
//   segmentBtnText: {
//     fontSize: 11.5,
//     fontWeight: '500',
//   },
//   subSelectorBox: {
//     marginBottom: 10,
//   },
//   chipsScroll: {
//     flexDirection: 'row',
//     gap: 8,
//     paddingVertical: 4,
//   },
//   choiceChip: {
//     paddingHorizontal: 12,
//     paddingVertical: 7,
//     borderRadius: 18,
//     borderWidth: 1,
//   },
//   choiceChipText: {
//     fontSize: 12,
//     fontWeight: '600',
//   },
//   categoryPill: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: 20,
//     borderWidth: 1,
//   },
//   categoryPillText: {
//     fontSize: 12,
//     fontWeight: '500',
//   },
//   channelsColumn: {
//     gap: 8,
//     marginTop: 6,
//   },
//   channelBoxResponsive: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 12,
//     padding: 12,
//     borderRadius: 12,
//     borderWidth: 1,
//   },
//   channelsRow: {
//     flexDirection: 'row',
//     gap: 8,
//     marginTop: 6,
//   },
//   channelBox: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//     padding: 10,
//     borderRadius: 10,
//     borderWidth: 1,
//   },
//   channelTitle: {
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   channelSub: {
//     fontSize: 9,
//     marginTop: 1,
//   },
//   inputLabel: {
//     fontSize: 11.5,
//     fontWeight: '600',
//     marginBottom: 4,
//   },
//   textInput: {
//     height: 42,
//     borderRadius: 10,
//     borderWidth: 1,
//     paddingHorizontal: 12,
//     fontSize: 13,
//     marginBottom: 6,
//   },
//   textArea: {
//     height: 70,
//     borderRadius: 10,
//     borderWidth: 1,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     fontSize: 13,
//     textAlignVertical: 'top',
//     marginBottom: 12,
//   },
//   previewContainer: {
//     padding: 12,
//     borderRadius: 12,
//     borderWidth: 1,
//     marginBottom: 16,
//   },
//   previewHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//     marginBottom: 6,
//   },
//   previewLabel: {
//     fontSize: 10.5,
//     fontWeight: '800',
//     letterSpacing: 0.5,
//   },
//   previewTitle: {
//     fontSize: 13.5,
//     fontWeight: '700',
//     marginBottom: 3,
//   },
//   previewMessage: {
//     fontSize: 12,
//     lineHeight: 16,
//   },
//   sendBtn: {
//     height: 46,
//     borderRadius: 12,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//   },
//   sendBtnText: {
//     color: '#FFFFFF',
//     fontSize: 14,
//     fontWeight: '700',
//   },
//   historyHeaderRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 14,
//   },
//   cardTitle: {
//     fontSize: 15,
//     fontWeight: '700',
//   },
//   historyCount: {
//     fontSize: 12,
//   },
//   historyList: {
//     gap: 10,
//   },
//   historyItem: {
//     padding: 12,
//     borderRadius: 12,
//     borderWidth: 1,
//   },
//   historyTopRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 4,
//   },
//   historyItemTitle: {
//     fontSize: 13,
//     fontWeight: '700',
//     flex: 1,
//   },
//   deliveredPill: {
//     paddingHorizontal: 6,
//     paddingVertical: 2,
//     borderRadius: 4,
//   },
//   deliveredPillText: {
//     fontSize: 9.5,
//     fontWeight: '800',
//   },
//   historyItemMessage: {
//     fontSize: 12,
//     lineHeight: 16,
//     marginBottom: 8,
//   },
//   historyMetaRow: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: 12,
//   },
//   historyMetaCol: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//   },
//   historyMetaText: {
//     fontSize: 10.5,
//   },
// });
//

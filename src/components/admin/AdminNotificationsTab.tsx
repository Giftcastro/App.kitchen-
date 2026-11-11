import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme/ThemeContext';
import { useCart } from '../../context/CartContext';
import { BroadcastNotification } from '../../types';
import {
  fetchBroadcastMessagesFromDb,
  sendBroadcastMessageToDb,
  fetchAdminUsersFromDb,
  DbManagedUser,
} from '../../services/supabaseDataService';
import { getTodayIsoSAST } from '../../utils/adminMetrics';

type AudienceType = 'all' | 'company' | 'active_orders' | 'customer';
type HistoryFilterType = 'all' | 'all_companies' | 'company' | 'active_orders' | 'customer';

export const AdminNotificationsTab: React.FC = () => {
  const { theme, isDark } = useTheme();
  const { corporateAccounts, orderHistory, refreshBroadcasts } = useCart();

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audienceType, setAudienceType] = useState<AudienceType>('all');
  const [selectedCompanyId, setSelectedCompanyId] = useState(corporateAccounts[0]?.id || '');
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<DbManagedUser | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Pop-up Modals for clean, non-clustered selection
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [companyModalSearch, setCompanyModalSearch] = useState('');

  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerCompanyCategory, setCustomerCompanyCategory] = useState<string>('All Companies');

  // Registered customers list (live from DB + order history + fallback)
  const [allCustomers, setAllCustomers] = useState<DbManagedUser[]>([]);

  // Sent History Sort Order ('newest' | 'oldest') & Filters
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyFilterType, setHistoryFilterType] = useState<HistoryFilterType>('all');

  // Initial sent history logs (hydrated live from Supabase)
  const [history, setHistory] = useState<BroadcastNotification[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [dbBroadcasts, dbUsers] = await Promise.all([
        fetchBroadcastMessagesFromDb(),
        fetchAdminUsersFromDb(),
      ]);
      if (dbBroadcasts.length > 0) {
        setHistory(dbBroadcasts);
      }

      // Merge dbUsers + unique customers from orderHistory so every known client is searchable
      const mergedMap = new Map<string, DbManagedUser>();
      for (const u of dbUsers) {
        mergedMap.set(u.email.toLowerCase(), u);
      }
      for (const o of orderHistory) {
        if (o.customerEmail && !mergedMap.has(o.customerEmail.toLowerCase())) {
          mergedMap.set(o.customerEmail.toLowerCase(), {
            id: o.userId || `ord_usr_${o.id}`,
            fullName: o.customerName || o.customerEmail.split('@')[0],
            email: o.customerEmail,
            role: 'user',
            companyName: o.companyName || 'Corporate Partner',
            deliveryFloor: o.deliveryFloor || 'Reception',
            isActive: true,
            joinedDate: o.createdAt?.slice(0, 10) || '2026-08-01',
          });
        }
      }
      const list = Array.from(mergedMap.values());
      setAllCustomers(list);
      if (list.length > 0 && !selectedCustomer) {
        setSelectedCustomer(list[0]);
      }
    };
    loadData();
  }, [orderHistory]);

  // Organized active order dates with client & order counts
  const organizedDates = useMemo(() => {
    const map = new Map<string, { date: string; orderCount: number; clientCount: number }>();
    for (const o of orderHistory) {
      if (!o.targetDeliveryDate || o.status === 'cancelled') continue;
      const d = o.targetDeliveryDate;
      if (!map.has(d)) {
        map.set(d, { date: d, orderCount: 0, clientCount: 0 });
      }
      const entry = map.get(d)!;
      entry.orderCount += 1;
    }
    for (const [d, entry] of map.entries()) {
      const uniqueClients = new Set(
        orderHistory
          .filter((o) => o.targetDeliveryDate === d && o.status !== 'cancelled')
          .map((o) => o.userId || o.customerEmail || o.id)
      ).size;
      entry.clientCount = uniqueClients;
    }
    const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length === 0) {
      return [{ date: getTodayIsoSAST(), orderCount: 0, clientCount: 0 }];
    }
    return sorted;
  }, [orderHistory]);

  useEffect(() => {
    if (!selectedDeliveryDate && organizedDates.length > 0) {
      setSelectedDeliveryDate(organizedDates[0].date);
    }
  }, [organizedDates, selectedDeliveryDate]);

  // Selected company object
  const activeCompany =
    corporateAccounts.find((c) => c.id === selectedCompanyId) || corporateAccounts[0];

  // Filtered companies in Company Pop-up Modal
  const filteredCompaniesForModal = useMemo(() => {
    const q = companyModalSearch.trim().toLowerCase();
    if (!q) return corporateAccounts;
    return corporateAccounts.filter(
      (c) =>
        c.companyName.toLowerCase().includes(q) ||
        c.locations.some((l) => l.toLowerCase().includes(q))
    );
  }, [corporateAccounts, companyModalSearch]);

  // Unique company categories for Customer Picker Modal
  const customerCompanyCategories = useMemo(() => {
    const set = new Set<string>();
    corporateAccounts.forEach((c) => set.add(c.companyName));
    allCustomers.forEach((u) => {
      if (u.companyName && u.companyName !== 'Unassigned') set.add(u.companyName);
    });
    return ['All Companies', ...Array.from(set)];
  }, [corporateAccounts, allCustomers]);

  // Filtered customers in Customer Picker Modal (by company category + quick search)
  const filteredCustomersForModal = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    return allCustomers.filter((u) => {
      const matchCompany =
        customerCompanyCategory === 'All Companies' ||
        u.companyName.toLowerCase() === customerCompanyCategory.toLowerCase();
      const matchSearch =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.companyName.toLowerCase().includes(q);
      return matchCompany && matchSearch;
    });
  }, [allCustomers, customerCompanyCategory, customerSearchQuery]);

  // Calculate estimated recipients strictly from live database data
  const estimatedRecipients = useMemo(() => {
    if (audienceType === 'all') {
      return allCustomers.filter((u) => u.role === 'user').length;
    }
    if (audienceType === 'company') {
      return activeCompany?.activeUsersCount ?? 0;
    }
    if (audienceType === 'customer') {
      return 1;
    }
    // active order holders for selected date
    const ordersOnDate = orderHistory.filter(
      (o) => o.targetDeliveryDate === selectedDeliveryDate && o.status !== 'cancelled'
    );
    return new Set(ordersOnDate.map((o) => o.userId || o.customerEmail || o.id)).size;
  }, [audienceType, activeCompany, selectedDeliveryDate, orderHistory, allCustomers]);

  // Format audience label stored in DB
  const audienceLabel = useMemo(() => {
    if (audienceType === 'all') return 'All Companies';
    if (audienceType === 'company') return activeCompany?.companyName || 'Corporate Account';
    if (audienceType === 'customer') {
      return selectedCustomer
        ? `User: ${selectedCustomer.fullName} (${selectedCustomer.email})`
        : 'User: Direct Customer';
    }
    return `Active Clients (${selectedDeliveryDate})`;
  }, [audienceType, activeCompany, selectedDeliveryDate, selectedCustomer]);

  // Handle selecting an audience option (opens pop-up modal where applicable)
  const handleSelectAudienceType = (type: AudienceType) => {
    setAudienceType(type);
    if (type === 'company') {
      setIsCompanyModalOpen(true);
    } else if (type === 'active_orders') {
      setIsDateModalOpen(true);
    } else if (type === 'customer') {
      setIsCustomerModalOpen(true);
    }
  };

  // Send broadcast to Supabase
  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Missing Info', 'Please provide both a notification title and message body.');
      return;
    }
    if (audienceType === 'customer' && !selectedCustomer) {
      Alert.alert('Select Customer', 'Please select a customer to send this message to.');
      setIsCustomerModalOpen(true);
      return;
    }

    setIsSending(true);

    const sent = await sendBroadcastMessageToDb(title.trim(), message.trim(), audienceLabel, estimatedRecipients);
    if (!sent) {
      setIsSending(false);
      Alert.alert('Not Sent', 'The notification could not be saved. Please try again.');
      return;
    }
    await refreshBroadcasts();

    const newLog: BroadcastNotification = {
      id: `bn_${Date.now()}`,
      title: title.trim(),
      body: message.trim(),
      targetAudience: audienceLabel,
      recipientCount: estimatedRecipients,
      sentAt: new Date().toISOString(),
      channel:
        audienceType === 'all'
          ? 'kitchenco'
          : audienceType === 'company'
          ? 'company'
          : 'me',
    };

    setHistory((prev) => [newLog, ...prev]);
    setTitle('');
    setMessage('');
    setIsSending(false);

    Alert.alert(
      'Broadcast Dispatched 🚀',
      `Notification successfully dispatched to ${audienceLabel} (${estimatedRecipients} recipient${
        estimatedRecipients === 1 ? '' : 's'
      }) and saved live in database.`
    );
  };

  // Filtered & Sorted Sent History
  const filteredAndSortedHistory = useMemo(() => {
    const q = historySearchQuery.trim().toLowerCase();

    const filtered = history.filter((item) => {
      const aud = (item.targetAudience || '').toLowerCase();
      if (historyFilterType === 'all_companies') {
        if (aud !== 'all companies' && aud !== 'all customers') return false;
      } else if (historyFilterType === 'company') {
        if (
          aud === 'all companies' ||
          aud === 'all customers' ||
          aud.startsWith('active') ||
          aud.startsWith('user:') ||
          aud.includes('@')
        ) {
          return false;
        }
      } else if (historyFilterType === 'active_orders') {
        if (!aud.startsWith('active')) return false;
      } else if (historyFilterType === 'customer') {
        if (!aud.startsWith('user:') && !aud.includes('@')) return false;
      }

      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        aud.includes(q)
      );
    });

    return filtered.sort((a, b) => {
      const timeA = new Date(a.sentAt).getTime();
      const timeB = new Date(b.sentAt).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [history, sortOrder, historySearchQuery, historyFilterType]);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* 1. Compose Broadcast Card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="megaphone" size={18} color={theme.brandGold} />
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
            Compose Broadcast Notification
          </Text>
        </View>

        {/* Target Audience 2x2 Clean Grid Selector */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.brandGold }]}>
            Target Audience Group (Tap to Select)
          </Text>
          <View style={styles.audienceGrid}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSelectAudienceType('all')}
              style={[
                styles.audienceGridBtn,
                {
                  backgroundColor: audienceType === 'all' ? theme.primary : theme.chipBg,
                  borderColor: audienceType === 'all' ? theme.primary : theme.surfaceBorder,
                },
              ]}
            >
              <Ionicons
                name="globe-outline"
                size={15}
                color={audienceType === 'all' ? theme.textInverse : theme.brandGold}
              />
              <Text
                style={[
                  styles.audienceBtnText,
                  { color: audienceType === 'all' ? theme.textInverse : theme.textPrimary },
                ]}
                numberOfLines={1}
              >
                All Companies
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSelectAudienceType('company')}
              style={[
                styles.audienceGridBtn,
                {
                  backgroundColor: audienceType === 'company' ? theme.primary : theme.chipBg,
                  borderColor: audienceType === 'company' ? theme.primary : theme.surfaceBorder,
                },
              ]}
            >
              <Ionicons
                name="business-outline"
                size={15}
                color={audienceType === 'company' ? theme.textInverse : theme.brandGold}
              />
              <Text
                style={[
                  styles.audienceBtnText,
                  { color: audienceType === 'company' ? theme.textInverse : theme.textPrimary },
                ]}
                numberOfLines={1}
              >
                Specific Company
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSelectAudienceType('active_orders')}
              style={[
                styles.audienceGridBtn,
                {
                  backgroundColor: audienceType === 'active_orders' ? theme.primary : theme.chipBg,
                  borderColor: audienceType === 'active_orders' ? theme.primary : theme.surfaceBorder,
                },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={15}
                color={audienceType === 'active_orders' ? theme.textInverse : theme.brandGold}
              />
              <Text
                style={[
                  styles.audienceBtnText,
                  { color: audienceType === 'active_orders' ? theme.textInverse : theme.textPrimary },
                ]}
                numberOfLines={1}
              >
                Active Order Dates
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSelectAudienceType('customer')}
              style={[
                styles.audienceGridBtn,
                {
                  backgroundColor: audienceType === 'customer' ? theme.primary : theme.chipBg,
                  borderColor: audienceType === 'customer' ? theme.primary : theme.surfaceBorder,
                },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={15}
                color={audienceType === 'customer' ? theme.textInverse : theme.brandGold}
              />
              <Text
                style={[
                  styles.audienceBtnText,
                  { color: audienceType === 'customer' ? theme.textInverse : theme.textPrimary },
                ]}
                numberOfLines={1}
              >
                Specific Customer
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Recipient Summary Bar (with quick button to re-open pop-up) */}
        <View
          style={[
            styles.selectedTargetSummaryBar,
            { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder },
          ]}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[styles.targetSummaryCaption, { color: theme.textMuted }]}>
              SELECTED RECIPIENT TARGET:
            </Text>
            <Text style={[styles.targetSummaryValue, { color: theme.textPrimary }]} numberOfLines={1}>
              {audienceLabel}
            </Text>
          </View>
          {audienceType !== 'all' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSelectAudienceType(audienceType)}
              style={[styles.changeTargetBtn, { backgroundColor: theme.surface, borderColor: theme.brandGold }]}
            >
              <Ionicons name="options-outline" size={13} color={theme.brandGold} />
              <Text style={[styles.changeTargetBtnText, { color: theme.brandGold }]}>
                Change
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Title Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.brandGold }]}>Notification Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., 10:00 AM Delivery Confirmation"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              { backgroundColor: theme.background, borderColor: theme.surfaceBorder, color: theme.textPrimary },
            ]}
          />
        </View>

        {/* Message Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.brandGold }]}>Message Body</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Write broadcast announcement details here..."
            placeholderTextColor={theme.textMuted}
            multiline
            style={[
              styles.input,
              styles.textArea,
              { backgroundColor: theme.background, borderColor: theme.surfaceBorder, color: theme.textPrimary },
            ]}
          />
        </View>

        {/* Send Action */}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={isSending}
          onPress={handleSend}
          style={[styles.sendBtn, { backgroundColor: theme.brandGold }]}
        >
          <Ionicons name="paper-plane" size={15} color={theme.onBrandGold} />
          <Text style={[styles.sendBtnText, { color: theme.onBrandGold }]} numberOfLines={1} adjustsFontSizeToFit>
            {isSending
              ? 'Sending...'
              : `Send Push Broadcast (${estimatedRecipients} recipient${estimatedRecipients === 1 ? '' : 's'})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Sent History Header with Arrow-Only Sort Toggle & Filters */}
      <View style={styles.historyHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.historyTitle, { color: theme.textPrimary }]}>
            Sent History ({filteredAndSortedHistory.length})
          </Text>
          <Text style={[styles.historySubtitle, { color: theme.textSecondary }]}>
            Filter &amp; search previously dispatched messages
          </Text>
        </View>

        {/* Sort Switcher: Arrows Only (⬇ / ⬆) as requested */}
        <View style={[styles.sortSwitch, { backgroundColor: theme.chipBg }]}>
          <TouchableOpacity
            accessibilityLabel="Sort newest first"
            onPress={() => setSortOrder('newest')}
            style={[styles.sortBtn, sortOrder === 'newest' && { backgroundColor: theme.surface }]}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '800',
                color: sortOrder === 'newest' ? theme.primary : theme.textMuted,
              }}
            >
              ⬇
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Sort oldest first"
            onPress={() => setSortOrder('oldest')}
            style={[styles.sortBtn, sortOrder === 'oldest' && { backgroundColor: theme.surface }]}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '800',
                color: sortOrder === 'oldest' ? theme.primary : theme.textMuted,
              }}
            >
              ⬆
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sent History Search & Category Filter Bar */}
      <View style={styles.historyFilterBlock}>
        <View
          style={[
            styles.historySearchBox,
            { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
          ]}
        >
          <Ionicons name="search" size={15} color={theme.textMuted} />
          <TextInput
            value={historySearchQuery}
            onChangeText={setHistorySearchQuery}
            placeholder="Search sent messages by title, text, company or user..."
            placeholderTextColor={theme.textMuted}
            style={[styles.historySearchInput, { color: theme.textPrimary }]}
          />
          {historySearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setHistorySearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.historyFilterPillRow}
        >
          {([
            { id: 'all', label: 'All Sent' },
            { id: 'all_companies', label: 'All Companies' },
            { id: 'company', label: 'Specific Company' },
            { id: 'active_orders', label: 'Active Order Dates' },
            { id: 'customer', label: 'Specific Customer' },
          ] as { id: HistoryFilterType; label: string }[]).map((f) => {
            const active = historyFilterType === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setHistoryFilterType(f.id)}
                style={[
                  styles.subPill,
                  active
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}
              >
                <Text
                  style={[
                    styles.subPillText,
                    { color: active ? theme.textInverse : theme.textSecondary },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Sent History List */}
      <View style={styles.historyList}>
        {filteredAndSortedHistory.length === 0 ? (
          <View
            style={[
              styles.emptyHistoryBox,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
            ]}
          >
            <Ionicons name="mail-open-outline" size={28} color={theme.textMuted} />
            <Text style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center' }}>
              No sent messages match the selected filter.
            </Text>
          </View>
        ) : (
          filteredAndSortedHistory.map((item) => {
            const sentDate = new Date(item.sentAt);
            const timeLabel = `${sentDate.toLocaleDateString()} at ${sentDate.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}`;

            return (
              <View
                key={item.id}
                style={[
                  styles.historyCard,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}
              >
                <View style={styles.historyTopRow}>
                  <Text style={[styles.logTitle, { color: theme.textPrimary }]}>{item.title}</Text>
                  <View style={[styles.audienceChip, { backgroundColor: theme.chipBg }]}>
                    <Text style={[styles.audienceChipText, { color: theme.brandGold }]} numberOfLines={1}>
                      {item.targetAudience}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.logBody, { color: theme.textSecondary }]}>{item.body}</Text>

                <View style={styles.logFooter}>
                  <Text style={[styles.logTime, { color: theme.textMuted }]}>🕒 Sent {timeLabel}</Text>
                  <Text style={[styles.logRecipients, { color: theme.primary }]}>
                    👥 {item.recipientCount} {item.recipientCount === 1 ? 'client' : 'clients'} reached
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* --- POP-UP MODAL 1: Select Specific Company --- */}
      <Modal visible={isCompanyModalOpen} transparent animationType="fade">
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
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Select Corporate Partner
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Choose which company will receive this broadcast notification
            </Text>

            <View
              style={[
                styles.modalSearchBox,
                { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              ]}
            >
              <Ionicons name="search" size={15} color={theme.textMuted} />
              <TextInput
                value={companyModalSearch}
                onChangeText={setCompanyModalSearch}
                placeholder="Search company..."
                placeholderTextColor={theme.textMuted}
                style={[styles.historySearchInput, { color: theme.textPrimary }]}
              />
            </View>

            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 8 }}>
              {filteredCompaniesForModal.map((comp) => {
                const isSelected = comp.id === selectedCompanyId;
                return (
                  <TouchableOpacity
                    key={comp.id}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedCompanyId(comp.id);
                      setIsCompanyModalOpen(false);
                    }}
                    style={[
                      styles.modalOptionCard,
                      {
                        backgroundColor: isSelected ? theme.primaryMuted : theme.surface,
                        borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          styles.modalOptionTitle,
                          { color: isSelected ? theme.primary : theme.textPrimary },
                        ]}
                      >
                        {comp.companyName}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                        📍 {comp.locations[0] || 'Office'} • {comp.activeUsersCount} staff members
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setIsCompanyModalOpen(false)}
              style={[styles.modalCloseBtn, { borderColor: theme.surfaceBorder }]}
            >
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- POP-UP MODAL 2: Select Active Order Clients Date --- */}
      <Modal visible={isDateModalOpen} transparent animationType="fade">
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
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Active Order Clients by Date
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Select a delivery date to notify all clients with scheduled orders
            </Text>

            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 8 }}>
              {organizedDates.map((d) => {
                const isSelected = d.date === selectedDeliveryDate;
                return (
                  <TouchableOpacity
                    key={d.date}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedDeliveryDate(d.date);
                      setIsDateModalOpen(false);
                    }}
                    style={[
                      styles.modalOptionCard,
                      {
                        backgroundColor: isSelected ? theme.primaryMuted : theme.surface,
                        borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.modalOptionTitle,
                          { color: isSelected ? theme.primary : theme.textPrimary },
                        ]}
                      >
                        📅 {d.date} (12:00 PM Drop)
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                        {d.orderCount} scheduled {d.orderCount === 1 ? 'order' : 'orders'} •{' '}
                        {d.clientCount} {d.clientCount === 1 ? 'client' : 'clients'}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setIsDateModalOpen(false)}
              style={[styles.modalCloseBtn, { borderColor: theme.surfaceBorder }]}
            >
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- POP-UP MODAL 3: Select Specific Customer (Search + Company Categorization) --- */}
      <Modal visible={isCustomerModalOpen} transparent animationType="fade">
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
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Select Specific Customer
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Quickly search by name/email or filter by corporate account
            </Text>

            {/* Quick Search Bar */}
            <View
              style={[
                styles.modalSearchBox,
                { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              ]}
            >
              <Ionicons name="search" size={15} color={theme.textMuted} />
              <TextInput
                value={customerSearchQuery}
                onChangeText={setCustomerSearchQuery}
                placeholder="Quick search user by name or email..."
                placeholderTextColor={theme.textMuted}
                style={[styles.historySearchInput, { color: theme.textPrimary }]}
              />
              {customerSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setCustomerSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Company Categorization Filter Pills */}
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
              >
                {customerCompanyCategories.map((cat) => {
                  const active = customerCompanyCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCustomerCompanyCategory(cat)}
                      style={[
                        styles.subPill,
                        active
                          ? { backgroundColor: theme.primary, borderColor: theme.primary }
                          : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subPillText,
                          { color: active ? theme.textInverse : theme.textSecondary },
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Customer List */}
            <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 8 }}>
              {filteredCustomersForModal.length === 0 ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: theme.textMuted }}>
                    No customers match your search/company filter.
                  </Text>
                </View>
              ) : (
                filteredCustomersForModal.map((user) => {
                  const isSelected = selectedCustomer?.email === user.email;
                  return (
                    <TouchableOpacity
                      key={user.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedCustomer(user);
                        setIsCustomerModalOpen(false);
                      }}
                      style={[
                        styles.modalOptionCard,
                        {
                          backgroundColor: isSelected ? theme.primaryMuted : theme.surface,
                          borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[
                            styles.modalOptionTitle,
                            { color: isSelected ? theme.primary : theme.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          👤 {user.fullName}
                        </Text>
                        <Text
                          style={{ fontSize: 11, color: theme.textSecondary }}
                          numberOfLines={1}
                        >
                          {user.email} • {user.companyName}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setIsCustomerModalOpen(false)}
              style={[styles.modalCloseBtn, { borderColor: theme.surfaceBorder }]}
            >
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  audienceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  audienceGridBtn: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  audienceBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectedTargetSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  targetSummaryCaption: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  targetSummaryValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  changeTargetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  changeTargetBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  subPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  subPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  textArea: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginTop: 4,
    gap: 10,
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  historySubtitle: {
    fontSize: 12,
  },
  sortSwitch: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    flexShrink: 0,
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyFilterBlock: {
    gap: 8,
  },
  historySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  historySearchInput: {
    flex: 1,
    fontSize: 12,
    height: '100%',
  },
  historyFilterPillRow: {
    gap: 6,
    paddingVertical: 2,
  },
  historyList: {
    gap: 10,
  },
  emptyHistoryBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  historyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  logTitle: {
    flex: 1,
    minWidth: 140,
    fontSize: 14,
    fontWeight: '800',
  },
  audienceChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '100%',
  },
  audienceChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  logBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
    paddingTop: 6,
    marginTop: 2,
  },
  logTime: {
    fontSize: 11,
  },
  logRecipients: {
    fontSize: 11,
    fontWeight: '700',
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
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: -6,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  modalOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  modalOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalCloseBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});

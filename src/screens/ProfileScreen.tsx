import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Modal,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { BrandTheme, BroadcastNotification } from '../types';
import { FloorPickerModal } from '../components/FloorPickerModal';
import { submitComplaintToDb } from '../services/supabaseDataService';
import { CancellationPolicyModal } from '../components/CancellationPolicyModal';

interface ProfileScreenProps {
  onNavigateToOrders?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToAdmin?: () => void;
}

const AVATARS = [
  { id: 'av_1', emoji: '🧑‍🍳' },
  { id: 'av_2', emoji: '👩‍💼' },
  { id: 'av_3', emoji: '🧑‍💻' },
  { id: 'av_4', emoji: '🥗' },
  { id: 'av_5', emoji: '🍱' },
  { id: 'av_6', emoji: '🍲' },
  { id: 'av_7', emoji: '🥑' },
  { id: 'av_8', emoji: '☕' },
  { id: 'av_9', emoji: '🍎' },
  { id: 'av_10', emoji: '🍋' },
  { id: 'av_11', emoji: '🍜' },
  { id: 'av_12', emoji: '🥐' },
];

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onNavigateToOrders,
  onNavigateToAdmin,
}) => {
  const { theme, isDark, themeMode, setThemeMode, brandTheme, setBrandTheme, brandThemes } = useTheme();
  const { currentUser, updateDropoffFloor, updateUserProfile, signOut } = useAuth();
  const {
    orderHistory,
    corporateAccounts,
    broadcastMessages,
    unreadBroadcastCount,
    markBroadcastsAsRead,
    refreshBroadcasts,
  } = useCart();

  const isAdminOrStaff = currentUser?.role === 'admin' || currentUser?.role === 'chef';

  // Modals
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);
  const [isFloorPickerOpen, setIsFloorPickerOpen] = useState<boolean>(false);
  const [isCompanySimulatorOpen, setIsCompanySimulatorOpen] = useState<boolean>(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState<boolean>(false);
  const [isMessagesModalOpen, setIsMessagesModalOpen] = useState<boolean>(false);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState<boolean>(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState<boolean>(false);

  // Settings
  const [pushEnabled, setPushEnabled] = useState<boolean>(true);

  // Messages Channel State ('kitchenco' | 'company' | 'me')
  const [messageChannel, setMessageChannel] = useState<'kitchenco' | 'company' | 'me'>('kitchenco');

  // Complaint Form
  const [complaintType, setComplaintType] = useState<'order_not_arrived' | 'cancellation' | 'quality_issue'>('order_not_arrived');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orderHistory[0]?.id || '');
  const [complaintBody, setComplaintBody] = useState<string>('');

  // Dynamic corporate floor configuration
  const userCompany =
    corporateAccounts.find(
      (c) =>
        c.id === currentUser?.companyId ||
        (currentUser?.companyName && c.companyName === currentUser.companyName) ||
        c.domains.includes(currentUser?.email?.split('@')[1] || '')
    ) || corporateAccounts[0];
  const availableFloors = userCompany?.locations || [];

  // Admin handler to simulate any enrolled Corporate Partner in Customer View
  const handleSimulateCompany = async (companyId: string) => {
    const targetComp = corporateAccounts.find((c) => c.id === companyId);
    if (!targetComp) return;
    const defaultLoc = targetComp.locations[0] || 'Head Office Reception';
    await updateUserProfile({
      companyId: targetComp.id,
      companyName: targetComp.companyName,
      locationName: defaultLoc,
      buildingName: defaultLoc,
      deliveryFloor: defaultLoc,
    });
    await refreshBroadcasts();
    setIsCompanySimulatorOpen(false);
  };

  // Filter messages dynamically from Supabase
  const filteredMessages = useMemo(() => {
    return broadcastMessages.filter((m) => {
      const aud = (m.targetAudience || '').trim();
      const audLower = aud.toLowerCase();
      if (messageChannel === 'kitchenco') {
        return (
          m.channel === 'kitchenco' ||
          audLower === 'all' ||
          audLower === 'all customers' ||
          audLower === 'all companies'
        );
      }
      if (messageChannel === 'company') {
        if (!userCompany?.companyName) return m.channel === 'company';
        return (
          audLower.includes(userCompany.companyName.toLowerCase()) ||
          (m.channel === 'company' && audLower === userCompany.companyName.toLowerCase())
        );
      }
      if (messageChannel === 'me') {
        const userEmailLower = (currentUser?.email || '').toLowerCase();
        const userNameLower = (currentUser?.fullName || '').toLowerCase();
        return (
          m.channel === 'me' ||
          audLower.startsWith('active') ||
          audLower.startsWith('user:') ||
          (Boolean(userEmailLower) && audLower.includes(userEmailLower)) ||
          (Boolean(userNameLower) && audLower.includes(userNameLower))
        );
      }
      return true;
    });
  }, [broadcastMessages, messageChannel, userCompany, currentUser]);

  // Avatar helper
  const selectedAvatar = AVATARS.find((a) => a.id === currentUser?.avatarId) || AVATARS[0];

  const handleAvatarSelect = async (avatarId: string) => {
    await updateUserProfile({ avatarId });
    setIsAvatarModalOpen(false);
  };

  const handleSupportContact = () => {
    Alert.alert(
      'Kitchen Co. Support Desk',
      'Sandton Central Culinary Concierge:\n\nEmail: supportykc@csggroup.co.za\nTel: +27 11 883 0000',
      [
        {
          text: 'Send Email',
          onPress: () => Linking.openURL('mailto:supportykc@csggroup.co.za?subject=Kitchen%20Co%20Inquiry'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSubmitComplaint = async () => {
    if (complaintType === 'cancellation') {
      setIsComplaintModalOpen(false);
      setIsPolicyOpen(true);
      return;
    }

    if (!complaintBody.trim()) {
      Alert.alert('Details Required', 'Please describe the issue so our kitchen operations team can investigate.');
      return;
    }

    if (!currentUser?.id) return;
    const ticketRef = await submitComplaintToDb(currentUser.id, complaintType, complaintBody, orderHistory[0]?.id);
    if (!ticketRef) {
      Alert.alert('Not Sent', 'Your complaint could not be saved. Please try again.');
      return;
    }
    setIsComplaintModalOpen(false);
    setComplaintBody('');
    Alert.alert(
      'Complaint Ticket Lodged',
      `Ticket reference ${ticketRef} has been assigned.\nOur culinary dispatch officer will contact you directly at ${currentUser?.email} (CC: supportykc@csggroup.co.za).`,
      [{ text: 'OK' }]
    );
  };

  const handleSignOutPress = () => {
    setIsSignOutModalOpen(true);
  };

  const handleConfirmSignOut = async () => {
    setIsSignOutModalOpen(false);
    await signOut();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={[styles.headerBar, { borderBottomColor: theme.surfaceBorder }]}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Profile & Workplace</Text>
        {(currentUser?.role === 'admin' || currentUser?.role === 'chef') && onNavigateToAdmin && (
          <TouchableOpacity
            onPress={onNavigateToAdmin}
            style={[styles.adminCommandPill, { backgroundColor: theme.brandGold }]}
          >
            <Text style={[styles.adminCommandPillText, { color: theme.onBrandGold }]}>⚙️ Admin</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 1. Header Profile & Avatar Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={styles.profileHeaderRow}>
            {/* Avatar with edit badge */}
            <TouchableOpacity
              onPress={() => setIsAvatarModalOpen(true)}
              activeOpacity={0.8}
              style={[styles.avatarCircle, { backgroundColor: theme.chipBg, borderColor: theme.brandGold }]}
            >
              <Text style={{ fontSize: 36 }}>{selectedAvatar.emoji}</Text>
              <View style={[styles.cameraBadge, { backgroundColor: theme.primary }]}>
                <Ionicons name="camera" size={10} color={theme.textInverse} />
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <Text style={[styles.fullName, { color: theme.textPrimary }]}>
                {currentUser?.fullName || 'Corporate Client'}
              </Text>
              <Text style={[styles.emailText, { color: theme.textSecondary }]}>
                {currentUser?.email || 'client@example.com'}
              </Text>

              <View style={[styles.roleBadge, { backgroundColor: theme.subtleFillStrong }]}>
                <Text style={[styles.roleBadgeText, { color: theme.primary }]}>
                  {currentUser?.role === 'admin' ? 'Executive Kitchen Admin' : currentUser?.role === 'chef' ? 'Head Chef Ops' : 'Corporate Gourmet Client'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. Messages (1-Directional Communications) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setIsMessagesModalOpen(true);
            markBroadcastsAsRead();
          }}
          style={[styles.card, styles.messagesBannerCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
        >
          <View style={styles.messagesBannerLeft}>
            <View style={[styles.msgIconBadge, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="chatbubbles-outline" size={20} color={theme.primary} />
            </View>
            <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
              <Text style={[styles.messagesBannerTitle, { color: theme.textPrimary }]}>
                Kitchen Communications
              </Text>
              <Text style={[styles.messagesBannerSubtitle, { color: theme.textSecondary }]}>
                Broadcasts, company catering updates &amp; personal alerts
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
            {unreadBroadcastCount > 0 ? (
              <View style={[styles.unreadBadge, { backgroundColor: theme.error, marginRight: 8 }]}>
                <Text style={styles.unreadBadgeText}>{unreadBroadcastCount} New</Text>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </View>
        </TouchableOpacity>

        {/* 3. Designated Drop-off Point & Workplace Info */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DESIGNATED DROP-OFF POINT &amp; WORKPLACE</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          {/* Company (Interactive for Admin/Staff to simulate any company in Customer View) */}
          <TouchableOpacity
            activeOpacity={isAdminOrStaff ? 0.75 : 1}
            disabled={!isAdminOrStaff}
            onPress={() => {
              if (isAdminOrStaff) setIsCompanySimulatorOpen(true);
            }}
            style={styles.fieldRow}
          >
            <View style={styles.fieldLeft}>
              <Ionicons name="business-outline" size={18} color={theme.textPrimary} />
              <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {isAdminOrStaff ? 'Assigned Company (Admin Simulation)' : 'Assigned Company'}
                </Text>
                <Text style={[styles.fieldValue, { color: theme.textPrimary }]} numberOfLines={1}>
                  {userCompany?.companyName || currentUser?.companyName || 'Corporate Partner'}
                </Text>
              </View>
            </View>
            {isAdminOrStaff && (
              <View style={[styles.smallActionBtn, { backgroundColor: theme.primaryMuted, borderColor: theme.primary, borderWidth: 1 }]}>
                <Text style={[styles.smallActionBtnText, { color: theme.primary }]}>
                  Simulate Company
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={[styles.cardDivider, { backgroundColor: theme.surfaceBorder }]} />

          {/* Delivery Location Address */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLeft}>
              <Ionicons name="location-outline" size={18} color={theme.textPrimary} />
              <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Drop-off Location</Text>
                <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                  {currentUser?.locationName || userCompany?.locations[0] || currentUser?.buildingName || 'Corporate Campus'}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.cardDivider, { backgroundColor: theme.surfaceBorder }]} />

          {/* Meal Subsidy Benefit */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLeft}>
              <Ionicons name="pricetag-outline" size={18} color={theme.primary} />
              <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Meal Subsidy Benefit</Text>
                <Text style={[styles.fieldValue, { color: theme.primary, fontWeight: '700' }]}>
                  {userCompany?.discountValue
                    ? userCompany.discountType === 'fixed_zar'
                      ? `R${userCompany.discountValue.toFixed(2)} off per order`
                      : `${userCompany.discountValue}% corporate discount applied`
                    : `R${(userCompany?.mealSubsidyAmount ?? 25).toFixed(2)} covered per meal by company`}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.cardDivider, { backgroundColor: theme.surfaceBorder }]} />

          {/* Delivery Floor (Editable) */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLeft}>
              <Ionicons name="layers-outline" size={18} color={theme.textPrimary} />
              <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Pantry / Floor Drop-off Point</Text>
                <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                  {currentUser?.deliveryFloor || userCompany?.locations[0] || 'Floor 3 (Reception Pantry)'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setIsFloorPickerOpen(true)}
              style={[styles.smallActionBtn, { backgroundColor: theme.chipBg }]}
            >
              <Text style={[styles.smallActionBtnText, { color: theme.textPrimary }]}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. App Preferences & Themes */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APP PREFERENCES</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          {/* Push Notifications */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: theme.textPrimary }]}>Push Notifications</Text>
              <Text style={[styles.switchSubtitle, { color: theme.textSecondary }]}>
                Alerts for 10:00 AM dispatch reminders and 12:00 PM drop-offs
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: theme.inputBorder, true: theme.primary }}
              {...(Platform.OS === 'web' ? ({ activeThumbColor: theme.onPrimary } as object) : {})}
              thumbColor={Platform.OS === 'android' ? theme.textInverse : undefined}
            />
          </View>

          <View style={[styles.cardDivider, { backgroundColor: theme.surfaceBorder }]} />

          {/* Dark Interface Mode */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: theme.textPrimary }]}>Dark Interface Mode</Text>
              <Text style={[styles.switchSubtitle, { color: theme.textSecondary }]}>
                Switch between high-contrast light and dark OLED themes
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
              trackColor={{ false: theme.inputBorder, true: theme.primary }}
              {...(Platform.OS === 'web' ? ({ activeThumbColor: theme.onPrimary } as object) : {})}
              thumbColor={Platform.OS === 'android' ? theme.textInverse : undefined}
            />
          </View>

          <View style={[styles.cardDivider, { backgroundColor: theme.surfaceBorder }]} />

          {/* App Theme Selector (Ink & Cream vs Mediterranean Pantry) */}
          <View style={styles.themeSelectionSection}>
            <Text style={[styles.switchTitle, { color: theme.textPrimary }]}>Brand Theme</Text>
            <Text style={[styles.switchSubtitle, { color: theme.textSecondary, marginBottom: 10 }]}>
              Mediterranean Pantry or Ink &amp; Cream palette
            </Text>

            <View style={styles.themeButtonsRow}>
              {brandThemes.map((bt) => {
                const isSelected = brandTheme === bt.key;
                return (
                  <TouchableOpacity
                    key={bt.key}
                    onPress={() => setBrandTheme(bt.key as BrandTheme)}
                    activeOpacity={0.8}
                    style={[
                      styles.themeCardBtn,
                      {
                        backgroundColor: isSelected ? theme.primaryMuted : theme.chipBg,
                        borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                      },
                    ]}
                  >
                    <View style={[styles.colorSwatch, { backgroundColor: bt.swatch }]} />
                    <Text style={[styles.themeCardBtnText, { color: theme.textPrimary }]}>
                      {bt.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={16} color={theme.primary} style={{ marginLeft: 6 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* 5. Support & Complaints Desk */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SUPPORT &amp; COMPLAINTS</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <TouchableOpacity
            onPress={() => setIsComplaintModalOpen(true)}
            style={styles.menuNavRow}
            activeOpacity={0.7}
          >
            <View style={styles.fieldLeft}>
              <Ionicons name="document-text-outline" size={18} color="#D53220" />
              <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
                <Text style={[styles.menuNavTitle, { color: theme.textPrimary }]}>File a Complaint / Report Issue</Text>
                <Text style={[styles.menuNavSubtitle, { color: theme.textSecondary }]}>
                  Order not arrived, missing meal, or delivery inquiry
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>

          <View style={[styles.cardDivider, { backgroundColor: theme.surfaceBorder }]} />

          <TouchableOpacity
            onPress={() => setIsPolicyOpen(true)}
            style={styles.menuNavRow}
            activeOpacity={0.7}
          >
            <View style={styles.fieldLeft}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.textPrimary} />
              <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
                <Text style={[styles.menuNavTitle, { color: theme.textPrimary }]}>Cancellation &amp; Cutoff Policy</Text>
                <Text style={[styles.menuNavSubtitle, { color: theme.textSecondary }]}>
                  9:00 AM SAST, two business days before delivery
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>

          <View style={[styles.cardDivider, { backgroundColor: theme.surfaceBorder }]} />

          <TouchableOpacity
            onPress={handleSupportContact}
            style={styles.menuNavRow}
            activeOpacity={0.7}
          >
            <View style={styles.fieldLeft}>
              <Ionicons name="help-buoy-outline" size={18} color={theme.textPrimary} />
              <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
                <Text style={[styles.menuNavTitle, { color: theme.textPrimary }]}>Contact Kitchen Desk</Text>
                <Text style={[styles.menuNavSubtitle, { color: theme.textSecondary }]}>
                  supportykc@csggroup.co.za • +27 11 883 0000
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          onPress={handleSignOutPress}
          activeOpacity={0.8}
          style={[styles.signOutButton, { borderColor: theme.error, backgroundColor: theme.errorSurface }]}
        >
          <Ionicons name="log-out-outline" size={18} color={theme.error} />
          <Text style={[styles.signOutButtonText, { color: theme.error }]}>Sign Out of Kitchen Co.</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ═══════════════════════════════════════════════
          MODAL 1: AVATAR PICKER
         ═══════════════════════════════════════════════ */}
      <Modal visible={isAvatarModalOpen} transparent animationType="fade" onRequestClose={() => setIsAvatarModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Choose Profile Avatar</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Pick a lightweight avatar preset for your culinary profile:
            </Text>

            <View style={styles.avatarGrid}>
              {AVATARS.map((av) => {
                const isSelected = selectedAvatar.id === av.id;
                return (
                  <TouchableOpacity
                    key={av.id}
                    onPress={() => handleAvatarSelect(av.id)}
                    style={[
                      styles.avatarGridTile,
                      {
                        backgroundColor: isSelected ? theme.primaryMuted : theme.chipBg,
                        borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 36 }}>{av.emoji}</Text>
                    {isSelected && (
                      <View style={[styles.avatarSelectedBadge, { backgroundColor: theme.primary }]}>
                        <Ionicons name="checkmark" size={10} color={theme.textInverse} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setIsAvatarModalOpen(false)}
              style={[styles.modalCloseBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.modalCloseBtnText, { color: theme.textInverse }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════
          MODAL 2: 1-WAY MESSAGES INBOX (3 CHANNELS)
         ═══════════════════════════════════════════════ */}
      <Modal visible={isMessagesModalOpen} transparent animationType="slide" onRequestClose={() => setIsMessagesModalOpen(false)}>
        <View style={styles.modalOverlayBottom}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={styles.sheetHeaderRow}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Kitchen Messages</Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>
                  One-way operational updates from head kitchen
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsMessagesModalOpen(false)} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* 3 Channels Switcher */}
            <View style={[styles.channelBar, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}>
              <TouchableOpacity
                onPress={() => setMessageChannel('kitchenco')}
                style={[styles.channelBtn, messageChannel === 'kitchenco' && [styles.channelBtnActive, { backgroundColor: theme.primary }]]}
              >
                <Text style={[styles.channelBtnText, { color: messageChannel === 'kitchenco' ? theme.textInverse : theme.textSecondary }]}>
                  KitchenCo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMessageChannel('company')}
                style={[styles.channelBtn, messageChannel === 'company' && [styles.channelBtnActive, { backgroundColor: theme.primary }]]}
              >
                <Text style={[styles.channelBtnText, { color: messageChannel === 'company' ? theme.textInverse : theme.textSecondary }]} numberOfLines={1}>
                  {userCompany?.companyName ? userCompany.companyName.split(' ')[0] : 'Company'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMessageChannel('me')}
                style={[styles.channelBtn, messageChannel === 'me' && [styles.channelBtnActive, { backgroundColor: theme.primary }]]}
              >
                <Text style={[styles.channelBtnText, { color: messageChannel === 'me' ? theme.textInverse : theme.textSecondary }]}>
                  Me (Personal)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Admin-Only Company Simulation Bar inside Messages Modal */}
            {isAdminOrStaff && messageChannel === 'company' && (
              <View style={{ marginTop: 10, gap: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.brandGold }}>
                  ADMIN PREVIEW — SIMULATE COMPANY INBOX:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {corporateAccounts.map((comp) => {
                    const active = userCompany?.id === comp.id;
                    return (
                      <TouchableOpacity
                        key={comp.id}
                        onPress={() => handleSimulateCompany(comp.id)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 12,
                          borderWidth: 1,
                          backgroundColor: active ? theme.primary : theme.chipBg,
                          borderColor: active ? theme.primary : theme.surfaceBorder,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: active ? theme.textInverse : theme.textSecondary,
                          }}
                        >
                          {comp.companyName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Messages Feed */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380, marginTop: 12 }}>
              {filteredMessages.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ color: theme.textMuted }}>No messages in this channel.</Text>
                </View>
              ) : (
                filteredMessages.map((msg) => (
                  <View key={msg.id} style={[styles.messageCard, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}>
                    <View style={styles.messageHeaderRow}>
                      <Text style={[styles.messageTitle, { color: theme.textPrimary }]}>{msg.title}</Text>
                      <Text style={[styles.messageTime, { color: theme.textMuted }]}>{msg.sentAt}</Text>
                    </View>
                    <Text style={[styles.messageBody, { color: theme.textSecondary }]}>{msg.body}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════
          MODAL 3: FILE A COMPLAINT
         ═══════════════════════════════════════════════ */}
      <Modal visible={isComplaintModalOpen} transparent animationType="slide" onRequestClose={() => setIsComplaintModalOpen(false)}>
        <View style={styles.modalOverlayBottom}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>File a Complaint / Report</Text>
              <TouchableOpacity onPress={() => setIsComplaintModalOpen(false)} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Problem Category</Text>
              <View style={styles.complaintOptionsRow}>
                <TouchableOpacity
                  onPress={() => setComplaintType('order_not_arrived')}
                  style={[
                    styles.complaintTypeBtn,
                    {
                      backgroundColor: complaintType === 'order_not_arrived' ? theme.primaryMuted : theme.chipBg,
                      borderColor: complaintType === 'order_not_arrived' ? theme.primary : theme.surfaceBorder,
                    },
                  ]}
                >
                  <Text style={[styles.complaintTypeBtnText, { color: theme.textPrimary }]}>Order Not Arrived</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setComplaintType('cancellation')}
                  style={[
                    styles.complaintTypeBtn,
                    {
                      backgroundColor: complaintType === 'cancellation' ? theme.primaryMuted : theme.chipBg,
                      borderColor: complaintType === 'cancellation' ? theme.primary : theme.surfaceBorder,
                    },
                  ]}
                >
                  <Text style={[styles.complaintTypeBtnText, { color: theme.textPrimary }]}>Cancellation Request</Text>
                </TouchableOpacity>
              </View>

              {complaintType === 'cancellation' ? (
                <View style={[styles.cancellationWarningBox, { backgroundColor: theme.goldWarningSurface, borderColor: theme.goldWarningBorder }]}>
                  <Text style={[styles.cancellationWarningTitle, { color: theme.textPrimary }]}>
                    ⚠️ Orders Cannot Be Cancelled
                  </Text>
                  <Text style={[styles.cancellationWarningText, { color: theme.textSecondary }]}>
                    Kitchen Co. prepares meals on an exact corporate zero-waste schedule. Tap below to review the full policy.
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setIsComplaintModalOpen(false);
                      setIsPolicyOpen(true);
                    }}
                    style={[styles.viewPolicyBtn, { backgroundColor: theme.primary }]}
                  >
                    <Text style={[styles.viewPolicyBtnText, { color: theme.textInverse }]}>View Cancellation Policy</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={[styles.formLabel, { color: theme.textSecondary, marginTop: 14 }]}>
                    Related Order ID
                  </Text>
                  <View style={[styles.orderPickerContainer, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}>
                    <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>
                      {orderHistory[0]?.orderNumber || 'ORD-2026-TODAY'}
                    </Text>
                    <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                      {orderHistory[0]?.deliveryDateFormatted || 'Latest Order'}
                    </Text>
                  </View>

                  <Text style={[styles.formLabel, { color: theme.textSecondary, marginTop: 14 }]}>
                    Details of the Issue
                  </Text>
                  <TextInput
                    value={complaintBody}
                    onChangeText={setComplaintBody}
                    placeholder="Describe what occurred with your delivery or drop-off floor..."
                    placeholderTextColor={theme.textMuted}
                    multiline
                    numberOfLines={4}
                    style={[styles.complaintInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                  />

                  <TouchableOpacity
                    onPress={handleSubmitComplaint}
                    style={[styles.submitComplaintBtn, { backgroundColor: theme.primary }]}
                  >
                    <Text style={[styles.submitComplaintBtnText, { color: theme.textInverse }]}>
                      LODGE TICKET FOR INVESTIGATION
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Floor Picker Modal */}
      <FloorPickerModal
        visible={isFloorPickerOpen}
        selectedFloor={currentUser?.deliveryFloor || 'Floor 3 (Reception Pantry)'}
        availableFloors={availableFloors}
        onSelectFloor={async (floor) => {
          await updateDropoffFloor(floor);
          setIsFloorPickerOpen(false);
        }}
        onClose={() => setIsFloorPickerOpen(false)}
      />

      {/* Cancellation Policy Modal */}
      <CancellationPolicyModal
        visible={isPolicyOpen}
        onClose={() => setIsPolicyOpen(false)}
      />

      {/* ═══════════════════════════════════════════════
          MODAL 3B: ADMIN COMPANY SIMULATOR MODAL (ADMIN ONLY)
         ═══════════════════════════════════════════════ */}
      <Modal
        visible={isCompanySimulatorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCompanySimulatorOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder, maxWidth: 400 }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Simulate Corporate Partner
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Admin Preview: Select which company you want to simulate in Customer View (updates broadcasts, drop-off locations, discounts &amp; delivery fees).
            </Text>

            <ScrollView style={{ width: '100%', maxHeight: 300, marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
              {corporateAccounts.map((comp) => {
                const isSelected = userCompany?.id === comp.id;
                return (
                  <TouchableOpacity
                    key={comp.id}
                    activeOpacity={0.8}
                    onPress={() => handleSimulateCompany(comp.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      backgroundColor: isSelected ? theme.primaryMuted : theme.surface,
                      borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                      gap: 10,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: isSelected ? theme.primary : theme.textPrimary,
                        }}
                        numberOfLines={1}
                      >
                        🏢 {comp.companyName}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textSecondary }} numberOfLines={1}>
                        📍 {comp.locations.length} {comp.locations.length === 1 ? 'location' : 'locations'} •{' '}
                        {comp.discountValue ? `${comp.discountValue}% Off` : 'Standard'}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setIsCompanySimulatorOpen(false)}
              style={[styles.modalCloseBtn, { backgroundColor: theme.chipBg, borderWidth: 1, borderColor: theme.surfaceBorder }]}
            >
              <Text style={[styles.modalCloseBtnText, { color: theme.textPrimary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════
          MODAL 4: SIGN OUT CONFIRMATION (WEB & NATIVE)
         ═══════════════════════════════════════════════ */}
      <Modal
        visible={isSignOutModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSignOutModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <View style={[styles.confirmModalIcon, { backgroundColor: theme.errorSurface }]}>
              <Ionicons name="log-out-outline" size={28} color={theme.error} />
            </View>
            <Text style={[styles.confirmModalTitle, { color: theme.textPrimary }]}>
              Sign Out of Kitchen Co.
            </Text>
            <Text style={[styles.confirmModalDesc, { color: theme.textSecondary }]}>
              Are you sure you want to sign out? You will need to sign in again to place orders and manage your workplace meal deliveries.
            </Text>
            <View style={styles.confirmModalBtnRow}>
              <TouchableOpacity
                onPress={() => setIsSignOutModalOpen(false)}
                activeOpacity={0.8}
                style={[styles.confirmModalCancelBtn, { borderColor: theme.surfaceBorder, backgroundColor: theme.chipBg }]}
              >
                <Text style={[styles.confirmModalCancelText, { color: theme.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmSignOut}
                activeOpacity={0.8}
                style={[styles.confirmModalActionBtn, { backgroundColor: theme.error }]}
              >
                <Text style={styles.confirmModalActionText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: typography.heading,
  },
  adminCommandPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminCommandPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    paddingTop: 12,
    gap: 16,
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  fullName: {
    fontSize: 17,
    fontWeight: '700',
  },
  emailText: {
    fontSize: 12,
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  messagesBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messagesBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  msgIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  messagesBannerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 4,
    marginBottom: -8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  smallActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  smallActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    marginVertical: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchSubtitle: {
    fontSize: 11,
    marginTop: 2,
    maxWidth: 240,
  },
  themeSelectionSection: {
    paddingVertical: 4,
  },
  themeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 6,
  },
  themeCardBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  menuNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  menuNavTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuNavSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
  },
  signOutButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: typography.heading,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarGridTile: {
    width: 68,
    height: 68,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTileLabel: {
    fontSize: 9,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: '100%',
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: typography.heading,
  },
  sheetSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  channelBar: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 3,
  },
  channelBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelBtnActive: {},
  channelBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  messageCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  messageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  messageTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  messageTime: {
    fontSize: 10,
  },
  messageBody: {
    fontSize: 11,
    lineHeight: 15,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  complaintOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  complaintTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  complaintTypeBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cancellationWarningBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    alignItems: 'center',
  },
  cancellationWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  cancellationWarningText: {
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 8,
    lineHeight: 15,
  },
  viewPolicyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  viewPolicyBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  orderPickerContainer: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  complaintInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    height: 80,
    textAlignVertical: 'top',
    fontSize: 12,
  },
  submitComplaintBtn: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  submitComplaintBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  avatarSelectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmModalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: typography.heading,
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmModalDesc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmModalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmModalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalCancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmModalActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

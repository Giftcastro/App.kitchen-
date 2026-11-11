import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { EmailRoutingDirectory } from '../../types';
import {
  fetchEmailRoutingDirectoryFromDb,
  saveEmailRoutingDirectoryToDb,
  fetchPlatformSetting,
  savePlatformSetting,
  sendManifestNowFromDb,
  ManifestRun,
} from '../../services/supabaseDataService';

const EMAIL_DIRECTORY_STORAGE_KEY = '@kitchenco_email_routing_directory';

const DEFAULT_EMAIL_DIRECTORY: EmailRoutingDirectory = {
  helpSupport: 'supportykc@csggroup.co.za',
  billingInvoices: 'invoicesykc@csggroup.co.za',
  kitchen: 'kitchenykc@csggroup.co.za',
  appSender: 'iwantykc@csggroup.co.za',
  adminBackup: 'iwantykc@csggroup.co.za',
  platformMaster: 'techykc@csggroup.co.za',
};

const DIRECTORY_FIELDS: { key: keyof EmailRoutingDirectory; label: string }[] = [
  { key: 'helpSupport', label: 'Help & support' },
  { key: 'billingInvoices', label: 'Billing & invoices' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'appSender', label: 'App sender' },
  { key: 'adminBackup', label: 'Admin backup' },
  { key: 'platformMaster', label: 'Platform master' },
];

export const AdminSettingsTab: React.FC = () => {
  const { theme, isDark, setThemeMode, brandTheme, setBrandTheme } = useTheme();
  const { currentUser, signOut } = useAuth();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [lastManifestRun, setLastManifestRun] = useState<ManifestRun | null>(null);
  const [dispatchEmail, setDispatchEmail] = useState('kitchenykc@csggroup.co.za');
  const [isSaved, setIsSaved] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);

  // Editable Official YKC Email Routing Directory state
  const [emailDirectory, setEmailDirectory] = useState<EmailRoutingDirectory>(DEFAULT_EMAIL_DIRECTORY);
  const [isEditingDirectory, setIsEditingDirectory] = useState(false);
  const [isDirectorySaved, setIsDirectorySaved] = useState(false);

  useEffect(() => {
    fetchPlatformSetting<string>('dispatch_email').then((saved) => {
      if (saved) setDispatchEmail(saved);
    });
    fetchPlatformSetting<ManifestRun>('manifest_last_run').then(setLastManifestRun);

    const loadDirectory = async () => {
      const localJson = await AsyncStorage.getItem(EMAIL_DIRECTORY_STORAGE_KEY);
      if (localJson) {
        try {
          const parsed = JSON.parse(localJson);
          setEmailDirectory({ ...DEFAULT_EMAIL_DIRECTORY, ...parsed });
        } catch {
          // ignore parse error
        }
      }
      const dbDir = await fetchEmailRoutingDirectoryFromDb();
      if (dbDir) {
        setEmailDirectory(dbDir);
        await AsyncStorage.setItem(EMAIL_DIRECTORY_STORAGE_KEY, JSON.stringify(dbDir));
      }
    };
    loadDirectory();
  }, []);

  const handleSaveEmail = async () => {
    if (!dispatchEmail.trim() || !dispatchEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!(await savePlatformSetting('dispatch_email', dispatchEmail.trim()))) {
      Alert.alert('Not Saved', 'The address could not be saved. Please try again.');
      return;
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
    Alert.alert(
      'Configuration Saved ✓',
      `The 9:00 AM kitchen manifest will be emailed to every chef account and ${dispatchEmail.trim()}.`
    );
  };

  const handleSaveDirectory = async () => {
    // Validate that all entries are non-empty email addresses
    for (const field of DIRECTORY_FIELDS) {
      const val = (emailDirectory[field.key] || '').trim();
      if (!val || !val.includes('@')) {
        Alert.alert('Invalid Routing Email', `Please enter a valid email address for "${field.label}".`);
        return;
      }
    }

    const cleaned: EmailRoutingDirectory = {
      helpSupport: emailDirectory.helpSupport.trim(),
      billingInvoices: emailDirectory.billingInvoices.trim(),
      kitchen: emailDirectory.kitchen.trim(),
      appSender: emailDirectory.appSender.trim(),
      adminBackup: emailDirectory.adminBackup.trim(),
      platformMaster: emailDirectory.platformMaster.trim(),
    };

    setEmailDirectory(cleaned);
    await AsyncStorage.setItem(EMAIL_DIRECTORY_STORAGE_KEY, JSON.stringify(cleaned));
    await saveEmailRoutingDirectoryToDb(cleaned);

    setIsEditingDirectory(false);
    setIsDirectorySaved(true);
    setTimeout(() => setIsDirectorySaved(false), 2500);

    Alert.alert(
      'Routing Directory Updated ✓',
      'Official YKC Email Routing Directory has been updated and saved.'
    );
  };

  const handleSendTestPing = async () => {
    const result = await sendManifestNowFromDb();
    fetchPlatformSetting<ManifestRun>('manifest_last_run').then(setLastManifestRun);
    Alert.alert('Kitchen Manifest', result);
  };

  const handleSignOut = () => {
    setIsSignOutModalOpen(true);
  };

  const handleConfirmSignOut = async () => {
    setIsSignOutModalOpen(false);
    await signOut();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* 1. Admin Account Card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
        <View style={styles.accountRow}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.brandGold }]}>
            <Text style={{ fontSize: 18, color: theme.onBrandGold, fontWeight: '800' }}>
              {(currentUser?.fullName || 'Admin')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[styles.accountName, { color: theme.textPrimary }]} numberOfLines={1}>
              {currentUser?.fullName || 'Kitchen Co Administrator'}
            </Text>
            <Text style={[styles.accountRole, { color: theme.brandGold }]}>
              Admin · System Administrator
            </Text>
            <Text style={[styles.accountEmail, { color: theme.textSecondary }]} numberOfLines={1}>
              {currentUser?.email || 'iwantykc@csggroup.co.za'}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Communication & Dispatch Configuration */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="mail" size={18} color={theme.brandGold} />
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
            Central Dispatch &amp; Notification Routing
          </Text>
        </View>
        <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>
          Where morning 9:00 AM kitchen manifests, order notifications, customer complaints, and cancellation requests are sent:
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.brandGold }]}>
            Target Communication Email:
          </Text>
          <TextInput
            value={dispatchEmail}
            onChangeText={setDispatchEmail}
            keyboardType="email-address"
            placeholder="kitchenykc@csggroup.co.za"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.surfaceBorder, color: theme.textPrimary }]}
          />
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSaveEmail}
            style={[styles.saveEmailBtn, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="checkmark-circle-outline" size={15} color={theme.textInverse} />
            <Text style={[styles.saveEmailBtnText, { color: theme.textInverse }]}>
              {isSaved ? 'Saved ✓' : 'Save Routing Email'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSendTestPing}
            style={[styles.testPingBtn, { backgroundColor: theme.brandGold }]}
          >
            <Ionicons name="paper-plane-outline" size={14} color={theme.onBrandGold} />
            <Text style={[styles.testPingText, { color: theme.onBrandGold }]}>Test Ping</Text>
          </TouchableOpacity>
        </View>

        {/* Editable Official YKC Email Routing Directory */}
        <View style={[styles.manifestScheduleBox, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder, borderWidth: 1 }]}>
          <View style={styles.directoryHeaderRow}>
            <Text style={[styles.manifestBoxTitle, { color: theme.textPrimary, flex: 1 }]}>
              📬 Official YKC Email Routing Directory
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (isEditingDirectory) {
                  handleSaveDirectory();
                } else {
                  setIsEditingDirectory(true);
                }
              }}
              style={[
                styles.editDirectoryToggleBtn,
                {
                  backgroundColor: isEditingDirectory ? theme.primary : theme.surface,
                  borderColor: isEditingDirectory ? theme.primary : theme.brandGold,
                },
              ]}
            >
              <Ionicons
                name={isEditingDirectory ? 'checkmark-circle-outline' : 'create-outline'}
                size={13}
                color={isEditingDirectory ? theme.textInverse : theme.brandGold}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: isEditingDirectory ? theme.textInverse : theme.brandGold,
                }}
              >
                {isEditingDirectory ? 'Save All' : isDirectorySaved ? 'Saved ✓' : 'Edit Emails'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 8, marginTop: 4 }}>
            {DIRECTORY_FIELDS.map((field) => (
              <View key={field.key} style={styles.directoryFieldRow}>
                <Text style={[styles.directoryFieldLabel, { color: theme.brandGold }]}>
                  • {field.label}:
                </Text>
                {isEditingDirectory ? (
                  <TextInput
                    value={emailDirectory[field.key]}
                    onChangeText={(txt) =>
                      setEmailDirectory((prev) => ({ ...prev, [field.key]: txt }))
                    }
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="email@csggroup.co.za"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.directoryInput,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.surfaceBorder,
                        color: theme.textPrimary,
                      },
                    ]}
                  />
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setIsEditingDirectory(true)}
                    style={styles.directoryStaticValueWrap}
                  >
                    <Text style={[styles.directoryStaticValue, { color: theme.textPrimary }]} numberOfLines={1}>
                      {emailDirectory[field.key]}
                    </Text>
                    <Ionicons name="pencil-outline" size={11} color={theme.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {isEditingDirectory && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsEditingDirectory(false)}
                style={[styles.dirActionBtn, { borderColor: theme.surfaceBorder, backgroundColor: theme.surface }]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSaveDirectory}
                style={[styles.dirActionBtn, { borderColor: theme.primary, backgroundColor: theme.primary, flex: 1.5 }]}
              >
                <Ionicons name="save-outline" size={13} color={theme.textInverse} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textInverse }}>
                  Save Routing Directory
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={[styles.manifestScheduleBox, { backgroundColor: theme.chipBg }]}>
          <Text style={[styles.manifestBoxTitle, { color: theme.textPrimary }]}>
            ⏰ 9:00 AM Automated Kitchen Batch Manifests
          </Text>
          <Text style={[styles.manifestBoxDesc, { color: theme.textSecondary }]}>
            At 09:00 SAST on weekdays, the server compiles the day&apos;s Production Sheet and Delivery Notes and emails them to every chef account and the configured address. At 10:00 AM it marks the day&apos;s orders Out for Delivery and notifies those customers in the app.
            {'\n\n'}
            {lastManifestRun
              ? `Last run: ${new Date(lastManifestRun.at).toLocaleString('en-ZA')} (${lastManifestRun.date}): ${lastManifestRun.status}, ${lastManifestRun.orders} orders, ${lastManifestRun.meals} meals.`
              : 'No manifest has run yet.'}
          </Text>
        </View>
      </View>

      {/* 3. App Theme & Appearance Preferences */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="color-palette-outline" size={18} color={theme.brandGold} />
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>App Preferences</Text>
        </View>

        {/* Push Notifications Toggle */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: theme.textPrimary }]}>Push Notifications</Text>
            <Text style={[styles.toggleDesc, { color: theme.textSecondary }]}>
              Alerts for new checkouts and morning kitchen batch readiness
            </Text>
          </View>
          <Switch
            value={pushNotifications}
            onValueChange={setPushNotifications}
            trackColor={{ false: 'rgba(150, 150, 150, 0.3)', true: theme.primary }}
            {...(Platform.OS === 'web' ? ({ activeThumbColor: theme.onPrimary } as object) : {})}
          />
        </View>

        {/* Dark Interface Mode Toggle */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: theme.textPrimary }]}>Dark Interface Mode</Text>
            <Text style={[styles.toggleDesc, { color: theme.textSecondary }]}>
              Switch between light linen and deep obsidian display
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
            trackColor={{ false: 'rgba(150, 150, 150, 0.3)', true: theme.primary }}
            {...(Platform.OS === 'web' ? ({ activeThumbColor: theme.onPrimary } as object) : {})}
          />
        </View>

        {/* Brand Theme Selector */}
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Brand Color Theme:</Text>
          <View style={styles.swatchesRow}>
            {/* Theme 1: Ink & Cream */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setBrandTheme('Current')}
              style={[
                styles.swatchCard,
                { backgroundColor: theme.surfaceElevated, borderColor: brandTheme === 'Current' ? theme.primary : theme.surfaceBorder },
              ]}
            >
              <View style={[styles.swatchPreview, { backgroundColor: '#121212' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.swatchTitle, { color: theme.textPrimary }]}>
                  {brandTheme === 'Current' ? '✓ ' : ''}Ink &amp; Cream
                </Text>
                <Text style={[styles.swatchSubtitle, { color: theme.textSecondary }]}>
                  Classic executive slate &amp; warm linen
                </Text>
              </View>
            </TouchableOpacity>

            {/* Theme 2: Mediterranean Pantry */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setBrandTheme('MediterraneanPantry')}
              style={[
                styles.swatchCard,
                { backgroundColor: theme.surfaceElevated, borderColor: brandTheme === 'MediterraneanPantry' ? theme.primary : theme.surfaceBorder },
              ]}
            >
              <View style={[styles.swatchPreview, { backgroundColor: '#D53220' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.swatchTitle, { color: theme.textPrimary }]}>
                  {brandTheme === 'MediterraneanPantry' ? '✓ ' : ''}Mediterranean Pantry
                </Text>
                <Text style={[styles.swatchSubtitle, { color: theme.textSecondary }]}>
                  Rich crimson &amp; golden olive notes
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 4. Sign Out */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleSignOut}
        style={[styles.signOutBtn, { borderColor: theme.error, backgroundColor: theme.surface }]}
      >
        <Ionicons name="log-out-outline" size={16} color={theme.error} />
        <Text style={[styles.signOutText, { color: theme.error }]}>Sign Out of Admin</Text>
      </TouchableOpacity>

      {/* Sign Out Confirmation Modal (Web & Native) */}
      <Modal
        visible={isSignOutModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSignOutModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
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
          <View style={[styles.confirmModalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <View style={[styles.confirmModalIcon, { backgroundColor: theme.errorSurface }]}>
              <Ionicons name="log-out-outline" size={28} color={theme.error} />
            </View>
            <Text style={[styles.confirmModalTitle, { color: theme.textPrimary }]}>
              Sign Out of Admin
            </Text>
            <Text style={[styles.confirmModalDesc, { color: theme.textSecondary }]}>
              Are you sure you want to sign out from the Admin portal? You will be redirected to the sign-in portal.
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
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    fontSize: 16,
    fontWeight: '800',
  },
  accountRole: {
    fontSize: 11,
    fontWeight: '700',
  },
  accountEmail: {
    fontSize: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  input: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveEmailBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 8,
  },
  saveEmailBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  testPingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 8,
  },
  testPingText: {
    fontSize: 12,
    fontWeight: '800',
  },
  manifestScheduleBox: {
    padding: 12,
    borderRadius: 10,
    gap: 6,
  },
  directoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  editDirectoryToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  directoryFieldRow: {
    gap: 4,
  },
  directoryFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  directoryInput: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  directoryStaticValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 10,
    paddingVertical: 2,
    gap: 6,
  },
  directoryStaticValue: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  dirActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
  },
  manifestBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  manifestBoxDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleDesc: {
    fontSize: 11,
  },
  swatchesRow: {
    gap: 10,
  },
  swatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  swatchPreview: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  swatchTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  swatchSubtitle: {
    fontSize: 11,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
});

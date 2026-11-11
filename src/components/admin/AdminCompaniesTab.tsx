import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme/ThemeContext';
import { useCart } from '../../context/CartContext';
import { CorporateAccount } from '../../types';
import { sendBroadcastMessageToDb } from '../../services/supabaseDataService';

interface ExtendedCompany extends CorporateAccount {
  isActive?: boolean;
  billingEmail?: string;
  mealSubsidyAmount?: number;
  deliveryFeeMode?: 'free' | 'flat' | 'distance';
  flatFeeAmount?: number;
}

export const AdminCompaniesTab: React.FC = () => {
  const { theme, isDark } = useTheme();
  const {
    corporateAccounts,
    addCorporateAccount,
    updateCorporateAccountDiscount,
    updateCorporateAccountDetails,
    ensureCorporateAccountsLoaded,
    refreshBroadcasts,
  } = useCart();

  // Track which company cards are expanded (compressed by default, like OrdersScreen)
  const [expandedCompanyIds, setExpandedCompanyIds] = useState<Set<string>>(new Set());

  const toggleCompanyExpand = (companyId: string) => {
    setExpandedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  // Local state initialized from corporateAccounts with fallback extensions
  const [companies, setCompanies] = useState<ExtendedCompany[]>(() =>
    corporateAccounts.map((c) => ({
      ...c,
      isActive: c.isActive !== false,
      billingEmail:
        c.billingEmail || `accounts@${c.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.co.za`,
      mealSubsidyAmount: c.mealSubsidyAmount ?? 0.0,
      deliveryFeeMode: c.deliveryFeeMode || 'distance',
      flatFeeAmount: c.flatFeeAmount ?? 20.0,
    }))
  );

  useEffect(() => {
    if (corporateAccounts.length > 0) {
      setCompanies((prev) =>
        corporateAccounts.map((c) => {
          const existing = prev.find((p) => p.id === c.id);
          return {
            ...c,
            isActive: c.isActive ?? existing?.isActive ?? true,
            billingEmail:
              c.billingEmail ||
              existing?.billingEmail ||
              `accounts@${c.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.co.za`,
            mealSubsidyAmount: c.mealSubsidyAmount ?? existing?.mealSubsidyAmount ?? 0.0,
            deliveryFeeMode: c.deliveryFeeMode || existing?.deliveryFeeMode || 'distance',
            flatFeeAmount: c.flatFeeAmount ?? existing?.flatFeeAmount ?? 20.0,
          };
        })
      );
    }
  }, [corporateAccounts]);

  const saveOrRestore = async (save: () => Promise<void>): Promise<boolean> => {
    try {
      await save();
      return true;
    } catch (e: any) {
      await ensureCorporateAccountsLoaded(true);
      Alert.alert('Not Saved', e?.message || 'The change could not be saved. Please try again.');
      return false;
    }
  };

  // Financials Modal
  const [isFinancialsModalOpen, setIsFinancialsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<ExtendedCompany | null>(null);
  const [subsidyInput, setSubsidyInput] = useState('');
  const [discountTypeInput, setDiscountTypeInput] = useState<'percentage' | 'fixed_zar' | 'none'>('percentage');
  const [discountValInput, setDiscountValInput] = useState('');

  // Delivery Fee Modal (with customizable Flat Fee)
  const [isDeliveryFeeModalOpen, setIsDeliveryFeeModalOpen] = useState(false);
  const [selectedFeeMode, setSelectedFeeMode] = useState<'free' | 'flat' | 'distance'>('distance');
  const [flatFeeInput, setFlatFeeInput] = useState('20.00');

  // Add Company Modal (with multiple office locations)
  const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newBillingEmail, setNewBillingEmail] = useState('');
  const [newLocations, setNewLocations] = useState<string[]>(['']);
  const [newDistanceKm, setNewDistanceKm] = useState('10.0');

  // Manage Locations Modal for existing company
  const [isLocationsModalOpen, setIsLocationsModalOpen] = useState(false);
  const [editingLocationsList, setEditingLocationsList] = useState<string[]>(['']);

  // Open Financials Modal
  const handleOpenFinancials = (company: ExtendedCompany) => {
    setEditingCompany(company);
    setSubsidyInput(String(company.mealSubsidyAmount ?? 0));
    setDiscountTypeInput((company.discountType as any) || 'percentage');
    setDiscountValInput(String(company.discountValue ?? 10));
    setIsFinancialsModalOpen(true);
  };

  // Save Financials & Broadcast Alert to Company members
  const handleSaveFinancials = async () => {
    if (!editingCompany) return;
    const subsidy = parseFloat(subsidyInput) || 0;
    const discountVal = parseFloat(discountValInput) || 0;

    const updatedCompanies = companies.map((c) => {
      if (c.id === editingCompany.id) {
        return {
          ...c,
          mealSubsidyAmount: subsidy,
          discountType: discountTypeInput === 'none' ? undefined : discountTypeInput,
          discountValue: discountTypeInput === 'none' ? 0 : discountVal,
        };
      }
      return c;
    });

    setCompanies(updatedCompanies);
    setIsFinancialsModalOpen(false);

    // Persist discount & financials to Supabase DB + CartContext
    const effectiveType = discountTypeInput === 'fixed_zar' ? 'fixed_zar' : 'percentage';
    const effectiveVal = discountTypeInput === 'none' ? 0 : discountVal;
    const financialsSaved = await saveOrRestore(async () => {
      await updateCorporateAccountDiscount(editingCompany.id, effectiveType, effectiveVal);
      await updateCorporateAccountDetails(editingCompany.id, {
        mealSubsidyAmount: subsidy,
        discountType: effectiveType,
        discountValue: effectiveVal,
      });
    });
    if (!financialsSaved) return;

    const discountSummary =
      discountTypeInput === 'percentage'
        ? `${discountVal}% order discount`
        : discountTypeInput === 'fixed_zar'
        ? `R${discountVal.toFixed(2)} order discount`
        : 'no discount';

    // Dispatch live broadcast alert to company members in Supabase
    await sendBroadcastMessageToDb(
      `Updated Corporate Meal Benefits — ${editingCompany.companyName}`,
      `Per-Meal Subsidy: R${subsidy.toFixed(2)} • Corporate Discount: ${discountSummary}. Automatically applied at checkout.`,
      editingCompany.companyName
    );
    await refreshBroadcasts();

    Alert.alert(
      'Financials Updated & Broadcast Dispatched 📢',
      `Corporate benefit updated for ${editingCompany.companyName}:\n• Per-Meal Subsidy: R${subsidy.toFixed(2)}\n• Corporate Discount: ${discountSummary}\n\n✓ An alert notification has been sent to all registered staff members of ${editingCompany.companyName} announcing their updated meal benefits!`,
      [{ text: 'OK' }]
    );
  };

  // Open Delivery Fee Modal
  const handleOpenDeliveryFee = (company: ExtendedCompany) => {
    setEditingCompany(company);
    setSelectedFeeMode(company.deliveryFeeMode || 'distance');
    setFlatFeeInput(
      company.flatFeeAmount && company.flatFeeAmount > 0
        ? company.flatFeeAmount.toFixed(2)
        : '20.00'
    );
    setIsDeliveryFeeModalOpen(true);
  };

  const handleSaveDeliveryFeeMode = async (overrideMode?: 'free' | 'flat' | 'distance') => {
    if (!editingCompany) return;
    const mode = overrideMode || selectedFeeMode;
    const parsedFlat = parseFloat(flatFeeInput);
    const flat = mode === 'flat' ? (isNaN(parsedFlat) || parsedFlat < 0 ? 20.0 : parsedFlat) : 0;

    setCompanies((prev) =>
      prev.map((c) =>
        c.id === editingCompany.id ? { ...c, deliveryFeeMode: mode, flatFeeAmount: flat } : c
      )
    );
    setIsDeliveryFeeModalOpen(false);

    const feeSaved = await saveOrRestore(() =>
      updateCorporateAccountDetails(editingCompany.id, {
        deliveryFeeMode: mode,
        flatFeeAmount: flat,
        distanceKm: mode === 'free' ? 0 : editingCompany.distanceKm || 10,
      })
    );
    if (!feeSaved) return;

    const summary =
      mode === 'free'
        ? 'Free Delivery'
        : mode === 'flat'
        ? `Custom Flat Fee of R${flat.toFixed(2)}`
        : `Distance Tiers (${editingCompany.distanceKm.toFixed(1)} km)`;

    Alert.alert('Delivery Fee Updated', `${editingCompany.companyName} delivery setting updated to: ${summary}.`);
  };

  // Open Manage Locations Modal for an existing company
  const handleOpenManageLocations = (company: ExtendedCompany) => {
    setEditingCompany(company);
    setEditingLocationsList(
      company.locations && company.locations.length > 0 ? [...company.locations] : ['']
    );
    setIsLocationsModalOpen(true);
  };

  const handleSaveLocations = async () => {
    if (!editingCompany) return;
    const cleaned = editingLocationsList.map((l) => l.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      Alert.alert('Location Required', 'Please specify at least one delivery office location.');
      return;
    }

    setCompanies((prev) =>
      prev.map((c) => (c.id === editingCompany.id ? { ...c, locations: cleaned } : c))
    );
    setIsLocationsModalOpen(false);

    const locationsSaved = await saveOrRestore(() =>
      updateCorporateAccountDetails(editingCompany.id, {
        locations: cleaned,
      })
    );
    if (!locationsSaved) return;
    await ensureCorporateAccountsLoaded(true);

    Alert.alert(
      'Office Locations Updated 📍',
      `${editingCompany.companyName} now has ${cleaned.length} registered delivery location(s).`
    );
  };

  // Toggle Suspend / Activate
  const handleToggleSuspend = (company: ExtendedCompany) => {
    const isCurrentlyActive = company.isActive !== false;
    Alert.alert(
      isCurrentlyActive ? 'Suspend Corporate Account?' : 'Reactivate Corporate Account?',
      isCurrentlyActive
        ? `Suspend ${company.companyName}? Its delivery pantries will no longer appear for new registrations and employee checkouts will be blocked.`
        : `Reactivate ${company.companyName} for orders and registrations?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isCurrentlyActive ? 'Suspend Company' : 'Reactivate',
          style: isCurrentlyActive ? 'destructive' : 'default',
          onPress: async () => {
            setCompanies((prev) =>
              prev.map((c) => (c.id === company.id ? { ...c, isActive: !isCurrentlyActive } : c))
            );
            await saveOrRestore(() => updateCorporateAccountDetails(company.id, { isActive: !isCurrentlyActive }));
          },
        },
      ]
    );
  };

  // Add Company with Multiple Locations
  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) {
      Alert.alert('Error', 'Please enter a valid company name.');
      return;
    }
    const cleanDomain = `${newCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.co.za`;
    const validLocations = newLocations.map((l) => l.trim()).filter(Boolean);
    const finalLocations = validLocations.length > 0 ? validLocations : ['Head Office Reception'];
    const dist = parseFloat(newDistanceKm) || 12.0;
    const billing = newBillingEmail.trim() || `accounts@${cleanDomain}`;

    let created;
    try {
      created = await addCorporateAccount(
        newCompanyName.trim(),
        cleanDomain,
        finalLocations,
        dist,
        'percentage',
        0,
        billing,
        'distance',
        20
      );
    } catch (e: any) {
      Alert.alert('Not Saved', e?.message || 'The company could not be saved.');
      return;
    }

    const newComp: ExtendedCompany = {
      ...created,
      locations: finalLocations,
      isActive: true,
      billingEmail: billing,
      mealSubsidyAmount: 0,
      deliveryFeeMode: 'distance',
      flatFeeAmount: 20,
    };
    setCompanies((prev) => [...prev, newComp]);
    setIsAddCompanyModalOpen(false);
    setNewCompanyName('');
    setNewBillingEmail('');
    setNewLocations(['']);
    setNewDistanceKm('10.0');
    Alert.alert(
      'Company Enrolled ✓',
      `${newComp.companyName} has been enrolled with ${finalLocations.length} delivery location(s).`
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Banner with + Add Company button */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            Corporate Directory
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {companies.length} corporate partners • Tap any card to expand details
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsAddCompanyModalOpen(true)}
          style={[styles.addBtn, { backgroundColor: theme.brandGold }]}
        >
          <Ionicons name="add" size={16} color={theme.onBrandGold} />
          <Text style={[styles.addBtnText, { color: theme.onBrandGold }]}>Add Company</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={companies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item: company }) => {
          const isActive = company.isActive !== false;
          const isExpanded = expandedCompanyIds.has(company.id);

          const deliverySummary =
            company.deliveryFeeMode === 'free'
              ? 'Free Delivery'
              : company.deliveryFeeMode === 'flat'
              ? `Flat Fee (R${(company.flatFeeAmount || 20).toFixed(2)})`
              : `Distance Tier (${company.distanceKm.toFixed(1)} km)`;

          const discountBadgeSummary = company.discountValue
            ? company.discountType === 'fixed_zar'
              ? `R${company.discountValue} Off`
              : `${company.discountValue}% Off`
            : company.mealSubsidyAmount
            ? `R${company.mealSubsidyAmount} Subsidy`
            : 'Standard Rate';

          return (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              {/* Compressed Header (Clickable Accordion like OrdersScreen) */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => toggleCompanyExpand(company.id)}
                style={styles.compressedHeaderBtn}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.companyName, { color: theme.textPrimary }]} numberOfLines={1}>
                      {company.companyName}
                    </Text>
                    <Text style={[styles.compressedSummaryLine, { color: theme.textSecondary }]} numberOfLines={1}>
                      📍 {company.locations.length} {company.locations.length === 1 ? 'office' : 'offices'} •{' '}
                      {discountBadgeSummary} • {deliverySummary}
                    </Text>
                  </View>

                  <View style={styles.headerRightGroup}>
                    <View
                      style={[
                        styles.statusChip,
                        { backgroundColor: isActive ? 'rgba(67, 160, 71, 0.15)' : 'rgba(239, 68, 68, 0.15)' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          { color: isActive ? '#43A047' : '#EF4444' },
                        ]}
                      >
                        {isActive ? 'Active' : 'Suspended'}
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={theme.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.expandHintBar}>
                  <Text style={[styles.expandHintText, { color: theme.brandGold }]}>
                    {isExpanded ? 'Hide client details & controls' : 'Tap to view locations, billing & fee controls'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Expanded Details Section */}
              {isExpanded && (
                <View style={[styles.expandedContent, { borderTopColor: theme.surfaceBorder }]}>
                  <Text style={[styles.billingEmail, { color: theme.textSecondary }]}>
                    📧 Billing: {company.billingEmail || `accounts@${company.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.co.za`}
                  </Text>

                  {/* Financials & Delivery Information Banner */}
                  <View style={[styles.benefitBanner, { backgroundColor: theme.chipBg }]}>
                    <View style={styles.benefitCol}>
                      <Text style={[styles.benefitLabel, { color: theme.textSecondary }]}>Company Subsidy:</Text>
                      <Text style={[styles.benefitValue, { color: theme.primary }]}>
                        R {(company.mealSubsidyAmount || 0).toFixed(2)} / meal
                      </Text>
                    </View>
                    <View style={styles.benefitCol}>
                      <Text style={[styles.benefitLabel, { color: theme.textSecondary }]}>Corporate Discount:</Text>
                      <Text style={[styles.benefitValue, { color: theme.brandGold }]}>
                        {company.discountValue
                          ? company.discountType === 'fixed_zar'
                            ? `R${company.discountValue} Off`
                            : `${company.discountValue}% Off`
                          : 'None'}
                      </Text>
                    </View>
                    <View style={styles.benefitCol}>
                      <Text style={[styles.benefitLabel, { color: theme.textSecondary }]}>Delivery Fee:</Text>
                      <Text style={[styles.benefitValue, { color: theme.textPrimary }]}>
                        {deliverySummary}
                      </Text>
                    </View>
                  </View>

                  {/* Multiple Office Locations List */}
                  <View style={styles.locationsSection}>
                    <View style={styles.locationsSectionHeader}>
                      <Text style={[styles.locationsHeading, { color: theme.textPrimary }]}>
                        Delivery Office Locations ({company.locations.length})
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleOpenManageLocations(company)}
                        style={[styles.manageLocInlineBtn, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}
                      >
                        <Ionicons name="add-circle-outline" size={13} color={theme.brandGold} />
                        <Text style={[styles.manageLocInlineText, { color: theme.brandGold }]}>
                          Add / Edit Locations
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {company.locations.map((loc, idx) => (
                      <View key={`${company.id}-loc-${idx}`} style={styles.locationBulletRow}>
                        <Ionicons name="location-outline" size={13} color={theme.brandGold} />
                        <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                          {loc} ({company.distanceKm.toFixed(1)} km)
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Action Buttons Row */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleOpenFinancials(company)}
                      style={[styles.actionBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}
                    >
                      <Ionicons name="cash-outline" size={13} color={theme.primary} />
                      <Text style={[styles.actionBtnText, { color: theme.primary }]} numberOfLines={1}>
                        Financials
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleOpenDeliveryFee(company)}
                      style={[styles.actionBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}
                    >
                      <Ionicons name="bicycle-outline" size={13} color={theme.brandGold} />
                      <Text style={[styles.actionBtnText, { color: theme.brandGold }]} numberOfLines={1}>
                        Delivery Fee
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleToggleSuspend(company)}
                      style={[
                        styles.actionBtn,
                        { borderColor: isActive ? theme.error : '#43A047', backgroundColor: theme.surfaceElevated },
                      ]}
                    >
                      <Ionicons
                        name={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                        size={13}
                        color={isActive ? theme.error : '#43A047'}
                      />
                      <Text style={[styles.actionBtnText, { color: isActive ? theme.error : '#43A047' }]} numberOfLines={1}>
                        {isActive ? 'Suspend' : 'Activate'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* --- Edit Financials Modal --- */}
      <Modal visible={isFinancialsModalOpen} transparent animationType="fade">
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
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Corporate Financials &amp; Benefits
            </Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              {editingCompany?.companyName}
            </Text>

            {/* Per Meal Subsidy Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.brandGold }]}>
                Per-Meal Subsidy (Rand covered by company):
              </Text>
              <TextInput
                value={subsidyInput}
                onChangeText={setSubsidyInput}
                keyboardType="decimal-pad"
                placeholder="25.00"
                placeholderTextColor={theme.textMuted}
                style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
              />
            </View>

            {/* Discount Type Picker */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.brandGold }]}>
                Order Discount Model:
              </Text>
              <View style={styles.discountToggleRow}>
                {(['percentage', 'fixed_zar', 'none'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setDiscountTypeInput(t)}
                    style={[
                      styles.toggleChoice,
                      discountTypeInput === t && { backgroundColor: theme.primary },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: discountTypeInput === t ? theme.textInverse : theme.textSecondary }}>
                      {t === 'percentage' ? '% Off' : t === 'fixed_zar' ? 'Fixed R' : 'None'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Discount Value Input */}
            {discountTypeInput !== 'none' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>
                  {discountTypeInput === 'percentage' ? 'Discount Percentage (e.g. 10%):' : 'Fixed Rand Discount (e.g. R20):'}
                </Text>
                <TextInput
                  value={discountValInput}
                  onChangeText={setDiscountValInput}
                  keyboardType="decimal-pad"
                  placeholder="10"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setIsFinancialsModalOpen(false)}
                style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder }]}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveFinancials}
                style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={{ color: theme.textInverse, fontWeight: '800', fontSize: 12 }}>
                  Save &amp; Broadcast
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Delivery Fee Tier Modal (With Customizable Flat Fee) --- */}
      <Modal visible={isDeliveryFeeModalOpen} transparent animationType="fade">
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
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Delivery Fee Model
            </Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              {editingCompany?.companyName}
            </Text>

            <View style={{ width: '100%', gap: 10, marginVertical: 4 }}>
              {/* Option 1: Free Delivery */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelectedFeeMode('free')}
                style={[
                  styles.feeOptionRow,
                  {
                    backgroundColor: selectedFeeMode === 'free' ? theme.primaryMuted : theme.surface,
                    borderColor: selectedFeeMode === 'free' ? theme.primary : theme.surfaceBorder,
                  },
                ]}
              >
                <Text style={styles.feeOptionIcon}>🎁</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.feeOptionTitle, { color: theme.textPrimary }]}>1. Free Delivery</Text>
                  <Text style={[styles.feeOptionDesc, { color: theme.textSecondary }]}>
                    Zero delivery charge for this company&apos;s employees
                  </Text>
                </View>
                {selectedFeeMode === 'free' && (
                  <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                )}
              </TouchableOpacity>

              {/* Option 2: Customizable Flat Fee */}
              <View
                style={[
                  styles.feeOptionContainer,
                  {
                    backgroundColor: selectedFeeMode === 'flat' ? theme.primaryMuted : theme.surface,
                    borderColor: selectedFeeMode === 'flat' ? theme.primary : theme.surfaceBorder,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setSelectedFeeMode('flat')}
                  style={styles.feeOptionHeaderRow}
                >
                  <Text style={styles.feeOptionIcon}>🏷️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.feeOptionTitle, { color: theme.textPrimary }]}>
                      2. Custom Flat Fee (R{parseFloat(flatFeeInput || '0').toFixed(2)})
                    </Text>
                    <Text style={[styles.feeOptionDesc, { color: theme.textSecondary }]}>
                      Custom fixed rate per checkout regardless of distance
                    </Text>
                  </View>
                  {selectedFeeMode === 'flat' && (
                    <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                  )}
                </TouchableOpacity>

                {/* Custom Flat Fee Rand Input */}
                <View style={[styles.customFlatInputWrap, { borderTopColor: theme.surfaceBorder }]}>
                  <Text style={[styles.inputLabel, { color: theme.brandGold }]}>
                    Set Flat Delivery Fee Amount (Rand):
                  </Text>
                  <View style={styles.customFlatInputRow}>
                    <View style={[styles.randPrefixBox, { backgroundColor: theme.chipBg, borderColor: theme.surfaceBorder }]}>
                      <Text style={{ color: theme.textPrimary, fontWeight: '800', fontSize: 13 }}>R</Text>
                    </View>
                    <TextInput
                      value={flatFeeInput}
                      onChangeText={(txt) => {
                        setSelectedFeeMode('flat');
                        setFlatFeeInput(txt);
                      }}
                      onFocus={() => setSelectedFeeMode('flat')}
                      keyboardType="decimal-pad"
                      placeholder="20.00"
                      placeholderTextColor={theme.textMuted}
                      style={[
                        styles.inputField,
                        {
                          flex: 1,
                          backgroundColor: theme.surfaceElevated,
                          color: theme.textPrimary,
                          borderColor: theme.surfaceBorder,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>

              {/* Option 3: Distance Tiers */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelectedFeeMode('distance')}
                style={[
                  styles.feeOptionRow,
                  {
                    backgroundColor: selectedFeeMode === 'distance' ? theme.primaryMuted : theme.surface,
                    borderColor: selectedFeeMode === 'distance' ? theme.primary : theme.surfaceBorder,
                  },
                ]}
              >
                <Text style={styles.feeOptionIcon}>📏</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.feeOptionTitle, { color: theme.textPrimary }]}>3. Distance Tiers (Default)</Text>
                  <Text style={[styles.feeOptionDesc, { color: theme.textSecondary }]}>
                    Tiered pricing: 0-15km (R100), 15-20km (R140), 20-30km (R200)
                  </Text>
                </View>
                {selectedFeeMode === 'distance' && (
                  <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setIsDeliveryFeeModalOpen(false)}
                style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder }]}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleSaveDeliveryFeeMode()}
                style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={{ color: theme.textInverse, fontWeight: '800', fontSize: 12 }}>
                  Save Delivery Fee
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Manage Office Locations Modal (Existing Company) --- */}
      <Modal visible={isLocationsModalOpen} transparent animationType="fade">
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
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Delivery Office Locations
            </Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              {editingCompany?.companyName}
            </Text>

            <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: 8 }}>
              {editingLocationsList.map((loc, idx) => (
                <View key={`edit-loc-${idx}`} style={styles.multiLocationInputRow}>
                  <TextInput
                    value={loc}
                    onChangeText={(txt) => {
                      const updated = [...editingLocationsList];
                      updated[idx] = txt;
                      setEditingLocationsList(updated);
                    }}
                    placeholder={`Office Location #${idx + 1} (e.g. Building B, Floor 3)`}
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.inputField,
                      {
                        flex: 1,
                        backgroundColor: theme.surface,
                        color: theme.textPrimary,
                        borderColor: theme.surfaceBorder,
                      },
                    ]}
                  />
                  {editingLocationsList.length > 1 && (
                    <TouchableOpacity
                      onPress={() =>
                        setEditingLocationsList((prev) => prev.filter((_, i) => i !== idx))
                      }
                      style={[styles.removeLocBtn, { borderColor: theme.surfaceBorder }]}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.error} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setEditingLocationsList((prev) => [...prev, ''])}
              style={[styles.addAnotherLocBtn, { borderColor: theme.brandGold }]}
            >
              <Ionicons name="add-circle-outline" size={16} color={theme.brandGold} />
              <Text style={[styles.addAnotherLocText, { color: theme.brandGold }]}>
                + Add Another Office Location
              </Text>
            </TouchableOpacity>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setIsLocationsModalOpen(false)}
                style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder }]}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveLocations}
                style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={{ color: theme.textInverse, fontWeight: '800', fontSize: 12 }}>
                  Save Locations
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Add Company Modal (With Multiple Delivery Office Locations) --- */}
      <Modal visible={isAddCompanyModalOpen} transparent animationType="fade">
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
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Enroll New Corporate Partner
            </Text>

            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Company Name:</Text>
                <TextInput
                  value={newCompanyName}
                  onChangeText={setNewCompanyName}
                  placeholder="e.g. Discovery Health Sandton"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Billing Contact Email:</Text>
                <TextInput
                  value={newBillingEmail}
                  onChangeText={setNewBillingEmail}
                  placeholder="invoices@company.co.za"
                  keyboardType="email-address"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Distance from YKC Kitchen (km):</Text>
                <TextInput
                  value={newDistanceKm}
                  onChangeText={setNewDistanceKm}
                  placeholder="10.0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.locationsSectionHeader}>
                  <Text style={[styles.inputLabel, { color: theme.brandGold }]}>
                    Delivery Office Locations ({newLocations.length}):
                  </Text>
                </View>

                <View style={{ gap: 8 }}>
                  {newLocations.map((loc, idx) => (
                    <View key={`new-loc-${idx}`} style={styles.multiLocationInputRow}>
                      <TextInput
                        value={loc}
                        onChangeText={(txt) => {
                          const updated = [...newLocations];
                          updated[idx] = txt;
                          setNewLocations(updated);
                        }}
                        placeholder={`Location #${idx + 1} (e.g. 1 Park Lane, Floor 2)`}
                        placeholderTextColor={theme.textMuted}
                        style={[
                          styles.inputField,
                          {
                            flex: 1,
                            backgroundColor: theme.surface,
                            color: theme.textPrimary,
                            borderColor: theme.surfaceBorder,
                          },
                        ]}
                      />
                      {newLocations.length > 1 && (
                        <TouchableOpacity
                          onPress={() => setNewLocations((prev) => prev.filter((_, i) => i !== idx))}
                          style={[styles.removeLocBtn, { borderColor: theme.surfaceBorder }]}
                        >
                          <Ionicons name="close-circle-outline" size={18} color={theme.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setNewLocations((prev) => [...prev, ''])}
                  style={[styles.addAnotherLocBtn, { borderColor: theme.brandGold, marginTop: 6 }]}
                >
                  <Ionicons name="add-circle-outline" size={15} color={theme.brandGold} />
                  <Text style={[styles.addAnotherLocText, { color: theme.brandGold }]}>
                    + Add Another Office Location
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setIsAddCompanyModalOpen(false)}
                style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder }]}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddCompany}
                style={[styles.modalSaveBtn, { backgroundColor: theme.brandGold }]}
              >
                <Text style={{ color: theme.onBrandGold, fontWeight: '800' }}>Enroll Company</Text>
              </TouchableOpacity>
            </View>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  compressedHeaderBtn: {
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  companyName: {
    fontSize: 15,
    fontWeight: '800',
  },
  compressedSummaryLine: {
    fontSize: 12,
    marginTop: 2,
  },
  expandHintBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandHintText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expandedContent: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 2,
    gap: 10,
  },
  billingEmail: {
    fontSize: 11,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  benefitBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  benefitCol: {
    flex: 1,
    minWidth: 90,
    gap: 2,
  },
  benefitLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  benefitValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  locationsSection: {
    gap: 6,
  },
  locationsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  locationsHeading: {
    fontSize: 12,
    fontWeight: '700',
  },
  manageLocInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  manageLocInlineText: {
    fontSize: 11,
    fontWeight: '700',
  },
  locationBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  actionBtnText: {
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
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: -8,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputField: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  discountToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleChoice: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtn: {
    flex: 1.5,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  feeOptionContainer: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  feeOptionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customFlatInputWrap: {
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 6,
  },
  customFlatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  randPrefixBox: {
    width: 36,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeOptionIcon: {
    fontSize: 20,
  },
  feeOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  feeOptionDesc: {
    fontSize: 11,
  },
  multiLocationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeLocBtn: {
    width: 38,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAnotherLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addAnotherLocText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

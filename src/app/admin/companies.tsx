/** AdminCompaniesPage.xaml + AdminCompaniesViewModel — "Companies & Locations". */
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { Btn, Card, Divider, EmptyState, Page } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { addCompany, addLocation, getCompanies, setCompanyDomains, updateCompany, updateCompanyDelivery, updateLocation } from '../../services/directory';
import { deliveryFeeSummary, financialsSummary } from '../../models';
import type { Company, CompanyLocation, DeliveryFeeMode, DiscountType } from '../../models';

/** Parses prompt input as a number, accepting a comma decimal ("12,50"); null if not a number. */
const parseNumber = (value: string | null) => {
  const n = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export default function AdminCompaniesScreen() {
  const { colors } = useApp();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    setIsBusy(true);
    try {
      setCompanies(await getCompanies());
    } catch (err) {
      await alerts.show('Could Not Load', (err as Error)?.message ?? 'Check your connection and try again.', 'OK');
    } finally {
      setIsBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** Shared error popup for every save below. */
  const failed = (err: unknown) => alerts.show('Not Saved', (err as Error)?.message ?? 'Check your connection and try again.', 'OK');

  /** + Add Company: name and billing email; locations are added separately. */
  const add = async () => {
    const name = await alerts.prompt('New Company', 'Company name:');
    if (!name?.trim()) return;
    const billingEmail = await alerts.prompt('Billing Contact', 'Billing email:', { keyboard: 'email-address' });
    try {
      const company = await addCompany(name.trim(), billingEmail?.trim() ?? '');
      setCompanies(list => [...list, company]);
      await alerts.show('Company Added', `${company.name} has been added. Add at least one delivery location for it next.`, 'OK');
    } catch (err) {
      await failed(err);
    }
  };

  /** Rename a company / change its billing email. */
  const edit = async (company: Company) => {
    const name = await alerts.prompt('Edit Company', 'Company name:', { initialValue: company.name });
    if (!name?.trim()) return;
    const billingEmail = await alerts.prompt('Billing Contact', 'Billing email:', { initialValue: company.billingEmail, keyboard: 'email-address' });
    try {
      await updateCompany({ ...company, name: name.trim(), billingEmail: billingEmail?.trim() ?? '' });
      await load();
    } catch (err) {
      await failed(err);
    }
  };

  /** Suspend or re-activate; suspended companies are hidden from the sign-up pickers. */
  const toggleActive = async (company: Company) => {
    if (company.isActive) {
      const confirmed = await alerts.confirm(
        'Suspend Company',
        `Suspend ${company.name}? Its delivery locations will stop appearing when new people sign up.`,
        'Suspend',
        'Cancel'
      );
      if (!confirmed) return;
    }
    const updated = { ...company, isActive: !company.isActive };
    try {
      await updateCompany(updated);
      setCompanies(list => list.map(c => (c.id === company.id ? updated : c)));
      await alerts.show('Company Updated', `${company.name} is now ${updated.isActive ? 'active' : 'suspended'}.`, 'OK');
    } catch (err) {
      await failed(err);
    }
  };

  /**
   * Per-meal subsidy, then an optional order discount (percentage or fixed Rand).
   * Cancelling the discount step still saves the subsidy that was entered.
   */
  const manageFinancials = async (company: Company) => {
    const subsidyStr = await alerts.prompt('Per-Meal Subsidy', 'Amount the company covers per meal, in Rand (0 for none):', {
      initialValue: company.mealSubsidyAmount.toFixed(2),
      keyboard: 'decimal-pad',
    });
    if (subsidyStr === null) return;
    const updated: Company = { ...company };
    const subsidy = parseNumber(subsidyStr);
    if (subsidy !== null) updated.mealSubsidyAmount = Math.max(0, subsidy);

    const typeChoice = await alerts.actionSheet('Order Discount Type', 'Cancel', 'None', 'Percentage', 'Fixed Rand Amount');
    if (!typeChoice) {
      try {
        await updateCompany(updated);
        await load();
      } catch (err) {
        await failed(err);
      }
      return;
    }
    const discountType: DiscountType = typeChoice === 'Percentage' ? 'Percentage' : typeChoice === 'Fixed Rand Amount' ? 'FixedZar' : 'None';
    updated.discountType = discountType;
    if (discountType !== 'None') {
      const valueStr = await alerts.prompt('Discount Value', discountType === 'Percentage' ? 'Discount percentage (0-100):' : 'Discount amount, in Rand:', {
        initialValue: company.discountValue.toFixed(2),
        keyboard: 'decimal-pad',
      });
      const value = parseNumber(valueStr);
      if (value !== null) updated.discountValue = discountType === 'Percentage' ? Math.min(Math.max(value, 0), 100) : Math.max(0, value);
    } else {
      updated.discountValue = 0;
    }
    try {
      await updateCompany(updated);
      await load();
      const discountLabel =
        updated.discountType === 'Percentage'
          ? `${updated.discountValue}% off orders`
          : updated.discountType === 'FixedZar'
            ? `R${updated.discountValue.toFixed(2)} off orders`
            : 'no discount';
      await alerts.show('Financials Updated', `${updated.name}: R${updated.mealSubsidyAmount.toFixed(2)}/meal subsidy, ${discountLabel}.`, 'OK');
    } catch (err) {
      await failed(err);
    }
  };

  /** Add/remove whitelisted email domains, which auto-match new sign-ups to this company. */
  const manageDomains = async (company: Company) => {
    const current = company.whitelistedDomains.join(', ');
    const action = await alerts.actionSheet(current ? `Current domains: ${current}` : 'No domains whitelisted yet', 'Cancel', 'Add a Domain', 'Remove a Domain');
    if (!action) return;
    let domains = [...company.whitelistedDomains];
    if (action === 'Add a Domain') {
      const newDomain = await alerts.prompt('Add Domain', 'Email domain to whitelist (no @), e.g. "ecogra.org":');
      if (!newDomain?.trim()) return;
      const cleaned = newDomain.trim().replace(/^@+/, '').toLowerCase();
      if (!domains.includes(cleaned)) domains.push(cleaned);
    } else if (domains.length > 0) {
      const toRemove = await alerts.actionSheet('Remove which domain?', 'Cancel', ...domains);
      if (!toRemove) return;
      domains = domains.filter(d => d !== toRemove);
    } else {
      return;
    }
    try {
      await setCompanyDomains(company.id, domains);
      setCompanies(list => list.map(c => (c.id === company.id ? { ...c, whitelistedDomains: domains } : c)));
      await alerts.show(
        'Domains Updated',
        domains.length > 0
          ? `${company.name} now auto-matches: ${domains.join(', ')}`
          : `${company.name} has no whitelisted domains — employees will need to select it manually at registration.`,
        'OK'
      );
    } catch (err) {
      await failed(err);
    }
  };

  /** New delivery location; its distance drives the distance-tier delivery fee. */
  const addCompanyLocation = async (company: Company) => {
    const name = await alerts.prompt('New Location', `Location name for ${company.name} (e.g. "Building 2 — Sandton"):`);
    if (!name?.trim()) return;
    const address = await alerts.prompt('Address', 'Delivery address:');
    const distanceStr = await alerts.prompt('Delivery Distance', 'Distance from the kitchen, in km (used to calculate the delivery fee):', {
      keyboard: 'decimal-pad',
    });
    try {
      const location = await addLocation(company.id, name.trim(), address?.trim() || name.trim(), parseNumber(distanceStr) ?? 0, company.locations.length);
      setCompanies(list => list.map(c => (c.id === company.id ? { ...c, locations: [...c.locations, location] } : c)));
    } catch (err) {
      await failed(err);
    }
  };

  /** Edit a location; blank answers keep the current address/distance. */
  const editLocation = async (location: CompanyLocation) => {
    const name = await alerts.prompt('Edit Location', 'Location name:', { initialValue: location.name });
    if (!name?.trim()) return;
    const address = await alerts.prompt('Address', 'Delivery address:', { initialValue: location.address });
    const distanceStr = await alerts.prompt('Delivery Distance', 'Distance from the kitchen, in km:', {
      initialValue: location.distanceKm.toFixed(1),
      keyboard: 'decimal-pad',
    });
    const distance = parseNumber(distanceStr) ?? location.distanceKm;
    try {
      await updateLocation(location, name.trim(), address?.trim() || location.address, distance);
      await load();
    } catch (err) {
      await failed(err);
    }
  };

  /** Free / flat fee / distance tiers — how this company's checkouts are charged for delivery (migration 0009). */
  const manageDeliveryFee = async (company: Company) => {
    const choice = await alerts.actionSheet(
      `Delivery fee for ${company.name}\nCurrently: ${deliveryFeeSummary(company)}`,
      'Cancel',
      'Free delivery',
      'Set a flat fee',
      'Use distance tiers (default)'
    );
    if (!choice) return;

    let mode: DeliveryFeeMode = 'DistanceTier';
    let flatFee = 0;
    if (choice === 'Free delivery') {
      mode = 'Free';
    } else if (choice === 'Set a flat fee') {
      const feeStr = await alerts.prompt('Flat Delivery Fee', 'Amount charged per checkout, in Rand (0 makes delivery free):', {
        initialValue: company.flatDeliveryFee > 0 ? company.flatDeliveryFee.toFixed(2) : '',
        keyboard: 'decimal-pad',
      });
      if (feeStr === null) return;
      const fee = parseNumber(feeStr);
      if (fee === null || fee < 0) {
        await alerts.show('Invalid Amount', 'Please enter a number of 0 or more.', 'OK');
        return;
      }
      mode = fee === 0 ? 'Free' : 'Flat';
      flatFee = fee;
    }

    try {
      await updateCompanyDelivery(company.id, mode, flatFee);
      await load();
      await alerts.show('Delivery Updated', `${company.name}: ${deliveryFeeSummary({ ...company, deliveryFeeMode: mode, flatDeliveryFee: flatFee })}.`, 'OK');
    } catch (err) {
      await alerts.show('Not Saved', (err as Error)?.message ?? 'Could not update the delivery fee.', 'OK');
    }
  };

  /** Compact action button used in each company card's button row. */
  const smallButton = (title: string, onPress: () => void, accent = false) => (
    <Btn
      title={title}
      onPress={onPress}
      variant="neutral"
      bg={accent ? colors.brandGold : undefined}
      color={accent ? colors.onBrandGold : undefined}
      fontSize={10}
      height={28}
      paddingH={8}
      style={styles.smallButton}
    />
  );

  return (
    <Page>
      <AdminNavStrip activeRoute="admincompanies" />
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Client Companies</Text>
        <Btn title="+ Add Company" onPress={add} bg={colors.brandGold} color={colors.onBrandGold} bold radius={8} height={38} />
      </View>
      <FlatList
        data={companies}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isBusy} onRefresh={load} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={isBusy ? null : <EmptyState emoji="🏢" message="No companies yet. Tap + Add Company to create one." />}
        renderItem={({ item: company }) => (
          <Card radius={14} padding={14} style={styles.companyCard}>
            <View style={styles.stack10}>
              <View style={styles.companyHeader}>
                <View style={styles.flex}>
                  <Text style={[styles.companyName, { color: colors.text }]}>{company.name}</Text>
                  {!!company.billingEmail && <Text style={[styles.muted12, { color: colors.mutedText }]}>{company.billingEmail}</Text>}
                </View>
                <View style={[styles.statusChip, { backgroundColor: colors.subtleFillStrong }]}>
                  <Text style={[styles.statusText, { color: colors.brandGold }]}>{company.isActive ? 'Active' : 'Suspended'}</Text>
                </View>
                <Btn title="Edit" onPress={() => edit(company)} variant="neutral" fontSize={11} height={30} paddingH={10} />
              </View>
              <Text style={[styles.muted11, { color: colors.mutedText }]}>{financialsSummary(company)}</Text>
              <Text style={[styles.muted11, styles.bold, { color: colors.brandGold }]}>🚚 {deliveryFeeSummary(company)}</Text>
              <View style={styles.buttonRow}>
                {smallButton(company.isActive ? 'Suspend' : 'Activate', () => toggleActive(company))}
                {smallButton('Financials', () => manageFinancials(company))}
                {smallButton('Delivery', () => manageDeliveryFee(company))}
                {smallButton('Domains', () => manageDomains(company))}
                {smallButton('+ Add Location', () => addCompanyLocation(company), true)}
              </View>
              <Divider />
              <Text style={[styles.muted11, styles.bold, { color: colors.mutedText }]}>Delivery Locations</Text>
              {company.locations.length === 0 ? (
                <Text style={styles.noLocations}>No locations yet for this company.</Text>
              ) : (
                company.locations.map(location => (
                  <View key={location.id} style={styles.locationRow}>
                    <View style={styles.flex}>
                      <Text style={[styles.locationName, { color: colors.text }]}>{location.name}</Text>
                      <Text style={[styles.muted11, { color: colors.mutedText }]}>{location.address}</Text>
                      <Text style={[styles.distance, { color: colors.brandGold }]}>
                        {location.distanceKnown ? `${location.distanceKm.toFixed(1)}km from kitchen` : 'Distance not set'}
                      </Text>
                    </View>
                    <Btn title="Edit" onPress={() => editLocation(location)} variant="neutral" fontSize={10} height={28} paddingH={10} />
                  </View>
                ))
              )}
            </View>
          </Card>
        )}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 },
  companyCard: { marginBottom: 14 },
  stack10: { gap: 10 },
  companyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  companyName: { fontSize: 16, fontWeight: '700' },
  statusChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  muted12: { fontSize: 12 },
  muted11: { fontSize: 11 },
  // Wraps onto a second row on narrow screens (five actions).
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallButton: { minHeight: 28 },
  noLocations: { fontSize: 12, color: 'gray', marginVertical: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  locationName: { fontSize: 13, fontWeight: '700' },
  distance: { fontSize: 11 },
});

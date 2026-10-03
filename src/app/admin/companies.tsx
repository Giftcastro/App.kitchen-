/** AdminCompaniesPage.xaml + AdminCompaniesViewModel — "Companies & Locations". */
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { Btn, Card, Divider, EmptyState, Page } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { addCompany, addLocation, getCompanies, setCompanyDomains, updateCompany, updateLocation } from '../../services/directory';
import { financialsSummary } from '../../models';
import type { Company, CompanyLocation, DiscountType } from '../../models';
import { fixed } from '../../utils/theme';

const parseNumber = (value: string | null) => {
  const n = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export default function AdminCompaniesScreen() {
  const { colors, isDark } = useApp();
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

  const failed = (err: unknown) => alerts.show('Not Saved', (err as Error)?.message ?? 'Check your connection and try again.', 'OK');

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

  const toggleActive = async (company: Company) => {
    const updated = { ...company, isActive: !company.isActive };
    try {
      await updateCompany(updated);
      setCompanies(list => list.map(c => (c.id === company.id ? updated : c)));
      await alerts.show('Company Updated', `${company.name} is now ${updated.isActive ? 'active' : 'suspended'}.`, 'OK');
    } catch (err) {
      await failed(err);
    }
  };

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

  const smallButton = (title: string, onPress: () => void, primary = false) => (
    <Btn
      title={title}
      onPress={onPress}
      variant={primary ? 'primary' : 'neutral'}
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
        <Btn title="+ Add Company" onPress={add} bold radius={8} height={38} />
      </View>
      <FlatList
        data={companies}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isBusy} onRefresh={load} tintColor="#121212" />}
        ListEmptyComponent={isBusy ? null : <EmptyState emoji="🏢" message="No companies yet. Tap + Add Company to create one." />}
        renderItem={({ item: company }) => (
          <Card radius={14} padding={14} bg={isDark ? '#1E1E1E' : '#FFFFFF'} style={styles.companyCard}>
            <View style={styles.stack10}>
              <View style={styles.companyHeader}>
                <View style={styles.flex}>
                  <Text style={[styles.companyName, { color: colors.text }]}>{company.name}</Text>
                  {!!company.billingEmail && <Text style={styles.muted12}>{company.billingEmail}</Text>}
                </View>
                <View style={[styles.statusChip, { backgroundColor: fixed.badgeBg }]}>
                  <Text style={[styles.statusText, { color: colors.primary }]}>{company.isActive ? 'Active' : 'Suspended'}</Text>
                </View>
                <Btn title="Edit" onPress={() => edit(company)} variant="neutral" fontSize={11} height={30} paddingH={10} />
              </View>
              <Text style={styles.muted11}>{financialsSummary(company)}</Text>
              <View style={styles.buttonRow}>
                {smallButton('Toggle Active', () => toggleActive(company))}
                {smallButton('Financials', () => manageFinancials(company))}
                {smallButton('Domains', () => manageDomains(company))}
                {smallButton('+ Add Location', () => addCompanyLocation(company), true)}
              </View>
              <Divider color={isDark ? '#2A2A2A' : '#EEEEEE'} />
              <Text style={[styles.muted11, styles.bold]}>Delivery Locations</Text>
              {company.locations.length === 0 ? (
                <Text style={styles.noLocations}>No locations yet for this company.</Text>
              ) : (
                company.locations.map(location => (
                  <View key={location.id} style={styles.locationRow}>
                    <View style={styles.flex}>
                      <Text style={[styles.locationName, { color: colors.text }]}>{location.name}</Text>
                      <Text style={styles.muted11}>{location.address}</Text>
                      <Text style={[styles.distance, { color: colors.primary }]}>
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
  muted12: { fontSize: 12, color: '#888888' },
  muted11: { fontSize: 11, color: '#888888' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallButton: { minHeight: 28 },
  noLocations: { fontSize: 12, color: 'gray', marginVertical: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  locationName: { fontSize: 13, fontWeight: '700' },
  distance: { fontSize: 11 },
});

/** AdminDiscountsPage.xaml + AdminDiscountsViewModel — "Discount Codes". */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { Btn, Card, EmptyState, Page, Picker, PlainEntry } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { getCompanies } from '../../services/directory';
import { addDiscount, deleteDiscount, getDiscounts, setDiscountActive } from '../../services/promos';
import { fmtMonthDayYear } from '../../services/scheduling';
import type { Company, Discount } from '../../models';
import { fixed } from '../../utils/theme';

const ALL_COMPANIES = 'All Companies';

export default function AdminDiscountsScreen() {
  const { colors, isDark } = useApp();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newPercentage, setNewPercentage] = useState('');
  const [companyOption, setCompanyOption] = useState(ALL_COMPANIES);
  const [newExpires, setNewExpires] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    setIsBusy(true);
    try {
      const [loadedCompanies, loadedDiscounts] = await Promise.all([getCompanies(), getDiscounts()]);
      setCompanies(loadedCompanies);
      setDiscounts(loadedDiscounts);
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

  const add = async () => {
    const percentage = parseFloat(newPercentage);
    if (!newCode.trim() || !Number.isFinite(percentage) || percentage <= 0) {
      await alerts.show('Missing Information', 'Please provide a code and a valid percentage.', 'OK');
      return;
    }
    let expires: Date | null = null;
    if (newExpires.trim()) {
      const parsed = new Date(newExpires.trim());
      if (!Number.isNaN(parsed.getTime())) expires = parsed;
    }
    const companyId = companyOption !== ALL_COMPANIES ? companies.find(c => c.name === companyOption)?.id ?? null : null;
    try {
      await addDiscount(newCode.trim().toUpperCase(), Math.min(percentage, 100), expires, companyId);
      setNewCode('');
      setNewPercentage('');
      setNewExpires('');
      setCompanyOption(ALL_COMPANIES);
      await load();
    } catch (err) {
      await alerts.show('Not Saved', (err as Error)?.message ?? 'Could not add this discount.', 'OK');
    }
  };

  const toggleActive = async (discount: Discount) => {
    try {
      await setDiscountActive(discount.id, !discount.active);
      await load();
    } catch (err) {
      await alerts.show('Not Saved', (err as Error)?.message ?? 'Could not update this discount.', 'OK');
    }
  };

  const remove = async (discount: Discount) => {
    const confirmed = await alerts.confirm('Delete Discount', `Remove code ${discount.code}?`, 'Delete', 'Cancel');
    if (!confirmed) return;
    try {
      await deleteDiscount(discount.id);
      setDiscounts(list => list.filter(d => d.id !== discount.id));
    } catch (err) {
      await alerts.show('Not Deleted', (err as Error)?.message ?? 'Could not delete this discount.', 'OK');
    }
  };

  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const fieldLabel = (text: string) => <Text style={[styles.fieldLabel, { color: colors.primary }]}>{text}</Text>;

  return (
    <Page>
      <AdminNavStrip activeRoute="admindiscounts" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card radius={12} bg={cardBg}>
          <View style={styles.form}>
            <Text style={[styles.title, { color: colors.text }]}>New Discount Code</Text>
            <View style={styles.field}>
              {fieldLabel('Code')}
              <PlainEntry value={newCode} onChangeText={setNewCode} placeholder="e.g., WEEKEND20" />
            </View>
            <View style={styles.field}>
              {fieldLabel('Percentage Off')}
              <PlainEntry value={newPercentage} onChangeText={setNewPercentage} placeholder="e.g., 20" keyboardType="decimal-pad" />
            </View>
            <View style={styles.field}>
              {fieldLabel('Restrict to Company (optional)')}
              <Picker title="Restrict to Company" options={[ALL_COMPANIES, ...companies.map(c => c.name)]} selected={companyOption} onSelect={setCompanyOption} />
            </View>
            <View style={styles.field}>
              {fieldLabel('Expires (optional, yyyy-mm-dd)')}
              <PlainEntry value={newExpires} onChangeText={setNewExpires} placeholder="e.g., 2026-12-31" />
            </View>
            <Btn title="Add Discount" onPress={add} bold radius={8} style={styles.addButton} />
            {isBusy && <ActivityIndicator color={colors.primary} />}
          </View>
        </Card>

        <Text style={[styles.title, { color: colors.text }]}>Active &amp; Past Codes</Text>

        {discounts.length === 0 && !isBusy ? (
          <EmptyState emoji="🏷️" message="No discounts yet. Add one above to promote your meals." />
        ) : (
          discounts.map(discount => (
            <Card key={discount.id} radius={12} padding={14} bg={cardBg}>
              <View style={styles.stack8}>
                <View style={styles.row}>
                  <View style={styles.codeRow}>
                    <View style={[styles.codeChip, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.code, { color: colors.onPrimary }]}>{discount.code}</Text>
                    </View>
                    <Text style={[styles.percent, { color: colors.text }]}>-{discount.percentage}% OFF</Text>
                  </View>
                  <Btn
                    title={discount.active ? 'Active' : 'Suspended'}
                    onPress={() => toggleActive(discount)}
                    bg={colors.surfaceBorder}
                    color={colors.primary}
                    fontSize={11}
                    height={30}
                    paddingH={10}
                  />
                </View>
                {!!discount.companyName && <Text style={styles.muted}>{discount.companyName} only</Text>}
                <View style={styles.row}>
                  <Text style={styles.expires}>{discount.expires ? `Expires: ${fmtMonthDayYear(discount.expires)}` : ''}</Text>
                  <Btn
                    title="Delete"
                    onPress={() => remove(discount)}
                    variant="ghost"
                    color={fixed.dangerBright}
                    borderColor={fixed.dangerBright}
                    fontSize={11}
                    height={28}
                    paddingH={10}
                  />
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 16 },
  form: { gap: 14 },
  title: { fontSize: 18, fontWeight: '700' },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '700' },
  addButton: { marginTop: 8 },
  stack8: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  code: { fontSize: 13, fontWeight: '700' },
  percent: { fontSize: 14, fontWeight: '700' },
  muted: { fontSize: 11, color: '#888888' },
  expires: { fontSize: 11, color: '#AAAAAA' },
});

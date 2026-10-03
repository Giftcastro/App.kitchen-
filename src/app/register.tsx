/** RegisterPage.xaml + RegisterViewModel. */
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../components/AppText';
import { alerts } from '../components/Alerts';
import { BoxEntry, Btn, Page, Picker } from '../components/ui';
import { useApp } from '../state/AppState';
import { listRegistrationCompanies } from '../services/directory';
import type { Company, CompanyLocation } from '../models';

export default function RegisterScreen() {
  const { colors, isDark, register } = useApp();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<CompanyLocation | null>(null);
  const [isCompanyAutoMatched, setIsCompanyAutoMatched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listRegistrationCompanies()
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, []);

  const selectCompany = (company: Company | null) => {
    setSelectedCompany(company);
    setSelectedLocation(null);
  };

  // Auto-match by email domain — a convenience, never overriding a manual pick.
  const onEmailChanged = (value: string) => {
    setEmail(value);
    if (selectedCompany || !value.trim()) return;
    const at = value.lastIndexOf('@');
    if (at < 0 || at === value.length - 1) return;
    const domain = value.slice(at + 1).trim().toLowerCase();
    const match = companies.find(c => c.whitelistedDomains.includes(domain));
    if (match) {
      selectCompany(match);
      setIsCompanyAutoMatched(true);
    }
  };

  const submit = async () => {
    if (!fullName.trim() || !email.trim()) {
      await alerts.show('Missing Information', 'Please enter your name and email address.', 'OK');
      return;
    }
    if (!password || password.length < 8) {
      await alerts.show('Weak Password', 'Password must be at least 8 characters.', 'OK');
      return;
    }
    if (password !== confirmPassword) {
      await alerts.show("Passwords Don't Match", 'Please make sure both password fields match.', 'OK');
      return;
    }
    if (!selectedCompany || !selectedLocation) {
      await alerts.show('Company Required', 'Please select your company and delivery location — orders are grouped by these.', 'OK');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const created = await register(fullName, email, password, selectedCompany, selectedLocation);
      await alerts.show('Welcome!', `Account created for ${created.fullName}. You're all set.`, 'OK');
    } catch (err) {
      const message = String((err as Error)?.message ?? '');
      if (/already registered|already been registered|exists/i.test(message)) {
        await alerts.show('Account Exists', 'An account with that email already exists. Try logging in instead.', 'OK');
      } else {
        await alerts.show('Registration Failed', message || 'Could not create your account — check your connection and try again.', 'OK');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Image
          source={isDark ? require('../../assets/images/yourkcodark.png') : require('../../assets/images/yourkcolight.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Your Kitchen Co."
        />

        <View style={styles.titles}>
          <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Join YourKitchenCo today</Text>
        </View>

        <View style={styles.form}>
          <BoxEntry value={fullName} onChangeText={setFullName} placeholder="Full Name (e.g., John Doe)" />
          <BoxEntry value={email} onChangeText={onEmailChanged} placeholder="Email Address (e.g., john.doe@example.com)" keyboardType="email-address" />
          <BoxEntry value={password} onChangeText={setPassword} placeholder="Password (min. 8 characters)" secure />
          <BoxEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm Password (match your password)" secure />

          <View style={[styles.pickerBox, { borderColor: colors.inputBorder, backgroundColor: isDark ? colors.cardBg : '#FFFFFF' }]}>
            <Picker
              title="Select your company"
              options={companies.map(c => c.name)}
              selected={selectedCompany?.name ?? null}
              onSelect={name => {
                selectCompany(companies.find(c => c.name === name) ?? null);
                setIsCompanyAutoMatched(false);
              }}
              style={styles.pickerInner}
            />
          </View>
          {isCompanyAutoMatched && <Text style={styles.matched}>✓ Matched automatically from your email address</Text>}

          <View
            style={[
              styles.pickerBox,
              { borderColor: colors.inputBorder, backgroundColor: isDark ? colors.cardBg : '#FFFFFF', opacity: selectedCompany ? 1 : 0.5 },
            ]}
          >
            <Picker
              title="Select your delivery location"
              options={(selectedCompany?.locations ?? []).map(l => l.name)}
              selected={selectedLocation?.name ?? null}
              onSelect={name => setSelectedLocation(selectedCompany?.locations.find(l => l.name === name) ?? null)}
              disabled={!selectedCompany}
              style={styles.pickerInner}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Btn title={busy ? 'Creating account…' : '🚀  🚀  GET STARTED'} onPress={submit} bold fontSize={15} height={50} radius={25} style={styles.shadow} />
          <Pressable onPress={() => router.back()} style={styles.backLink} accessibilityRole="button">
            <Text style={[styles.backText, { color: colors.primary }]}>Already have an account? Login</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 30, gap: 20 },
  logo: { width: '100%', height: 250, marginTop: 10 },
  titles: { gap: 4, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  form: { gap: 14 },
  pickerBox: { height: 50, borderWidth: 1, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 15 },
  pickerInner: { borderBottomWidth: 0 },
  matched: { fontSize: 11, fontWeight: '700', color: '#059669', marginLeft: 4, marginTop: -6 },
  actions: { gap: 10, marginTop: 10 },
  shadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 6, elevation: 3 },
  backLink: { alignItems: 'center', paddingVertical: 12 },
  backText: { fontSize: 13, fontWeight: '700' },
});

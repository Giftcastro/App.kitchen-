/**
 * SettingsPage.xaml + SettingsViewModel body. Shared, as in MAUI, by the
 * customer app (pushed from Profile) and AdminShell (its own nav tab) —
 * only the admin copy carries the admin nav strip above it.
 *
 * App Theme: MAUI has to rebuild its Shell to repaint (StaticResources
 * resolve once), hence the "refreshes the app" confirm. Here the colours are
 * live state, so Apply just switches them and the page stays put.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import { alerts } from './Alerts';
import { Btn, Card, Switch } from './ui';
import { useApp } from '../state/AppState';
import { BRAND_THEMES, BrandTheme } from '../utils/theme';

export function SettingsContent() {
  const {
    colors,
    isDark,
    user,
    notificationsEnabled,
    setNotificationsEnabled,
    setDarkMode,
    signOut,
    isAdminPreview,
    returnToAdmin,
    brandTheme,
    setBrandTheme,
  } = useApp();

  const confirmSignOut = async () => {
    const confirmed = await alerts.confirm('Sign Out', 'Are you sure you want to sign out?', 'Sign Out', 'Cancel');
    if (confirmed) await signOut();
  };

  const selectBrandTheme = async (theme: BrandTheme) => {
    if (theme === brandTheme) return;
    const confirmed = await alerts.confirm(
      'Change App Theme',
      'This refreshes the app to apply the new colour theme, then brings you back here.',
      'Apply',
      'Cancel'
    );
    if (confirmed) setBrandTheme(theme);
  };

  const toggleRow = (title: string, subtitle: string, value: boolean, onChange: (v: boolean) => void) => (
    <Card radius={12} padding={[16, 12]} border={colors.surfaceBorder}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
        <Switch value={value} onValueChange={onChange} onColor={colors.brandGold} />
      </View>
    </Card>
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card radius={12} padding={[16, 12]} border={colors.surfaceBorder}>
        <View style={styles.stack2}>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>Signed in as</Text>
          <Text style={[styles.email, { color: colors.text }]}>{user?.email ?? ''}</Text>
        </View>
      </Card>

      {isAdminPreview && (
        <Card radius={12} padding={[16, 12]} border={colors.brandGold}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Admin preview</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>You&apos;re viewing the app as a customer</Text>
            </View>
            <Btn
              title="Back to Admin"
              onPress={returnToAdmin}
              bg={colors.brandGold}
              color={colors.onBrandGold}
              fontSize={12}
              bold
              height={36}
              paddingH={12}
            />
          </View>
        </Card>
      )}

      <Text style={[styles.section, { color: colors.brandGold }]}>App Preferences</Text>

      {toggleRow('Push Notifications', 'Alerts for order delivery updates', notificationsEnabled, setNotificationsEnabled)}
      {toggleRow('Dark Interface Mode', 'Switch between light and dark display', isDark, setDarkMode)}

      <Card radius={12} padding={[16, 14]} border={colors.surfaceBorder}>
        <View style={styles.stack12}>
          <View style={styles.stack2}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>App Theme</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Mediterranean Pantry or Ink & Cream — applies across the whole app
            </Text>
          </View>
          <View style={styles.swatches}>
            {BRAND_THEMES.map(theme => {
              const selected = theme.key === brandTheme;
              return (
                <Pressable
                  key={theme.key}
                  onPress={() => selectBrandTheme(theme.key)}
                  accessibilityRole="radio"
                  aria-checked={selected}
                  accessibilityLabel={theme.label}
                  style={[styles.swatch, { borderColor: selected ? theme.swatch : 'transparent' }]}
                >
                  <View style={[styles.swatchColor, { backgroundColor: theme.swatch }]} />
                  <Text style={[styles.swatchLabel, { color: colors.text }]}>{theme.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <Btn title="Sign Out" onPress={confirmSignOut} variant="dangerOutline" bold radius={10} height={46} style={styles.signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 24, gap: 16 },
  stack2: { gap: 2 },
  stack12: { gap: 12 },
  caption: { fontSize: 11 },
  email: { fontSize: 15, fontWeight: '700' },
  section: { fontSize: 14, fontWeight: '700', marginLeft: 4, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSubtitle: { fontSize: 12 },
  swatches: { flexDirection: 'row', gap: 10 },
  swatch: { flex: 1, borderWidth: 2, borderRadius: 10, padding: 10, gap: 6 },
  swatchColor: { height: 28, borderRadius: 6 },
  swatchLabel: { fontSize: 11, fontWeight: '700' },
  signOut: { marginTop: 12 },
});

/**
 * SettingsPage.xaml + SettingsViewModel body. Shared, as in MAUI, by the
 * customer app (pushed from Profile) and AdminShell (its own nav tab) —
 * only the admin copy carries the admin nav strip above it.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import { alerts } from './Alerts';
import { Btn, Card, Switch } from './ui';
import { useApp } from '../state/AppState';

export function SettingsContent() {
  const { colors, isDark, user, notificationsEnabled, setNotificationsEnabled, setDarkMode, signOut } = useApp();

  const confirmSignOut = async () => {
    const confirmed = await alerts.confirm('Sign Out', 'Are you sure you want to sign out?', 'Sign Out', 'Cancel');
    if (confirmed) await signOut();
  };

  const toggleRow = (title: string, subtitle: string, value: boolean, onChange: (v: boolean) => void) => (
    <Card radius={12} padding={[16, 12]} border={colors.cardBorder} bg={isDark ? colors.cardBg : '#FFFFFF'}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
        <Switch value={value} onValueChange={onChange} />
      </View>
    </Card>
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card radius={12} padding={[16, 12]} border={colors.cardBorder} bg={isDark ? colors.cardBg : '#FFFFFF'}>
        <View style={styles.stack2}>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>Signed in as</Text>
          <Text style={[styles.email, { color: colors.text }]}>{user?.email ?? ''}</Text>
        </View>
      </Card>

      <Text style={[styles.section, { color: colors.primary }]}>App Preferences</Text>

      {toggleRow('Push Notifications', 'Alerts for order delivery updates', notificationsEnabled, setNotificationsEnabled)}
      {toggleRow('Dark Interface Mode', 'Switch between light and dark display', isDark, setDarkMode)}

      <Btn title="Sign Out" onPress={confirmSignOut} variant="dangerOutline" bold radius={10} height={46} style={styles.signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 24, gap: 16 },
  stack2: { gap: 2 },
  caption: { fontSize: 11 },
  email: { fontSize: 15, fontWeight: '700' },
  section: { fontSize: 14, fontWeight: '700', marginLeft: 4, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSubtitle: { fontSize: 12 },
  signOut: { marginTop: 12 },
});

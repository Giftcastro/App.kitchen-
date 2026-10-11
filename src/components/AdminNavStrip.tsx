/**
 * Views/AdminNavStrip.xaml — embedded at the top of every admin page:
 * "Central Command" branding, the 9AM cutoff chip, a live clock, and the
 * horizontally scrolling section pills, plus Customer View (preview the
 * customer app as this admin, AdminCustomerSwitch) and Logout.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from './AppText';
import { useApp } from '../state/AppState';

export type AdminRoute =
  | 'admindashboard'
  | 'adminactiveorders'
  | 'admincompanies'
  | 'adminnotifications'
  | 'adminmenu'
  | 'adminusers'
  | 'adminreports'
  | 'adminsettings';

const TABS: { route: AdminRoute; label: string; path: string }[] = [
  { route: 'admindashboard', label: 'Overview', path: '/admin' },
  { route: 'adminactiveorders', label: 'Active Orders', path: '/admin/active-orders' },
  { route: 'admincompanies', label: 'Companies', path: '/admin/companies' },
  { route: 'adminnotifications', label: 'Notifications', path: '/admin/notifications' },
  { route: 'adminmenu', label: 'Menu Catalog', path: '/admin/menu' },
  { route: 'adminusers', label: 'Users', path: '/admin/users' },
  { route: 'adminreports', label: 'Reports', path: '/admin/reports' },
  { route: 'adminsettings', label: 'Settings', path: '/admin/settings' },
];

const clock = () => {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
};

export function AdminNavStrip({ activeRoute }: { activeRoute: AdminRoute }) {
  const { colors, signOut, enterCustomerView } = useApp();
  const router = useRouter();
  const [time, setTime] = useState(clock);

  useEffect(() => {
    const timer = setInterval(() => setTime(clock()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View>
      <View style={styles.brandRow}>
        <View style={styles.brand}>
          <Text style={styles.brandIcon}>⚙️</Text>
          <Text style={[styles.brandText, { color: colors.text }]}>Central Command</Text>
        </View>
        <View style={styles.brand}>
          <View style={styles.cutoff}>
            <Text style={styles.cutoffText}>9AM Cutoff</Text>
          </View>
          <View style={[styles.clock, { borderColor: colors.surfaceBorder, backgroundColor: colors.cardBg }]}>
            <Text style={[styles.clockText, { color: colors.text }]}>{time}</Text>
          </View>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {TABS.map(tab => {
          const active = tab.route === activeRoute;
          return (
            <Pressable
              key={tab.route}
              onPress={() => !active && router.replace(tab.path as never)}
              accessibilityRole="tab"
              aria-selected={active}
              style={({ pressed }) => [
                styles.pill,
                active ? { backgroundColor: colors.primary, borderColor: 'transparent' } : { borderColor: colors.surfaceBorder },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.pillText, { color: active ? colors.onPrimary : colors.text }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={enterCustomerView}
          accessibilityRole="button"
          style={({ pressed }) => [styles.pill, { backgroundColor: colors.brandGold, borderColor: 'transparent' }, pressed && styles.pressed]}
        >
          <Text style={[styles.pillText, { color: colors.onBrandGold }]}>👤 Customer View</Text>
        </Pressable>
        <Pressable
          onPress={() => signOut()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.pill, { borderColor: colors.error }, pressed && styles.pressed]}
        >
          <Text style={[styles.pillText, { color: colors.error }]}>Logout</Text>
        </Pressable>
      </ScrollView>
      <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandIcon: { fontSize: 14 },
  brandText: { fontSize: 14, fontWeight: '700' },
  cutoff: { backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  cutoffText: { fontSize: 9, fontWeight: '700', color: '#B45309' },
  clock: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  clockText: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pills: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  pill: { height: 36, borderRadius: 18, paddingHorizontal: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  divider: { height: 1 },
});

/**
 * Views/AdminNavStrip.xaml — embedded at the top of every admin page:
 * "Central Command" branding with the page title (it replaces the nav bar,
 * which only repeated the selected pill), the 9AM cutoff chip, a live clock, and the
 * horizontally scrolling section pills, plus Customer View (preview the
 * customer app as this admin, AdminCustomerSwitch) and Logout.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './AppText';
import { HScroll } from './ui';
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

/** `title` is the page's AdminShell Title, shown in the strip (there's no separate nav bar on a phone). */
const TABS: { route: AdminRoute; label: string; title: string; path: string }[] = [
  { route: 'admindashboard', label: 'Overview', title: 'Kitchen Operations Hub', path: '/admin' },
  { route: 'adminactiveorders', label: 'Active Orders', title: 'Active Orders', path: '/admin/active-orders' },
  { route: 'admincompanies', label: 'Companies', title: 'Companies & Locations', path: '/admin/companies' },
  { route: 'adminnotifications', label: 'Notifications', title: 'Broadcast Notifications', path: '/admin/notifications' },
  { route: 'adminmenu', label: 'Menu Catalog', title: 'Menu Catalog', path: '/admin/menu' },
  { route: 'adminusers', label: 'Users', title: 'User Management', path: '/admin/users' },
  { route: 'adminreports', label: 'Reports', title: 'Reports & Analytics', path: '/admin/reports' },
  { route: 'adminsettings', label: 'Settings', title: 'Settings', path: '/admin/settings' },
];

const clock = () => {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
};

export function AdminNavStrip({ activeRoute }: { activeRoute: AdminRoute }) {
  const { colors, signOut, enterCustomerView } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [time, setTime] = useState(clock);
  const [activeX, setActiveX] = useState<number | undefined>(undefined);
  const title = TABS.find(t => t.route === activeRoute)?.title ?? '';

  useEffect(() => {
    const timer = setInterval(() => setTime(clock()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={{ paddingTop: insets.top }}>
      <View style={styles.brandRow}>
        <Text style={[styles.caption, { color: colors.mutedText }]}>⚙️ Central Command</Text>
        <View style={styles.brand}>
          <View style={styles.cutoff}>
            <Text style={styles.cutoffText}>9AM Cutoff</Text>
          </View>
          <View style={[styles.clock, { borderColor: colors.surfaceBorder, backgroundColor: colors.cardBg }]}>
            <Text style={[styles.clockText, { color: colors.text }]}>{time}</Text>
          </View>
        </View>
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <HScroll contentContainerStyle={styles.pills} focusX={activeX}>
        {TABS.map(tab => {
          const active = tab.route === activeRoute;
          return (
            <Pressable
              key={tab.route}
              onLayout={active ? e => setActiveX(e.nativeEvent.layout.x) : undefined}
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
      </HScroll>
      <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  caption: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', paddingHorizontal: 16, marginTop: 2 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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

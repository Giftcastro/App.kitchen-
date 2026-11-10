import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../BrandLogo';

export type AdminRoute =
  | 'overview'
  | 'active-orders'
  | 'companies'
  | 'notifications'
  | 'menu'
  | 'users'
  | 'reports'
  | 'settings';

interface AdminNavStripProps {
  activeRoute: AdminRoute;
  onRouteChange: (route: AdminRoute) => void;
  allowedRoutes?: AdminRoute[];
  onEnterCustomerView?: () => void;
  onLogout?: () => void;
}

const TABS: { route: AdminRoute; label: string; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { route: 'overview', label: 'Overview', title: 'Kitchen Operations Hub', icon: 'speedometer' },
  { route: 'active-orders', label: 'Active Orders', title: 'Active Orders & Upcoming Deliveries', icon: 'cube' },
  { route: 'companies', label: 'Companies', title: 'Companies & Locations', icon: 'business' },
  { route: 'notifications', label: 'Notifications', title: 'Broadcast Notifications', icon: 'megaphone' },
  { route: 'menu', label: 'Menu Catalog', title: 'Menu Catalog & 8-Week Cycle', icon: 'restaurant' },
  { route: 'users', label: 'Users', title: 'User Management', icon: 'people' },
  { route: 'reports', label: 'Reports', title: 'Reports & Analytics', icon: 'bar-chart' },
  { route: 'settings', label: 'Settings', title: 'Settings & Dispatch Preferences', icon: 'settings' },
];

export const AdminNavStrip: React.FC<AdminNavStripProps> = ({
  activeRoute,
  onRouteChange,
  allowedRoutes,
  onEnterCustomerView,
  onLogout,
}) => {
  const { theme } = useTheme();
  const { signOut } = useAuth();
  const [sastTime, setSastTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const sast = new Date(utc + 2 * 3600000);
      const h = String(sast.getHours()).padStart(2, '0');
      const m = String(sast.getMinutes()).padStart(2, '0');
      const s = String(sast.getSeconds()).padStart(2, '0');
      setSastTime(`${h}:${m}:${s}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeTabInfo = TABS.find((t) => t.route === activeRoute) || TABS[0];

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceElevated, borderBottomColor: theme.surfaceBorder }]}>
      {/* 1. Brand Row with Logo, Admin Tag, 9AM Cutoff and Live Clock */}
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <BrandLogo variant="compact" style={{ height: 26, width: 88, marginRight: 8 }} />
          <View style={[styles.adminPill, { backgroundColor: theme.primaryMuted, borderColor: theme.primary }]}>
            <Text style={[styles.adminPillText, { color: theme.primary }]}>Admin</Text>
          </View>
        </View>
        <View style={styles.brandRight}>
          <View style={[styles.cutoffChip, { backgroundColor: theme.goldWarningSurface, borderColor: theme.goldWarningBorder }]}>
            <Text style={[styles.cutoffText, { color: theme.goldWarning }]}>9:00 AM Cutoff</Text>
          </View>
          <View style={[styles.clockBadge, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Ionicons name="time-outline" size={12} color={theme.textPrimary} />
            <Text style={[styles.clockText, { color: theme.textPrimary }]}>{sastTime}</Text>
          </View>
        </View>
      </View>

      {/* 2. Active Tab Title */}
      <View style={styles.titleRow}>
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]} numberOfLines={1}>
          {activeTabInfo.title}
        </Text>
      </View>

      {/* 3. Horizontally Scrolling Admin Section Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsScroll}
      >
        {TABS.filter((tab) => !allowedRoutes || allowedRoutes.includes(tab.route)).map((tab) => {
          const isActive = tab.route === activeRoute;
          return (
            <TouchableOpacity
              key={tab.route}
              activeOpacity={0.8}
              onPress={() => onRouteChange(tab.route)}
              style={[
                styles.pill,
                isActive
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              ]}
            >
              <Ionicons
                name={tab.icon}
                size={13}
                color={isActive ? theme.textInverse : theme.textSecondary}
              />
              <Text
                style={[
                  styles.pillText,
                  { color: isActive ? theme.textInverse : theme.textPrimary },
                  isActive && styles.pillTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Customer View Switcher Pill */}
        {onEnterCustomerView && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onEnterCustomerView}
            style={[styles.pill, styles.customerViewPill, { backgroundColor: theme.brandGold, borderColor: theme.brandGold }]}
          >
            <Ionicons name="person-outline" size={13} color={theme.onBrandGold} />
            <Text style={[styles.pillText, styles.pillTextActive, { color: theme.onBrandGold }]}>
              Customer View
            </Text>
          </TouchableOpacity>
        )}

        {/* Logout Pill */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onLogout || signOut}
          style={[styles.pill, styles.logoutPill, { borderColor: theme.error, backgroundColor: theme.surface }]}
        >
          <Ionicons name="log-out-outline" size={13} color={theme.error} />
          <Text style={[styles.pillText, { color: theme.error, fontWeight: '700' }]}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingTop: 8,
    paddingBottom: 4,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  adminPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  brandCaption: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  brandRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cutoffChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  cutoffText: {
    fontSize: 10,
    fontWeight: '800',
  },
  clockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  clockText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  titleRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  pillsScroll: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    fontWeight: '800',
  },
  customerViewPill: {
    marginLeft: 4,
  },
  logoutPill: {
    marginLeft: 2,
  },
});

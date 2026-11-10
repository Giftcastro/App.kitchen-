import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { BrandLogo } from '../BrandLogo';

export const AdminHeader: React.FC = () => {
  const { theme } = useTheme();
  const { currentUser, setMockRole } = useAuth();
  const [sastTime, setSastTime] = useState<string>('');

  // Live SAST (UTC+2) Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const sastDate = new Date(utc + 2 * 3600000);
      const hours = String(sastDate.getHours()).padStart(2, '0');
      const minutes = String(sastDate.getMinutes()).padStart(2, '0');
      const seconds = String(sastDate.getSeconds()).padStart(2, '0');
      setSastTime(`${hours}:${minutes}:${seconds} SAST`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const role = currentUser?.role || 'admin';

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceElevated, borderBottomColor: theme.surfaceBorder }]}>
      {/* Top Row: Brand & Live Clock */}
      <View style={styles.topRow}>
        <View style={styles.brandCol}>
          <View style={styles.brandTitleRow}>
            <BrandLogo variant="compact" style={{ height: 26, width: 88, marginRight: 8 }} />
            <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>
              Admin
            </Text>
          </View>
          <Text style={[styles.brandSub, { color: theme.textSecondary }]}>
            Culinary Logistics & Kitchen Ops
          </Text>
        </View>

        {/* Live SAST Clock & Cutoff Indicator */}
        <View style={styles.clockCol}>
          <View style={[styles.clockBadge, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Ionicons name="time" size={13} color={theme.goldWarning} />
            <Text style={[styles.clockText, { color: theme.textPrimary }]}>{sastTime}</Text>
          </View>
          <View style={[styles.cutoffPill, { backgroundColor: theme.goldWarningSurface }]}>
            <Text style={[styles.cutoffPillText, { color: theme.goldWarning }]}>9:00 AM Cutoff Active</Text>
          </View>
        </View>
      </View>

      {/* Bottom Row: Role Badge + Quick Role Switcher for Testing */}
      <View style={styles.roleRow}>
        <View
          style={[
            styles.rolePill,
            role === 'admin'
              ? { backgroundColor: theme.goldWarningSurface, borderColor: theme.goldWarningBorder }
              : { backgroundColor: theme.successSurface, borderColor: theme.successBorder },
          ]}
        >
          <Text
            style={[
              styles.rolePillText,
              { color: role === 'admin' ? theme.goldWarning : theme.success },
            ]}
          >
            {role === 'admin' ? 'System Administrator' : '👨‍🍳 Head Chef / Dispatch Lead'}
          </Text>
        </View>

        {/* Dev / Demo Role Switcher */}
        <View style={styles.switchGroup}>
          <Text style={[styles.switchLabel, { color: theme.textMuted }]}>Role Mode:</Text>
          <TouchableOpacity
            onPress={() => setMockRole('admin')}
            style={[
              styles.switchBtn,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              role === 'admin' && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
          >
            <Text
              style={[
                styles.switchBtnText,
                { color: role === 'admin' ? theme.textInverse : theme.textSecondary },
              ]}
            >
              Admin
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMockRole('chef')}
            style={[
              styles.switchBtn,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              role === 'chef' && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
          >
            <Text
              style={[
                styles.switchBtnText,
                { color: role === 'chef' ? theme.textInverse : theme.textSecondary },
              ]}
            >
              Chef
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandCol: {
    flex: 1,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  brandSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  clockCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  clockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  clockText: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  cutoffPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cutoffPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  rolePill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  switchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  switchBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

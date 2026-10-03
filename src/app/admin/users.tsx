/** AdminUsersPage.xaml + AdminUsersViewModel — "User Management". */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { Btn, Card, Page, Picker, SearchBar } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { getUsers, updateUser } from '../../services/directory';
import { fmtShortMonthYear } from '../../services/scheduling';
import type { Role, UserAccount } from '../../models';
import { fixed } from '../../utils/theme';

const ROLE_FILTERS = ['All', 'Customer', 'Kitchen Staff', 'Admin'];

export default function AdminUsersScreen() {
  const { colors, isDark, user: me } = useApp();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  useFocusEffect(
    useCallback(() => {
      getUsers()
        .then(setUsers)
        .catch(err => alerts.show('Could Not Load', (err as Error)?.message ?? 'Check your connection and try again.', 'OK'));
    }, [])
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter(
      u => (!q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) && (roleFilter === 'All' || u.role === roleFilter)
    );
  }, [users, searchQuery, roleFilter]);

  const save = async (updated: UserAccount) => {
    await updateUser(updated);
    setUsers(list => list.map(u => (u.id === updated.id ? updated : u)));
  };

  const toggleStatus = async (account: UserAccount) => {
    if (account.id === me?.id) {
      await alerts.show('Not Allowed', "You can't suspend your own account.", 'OK');
      return;
    }
    const updated = { ...account, isActive: !account.isActive };
    try {
      await save(updated);
      await alerts.show('User Status Updated', `${account.fullName}'s account has been ${updated.isActive ? 'activated' : 'suspended'}.`, 'OK');
    } catch (err) {
      await alerts.show('Not Saved', (err as Error)?.message ?? 'Could not update this account.', 'OK');
    }
  };

  const changeRole = async (account: UserAccount) => {
    const action = await alerts.actionSheet(`Assign New Role for ${account.fullName}`, 'Cancel', 'Customer', 'Kitchen Staff', 'Admin');
    if (!action) return;
    if (account.id === me?.id && action !== 'Admin') {
      await alerts.show('Not Allowed', "You can't remove your own admin access.", 'OK');
      return;
    }
    try {
      await save({ ...account, role: action as Role });
    } catch (err) {
      await alerts.show('Not Saved', (err as Error)?.message ?? 'Could not update this account.', 'OK');
    }
  };

  return (
    <Page>
      <AdminNavStrip activeRoute="adminusers" />
      <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search by name or email..." style={styles.search} />
      <View style={styles.filterRow}>
        <Text style={[styles.filterLabel, { color: colors.primary }]}>Role Filter:</Text>
        <Picker title="Filter Role" options={ROLE_FILTERS} selected={roleFilter} onSelect={setRoleFilter} width={160} />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={u => u.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: account }) => (
          <Card radius={12} bg={isDark ? '#1E1E1E' : '#FFFFFF'} style={styles.card}>
            <View style={styles.top}>
              <View style={styles.flex}>
                <Text style={[styles.name, { color: colors.text }]}>{account.fullName}</Text>
                <Text style={styles.email}>{account.email}</Text>
              </View>
              <View style={[styles.roleChip, { backgroundColor: fixed.badgeBg }]}>
                <Text style={[styles.roleText, { color: colors.primary }]}>{account.role}</Text>
              </View>
            </View>
            <View style={styles.meta}>
              <Text style={styles.joined}>Joined: {fmtShortMonthYear(account.joinedDate)}</Text>
              {!account.isActive && <Text style={styles.suspended}>Status: Suspended</Text>}
            </View>
            <View style={styles.actions}>
              <Btn title="Change Role" onPress={() => changeRole(account)} variant="neutral" fontSize={12} height={36} paddingH={12} />
              {account.isActive ? (
                <Btn title="Suspend" onPress={() => toggleStatus(account)} bg="#C62828" color="#FFFFFF" fontSize={12} height={36} paddingH={12} />
              ) : (
                <Btn title="Activate" onPress={() => toggleStatus(account)} bg="#2E7D32" color="#FFFFFF" fontSize={12} height={36} paddingH={12} />
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
  search: { marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12 },
  filterLabel: { fontSize: 12, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  card: { marginBottom: 12 },
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { fontSize: 16, fontWeight: '700' },
  email: { fontSize: 12, color: '#888888' },
  roleChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  roleText: { fontSize: 11, fontWeight: '700' },
  meta: { flexDirection: 'row', gap: 10, marginTop: 8 },
  joined: { fontSize: 11, color: '#AAAAAA' },
  suspended: { fontSize: 11, color: '#E53935', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});

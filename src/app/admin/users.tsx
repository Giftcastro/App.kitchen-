/** AdminUsersPage.xaml + AdminUsersViewModel — "User Management". */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '../../components/AppText';
import { alerts } from '../../components/Alerts';
import { AdminNavStrip } from '../../components/AdminNavStrip';
import { Btn, Card, Page, Picker, SearchBar } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { createUserAccount, getCompanies, getUsers, TEMP_PASSWORD, updateUser } from '../../services/directory';
import { fmtShortMonthYear } from '../../services/scheduling';
import type { Role, UserAccount } from '../../models';

const ROLE_FILTERS = ['All', 'Customer', 'Kitchen Staff', 'Admin'];

export default function AdminUsersScreen() {
  const { colors, user: me } = useApp();
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
    if (account.isActive) {
      const confirmed = await alerts.confirm(
        'Suspend User',
        `Suspend ${account.fullName}? They won't be able to sign in or order until you activate them again.`,
        'Suspend',
        'Cancel'
      );
      if (!confirmed) return;
    }
    const updated = { ...account, isActive: !account.isActive };
    try {
      await save(updated);
      await alerts.show('User Status Updated', `${account.fullName}'s account has been ${updated.isActive ? 'activated' : 'suspended'}.`, 'OK');
    } catch (err) {
      await alerts.show('Not Saved', (err as Error)?.message ?? 'Could not update this account.', 'OK');
    }
  };

  /** + Add User — name, email, role; customers can be filed under a company + location + floor. */
  const addUser = async () => {
    const fullName = await alerts.prompt('New User', 'Full name:');
    if (!fullName?.trim()) return;
    let email = await alerts.prompt('New User', 'Email address:', { keyboard: 'email-address' });
    if (!email?.trim()) return;
    email = email.trim().toLowerCase();
    if (!email.includes('@')) {
      await alerts.show('Invalid Email', 'Please enter a valid email address.', 'OK');
      return;
    }
    if (users.some(u => u.email.toLowerCase() === email)) {
      await alerts.show('Already Registered', `${email} already has an account.`, 'OK');
      return;
    }
    const role = (await alerts.actionSheet('Role', 'Cancel', 'Customer', 'Kitchen Staff', 'Admin')) as Role | null;
    if (!role) return;

    let companyId = '';
    let locationId = '';
    let deliveryFloor = '';
    if (role === 'Customer') {
      const companies = await getCompanies().catch(() => []);
      if (companies.length > 0) {
        const companyChoice = await alerts.actionSheet('Company', 'Skip', ...companies.map(c => c.name));
        const company = companies.find(c => c.name === companyChoice);
        if (company) {
          companyId = company.id;
          if (company.locations.length === 1) {
            locationId = company.locations[0].id;
          } else if (company.locations.length > 1) {
            const locChoice = await alerts.actionSheet('Delivery location', 'Skip', ...company.locations.map(l => l.name));
            locationId = company.locations.find(l => l.name === locChoice)?.id ?? '';
          }
          deliveryFloor = (await alerts.prompt('Floor / Desk', 'Where should deliveries go? (optional)'))?.trim() ?? '';
        }
      }
    }

    try {
      const { needsConfirmation } = await createUserAccount({ fullName: fullName.trim(), email, role, companyId, locationId, deliveryFloor });
      setUsers(await getUsers());
      await alerts.show(
        'User Added',
        `${fullName.trim()} (${role}) can now sign in with ${email} and the temporary password "${TEMP_PASSWORD}".` +
          (needsConfirmation ? ' They need to confirm their email address first.' : ''),
        'OK'
      );
    } catch (err) {
      await alerts.show('Not Added', (err as Error)?.message ?? 'Could not create this account.', 'OK');
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
        <Text style={[styles.filterLabel, { color: colors.brandGold }]} numberOfLines={1}>
          Role
        </Text>
        <Picker title="Filter Role" options={ROLE_FILTERS} selected={roleFilter} onSelect={setRoleFilter} style={styles.flex} />
        <Btn
          title="+ Add User"
          onPress={addUser}
          bg={colors.brandGold}
          color={colors.onBrandGold}
          bold
          fontSize={12}
          height={36}
          radius={8}
          paddingH={12}
          style={styles.addUser}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={u => u.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: account }) => (
          <Card radius={12} style={styles.card}>
            <View style={styles.top}>
              <View style={styles.flex}>
                <Text style={[styles.name, { color: colors.text }]}>
                  {account.fullName}
                  {account.id === me?.id && <Text style={[styles.you, { color: colors.mutedText }]}> (you)</Text>}
                </Text>
                <Text style={[styles.email, { color: colors.mutedText }]}>{account.email}</Text>
              </View>
              <View style={[styles.roleChip, { backgroundColor: colors.subtleFillStrong }]}>
                <Text style={[styles.roleText, { color: colors.brandGold }]}>{account.role}</Text>
              </View>
            </View>
            <View style={styles.meta}>
              <Text style={[styles.joined, { color: colors.mutedText }]}>Joined: {fmtShortMonthYear(account.joinedDate)}</Text>
              {!account.isActive && <Text style={styles.suspended}>Status: Suspended</Text>}
            </View>
            <View style={styles.actions}>
              <Btn title="Change Role" onPress={() => changeRole(account)} variant="neutral" fontSize={12} height={36} paddingH={12} />
              {account.id === me?.id ? null : account.isActive ? (
                <Btn title="Suspend" onPress={() => toggleStatus(account)} variant="dangerOutline" fontSize={12} height={36} paddingH={12} />
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
  addUser: { marginLeft: 4 },
  you: { fontSize: 13, fontWeight: '400' },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  card: { marginBottom: 12 },
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { fontSize: 16, fontWeight: '700' },
  email: { fontSize: 12 },
  roleChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  roleText: { fontSize: 11, fontWeight: '700' },
  meta: { flexDirection: 'row', gap: 10, marginTop: 8 },
  joined: { fontSize: 11 },
  suspended: { fontSize: 11, color: '#E53935', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { UserRole } from '../../types';
import {
  fetchAdminUsersFromDb,
  adminUpdateUserRoleInDb,
  adminToggleUserSuspendInDb,
  adminDeleteUserFromDb,
} from '../../services/supabaseDataService';

interface ManagedUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole | 'customer';
  companyName: string;
  deliveryFloor: string;
  isActive: boolean;
  joinedDate: string;
}

export const AdminUsersTab: React.FC = () => {
  const { theme, isDark } = useTheme();
  const { currentUser } = useAuth();
  const { corporateAccounts } = useCart();

  // Users list (hydrated directly from Supabase profiles)
  const [users, setUsers] = useState<ManagedUser[]>([]);

  // Track which user cards are expanded (compressed by default, matching Orders & Companies)
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set());

  const toggleUserExpand = (userId: string) => {
    setExpandedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  useEffect(() => {
    const loadUsers = async () => {
      const dbUsers = await fetchAdminUsersFromDb();
      if (dbUsers.length > 0) {
        setUsers(
          dbUsers.map((u) => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            role: u.role,
            companyName: u.companyName,
            deliveryFloor: u.deliveryFloor,
            isActive: u.isActive,
            joinedDate: u.joinedDate || new Date().toISOString().slice(0, 10),
          }))
        );
      }
    };
    loadUsers();
  }, []);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [companyFilter, setCompanyFilter] = useState<string>('All');
  const [isRoleFilterModalOpen, setIsRoleFilterModalOpen] = useState(false);
  const [isCompanyFilterModalOpen, setIsCompanyFilterModalOpen] = useState(false);

  // Role Change Modal
  const [editingRoleUser, setEditingRoleUser] = useState<ManagedUser | null>(null);

  // Add User Modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('user');
  const [addCompany, setAddCompany] = useState(corporateAccounts[0]?.companyName || 'Corporate Partner');
  const [addFloor, setAddFloor] = useState('Floor 3 (Reception Pantry)');

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !searchQuery.trim() ||
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.companyName.toLowerCase().includes(searchQuery.toLowerCase());
      const isCust = u.role === 'user' || u.role === 'customer';
      const matchRole =
        roleFilter === 'All' ||
        (roleFilter === 'Customer' && isCust) ||
        (roleFilter === 'Kitchen Staff' && u.role === 'chef') ||
        (roleFilter === 'Admin' && u.role === 'admin');
      const matchCompany = companyFilter === 'All' || u.companyName === companyFilter;
      return matchSearch && matchRole && matchCompany;
    });
  }, [users, searchQuery, roleFilter, companyFilter]);

  // Role Change Handler
  const handleSelectRole = async (newRole: UserRole) => {
    if (!editingRoleUser) return;
    if (editingRoleUser.email === currentUser?.email && newRole !== 'admin') {
      Alert.alert('Action Blocked', 'You cannot remove your own administrator access.');
      setEditingRoleUser(null);
      return;
    }

    const targetId = editingRoleUser.id;
    const targetName = editingRoleUser.fullName;
    const previousRole = editingRoleUser.role;
    setUsers((prev) =>
      prev.map((u) => (u.id === targetId ? { ...u, role: newRole } : u))
    );
    setEditingRoleUser(null);
    if (!(await adminUpdateUserRoleInDb(targetId, newRole))) {
      setUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, role: previousRole } : u)));
      Alert.alert('Not Saved', `${targetName}'s role could not be changed.`);
      return;
    }
    Alert.alert(
      'Role Updated',
      `${targetName}'s role set to ${
        newRole === 'user' ? 'Customer' : newRole === 'chef' ? 'Kitchen Staff' : 'Admin'
      }.`
    );
  };

  // Suspend / Activate Handler
  const handleToggleSuspend = (user: ManagedUser) => {
    if (user.email === currentUser?.email) {
      Alert.alert('Action Blocked', 'You cannot suspend your own account.');
      return;
    }
    const isSuspending = user.isActive;
    Alert.alert(
      isSuspending ? 'Suspend Account?' : 'Reactivate Account?',
      isSuspending
        ? `Suspend ${user.fullName}? They will be blocked from viewing and placing orders.`
        : `Reactivate ${user.fullName}'s account access?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isSuspending ? 'Suspend' : 'Reactivate',
          style: isSuspending ? 'destructive' : 'default',
          onPress: async () => {
            setUsers((prev) =>
              prev.map((u) => (u.id === user.id ? { ...u, isActive: !isSuspending } : u))
            );
            if (!(await adminToggleUserSuspendInDb(user.id, isSuspending))) {
              setUsers((prev) =>
                prev.map((u) => (u.id === user.id ? { ...u, isActive: isSuspending } : u))
              );
              Alert.alert('Not Saved', `${user.fullName}'s account could not be updated.`);
            }
          },
        },
      ]
    );
  };

  // Delete User Handler
  const handleDeleteUser = (user: ManagedUser) => {
    if (user.email === currentUser?.email) {
      Alert.alert('Action Blocked', 'You cannot delete your own account.');
      return;
    }
    Alert.alert(
      'Confirm User Deletion',
      `Delete ${user.fullName} (${user.email})? Their name, email, phone and allergy notes are permanently removed. Their orders and invoices are kept anonymously for 5 years.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            const failure = await adminDeleteUserFromDb(user.id);
            if (failure) {
              Alert.alert('Not Deleted', failure);
              return;
            }
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            Alert.alert('Customer Deleted', `${user.fullName}'s personal details have been removed. Their records are kept anonymously.`);
          },
        },
      ]
    );
  };

  // Add User Handler
  const handleAddUser = () => {
    if (!addName.trim() || !addEmail.trim() || !addEmail.includes('@')) {
      Alert.alert('Invalid Input', 'Please enter a valid full name and email address.');
      return;
    }
    // Creating a sign-in account needs a server function, which does not exist yet.
    setIsAddUserOpen(false);
    Alert.alert(
      'Not Added',
      `Accounts cannot be created from here yet. Ask ${addName.trim()} to sign up in the app with ${addEmail.trim().toLowerCase()}, then set their role on this screen.`
    );
    setAddName('');
    setAddEmail('');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search clients by name, email or company..."
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.textPrimary }]}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Role & Company Filter Dropdowns */}
      <View style={styles.filterDropdownsRow}>
        {/* Role Dropdown */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsRoleFilterModalOpen(true)}
          style={[styles.filterDropdownChip, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
        >
          <Ionicons name="people" size={13} color={theme.brandGold} />
          <Text style={[styles.filterDropdownChipText, { color: theme.textPrimary }]} numberOfLines={1}>
            Role: {roleFilter === 'All' ? 'All Roles' : roleFilter === 'Kitchen Staff' ? 'Kitchen (Chef)' : roleFilter}
          </Text>
          <Ionicons name="chevron-down" size={12} color={theme.textMuted} />
        </TouchableOpacity>

        {/* Company Dropdown */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsCompanyFilterModalOpen(true)}
          style={[styles.filterDropdownChip, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
        >
          <Ionicons name="business" size={13} color={theme.brandGold} />
          <Text style={[styles.filterDropdownChipText, { color: theme.textPrimary }]} numberOfLines={1}>
            {companyFilter === 'All' ? 'All Companies' : companyFilter}
          </Text>
          <Ionicons name="chevron-down" size={12} color={theme.textMuted} />
        </TouchableOpacity>

        {/* Add User Action Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsAddUserOpen(true)}
          style={[styles.addUserBtn, { backgroundColor: theme.brandGold }]}
        >
          <Ionicons name="person-add" size={14} color={theme.onBrandGold} />
          <Text style={[styles.addUserBtnText, { color: theme.onBrandGold }]}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Users List (Compressed Accordion Cards) */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={40} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No users found matching these search criteria.
            </Text>
          </View>
        }
        renderItem={({ item: user }) => {
          const isMe = user.email === currentUser?.email;
          const isExpanded = expandedUserIds.has(user.id);
          const roleLabel =
            user.role === 'admin' ? 'Admin' : user.role === 'chef' ? 'Kitchen Staff' : 'Customer';
          const roleColor =
            user.role === 'admin' ? theme.brandGold : user.role === 'chef' ? '#FB8C00' : theme.primary;

          return (
            <View style={[styles.userCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              {/* Compressed Header (Tap to Expand) */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => toggleUserExpand(user.id)}
                style={styles.compressedUserHeaderBtn}
              >
                <View style={styles.userHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
                      {user.fullName}{' '}
                      {isMe && <Text style={{ color: theme.brandGold, fontWeight: '800' }}>(You)</Text>}
                    </Text>
                    <Text style={[styles.compressedSubtext, { color: theme.textSecondary }]} numberOfLines={1}>
                      🏢 {user.companyName} •{' '}
                      <Text style={{ color: user.isActive ? '#43A047' : '#EF4444', fontWeight: '700' }}>
                        {user.isActive ? 'Active' : 'Suspended'}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.headerRightGroup}>
                    <View style={[styles.roleBadge, { backgroundColor: theme.chipBg }]}>
                      <Text style={[styles.roleBadgeText, { color: roleColor }]}>{roleLabel}</Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={theme.textMuted}
                    />
                  </View>
                </View>

                <Text style={[styles.expandHintText, { color: theme.brandGold }]}>
                  {isExpanded ? 'Hide user details & controls' : 'Tap to view email, drop-off & role actions'}
                </Text>
              </TouchableOpacity>

              {/* Expanded User Details & Controls */}
              {isExpanded && (
                <View style={[styles.expandedUserBody, { borderTopColor: theme.surfaceBorder }]}>
                  <View style={styles.detailLine}>
                    <Ionicons name="mail-outline" size={13} color={theme.textSecondary} />
                    <Text style={[styles.userEmail, { color: theme.textSecondary }]} numberOfLines={1}>
                      {user.email}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={[styles.infoText, { color: theme.textMuted }]}>
                      📍 Drop-off: {user.companyName} • {user.deliveryFloor || 'Reception'}
                    </Text>
                    <Text
                      style={[
                        styles.statusText,
                        { color: user.isActive ? '#43A047' : '#EF4444' },
                      ]}
                    >
                      {user.isActive ? '● Active' : '● Suspended'}
                    </Text>
                  </View>

                  {user.joinedDate ? (
                    <Text style={{ fontSize: 11, color: theme.textMuted }}>
                      🗓️ Joined: {user.joinedDate.slice(0, 10)}
                    </Text>
                  ) : null}

                  {/* Action Buttons */}
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setEditingRoleUser(user)}
                      style={[styles.actionBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}
                    >
                      <Ionicons name="key-outline" size={13} color={theme.primary} />
                      <Text style={[styles.actionBtnText, { color: theme.primary }]} numberOfLines={1}>
                        Change Role
                      </Text>
                    </TouchableOpacity>

                    {!isMe && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleToggleSuspend(user)}
                        style={[
                          styles.actionBtn,
                          { borderColor: user.isActive ? theme.goldWarning : '#43A047', backgroundColor: theme.surfaceElevated },
                        ]}
                      >
                        <Ionicons
                          name={user.isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                          size={13}
                          color={user.isActive ? theme.goldWarning : '#43A047'}
                        />
                        <Text style={[styles.actionBtnText, { color: user.isActive ? theme.goldWarning : '#43A047' }]} numberOfLines={1}>
                          {user.isActive ? 'Suspend' : 'Activate'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {!isMe && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleDeleteUser(user)}
                        style={[styles.actionBtn, { borderColor: theme.error, backgroundColor: theme.surfaceElevated }]}
                      >
                        <Ionicons name="trash-outline" size={13} color={theme.error} />
                        <Text style={[styles.actionBtnText, { color: theme.error }]} numberOfLines={1}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* --- Change Role Modal --- */}
      <Modal visible={!!editingRoleUser} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Assign Account Role</Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              {editingRoleUser?.fullName} ({editingRoleUser?.email})
            </Text>

            <View style={{ width: '100%', gap: 10, marginVertical: 8 }}>
              <TouchableOpacity
                onPress={() => handleSelectRole('user')}
                style={[styles.roleSelectRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              >
                <Text style={{ fontSize: 18 }}>👤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleSelectTitle, { color: theme.textPrimary }]}>Customer</Text>
                  <Text style={[styles.roleSelectDesc, { color: theme.textSecondary }]}>
                    Can place orders, choose dates, rate dishes
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSelectRole('chef')}
                style={[styles.roleSelectRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              >
                <Text style={{ fontSize: 18 }}>👨‍🍳</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleSelectTitle, { color: theme.textPrimary }]}>Kitchen Staff / Chef</Text>
                  <Text style={[styles.roleSelectDesc, { color: theme.textSecondary }]}>
                    Access to daily dispatch and prep sheets
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSelectRole('admin')}
                style={[styles.roleSelectRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              >
                <Text style={{ fontSize: 18 }}>⚙️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleSelectTitle, { color: theme.textPrimary }]}>System Administrator</Text>
                  <Text style={[styles.roleSelectDesc, { color: theme.textSecondary }]}>
                    Full access to financial configuration, users &amp; catalog
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setEditingRoleUser(null)}
              style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder, width: '100%' }]}
            >
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- Add User Modal --- */}
      <Modal visible={isAddUserOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Enroll New User</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Full Name:</Text>
              <TextInput
                value={addName}
                onChangeText={setAddName}
                placeholder="Jane Doe"
                placeholderTextColor={theme.textMuted}
                style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Email Address:</Text>
              <TextInput
                value={addEmail}
                onChangeText={setAddEmail}
                placeholder="jane.doe@company.co.za"
                keyboardType="email-address"
                placeholderTextColor={theme.textMuted}
                style={[styles.inputField, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.surfaceBorder }]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.brandGold }]}>Assign Role:</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['user', 'chef', 'admin'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setAddRole(r)}
                    style={[
                      styles.rolePillBtn,
                      addRole === r && { backgroundColor: theme.primary },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: addRole === r ? theme.textInverse : theme.textSecondary }}>
                      {r === 'user' ? 'Customer' : r === 'chef' ? 'Staff' : 'Admin'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setIsAddUserOpen(false)} style={[styles.modalCancelBtn, { borderColor: theme.surfaceBorder, flex: 1 }]}>
                <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddUser} style={[styles.modalSaveBtn, { backgroundColor: theme.brandGold }]}>
                <Text style={{ color: theme.onBrandGold, fontWeight: '800' }}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Role Filter Modal */}
      <Modal visible={isRoleFilterModalOpen} transparent animationType="fade" onRequestClose={() => setIsRoleFilterModalOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setIsRoleFilterModalOpen(false)} style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.filterModalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.filterModalTitle, { color: theme.textPrimary }]}>Filter Users by Role</Text>
            {['All', 'Customer', 'Kitchen Staff', 'Admin'].map((r) => {
              const isSelected = roleFilter === r;
              return (
                <TouchableOpacity
                  key={r}
                  activeOpacity={0.7}
                  onPress={() => {
                    setRoleFilter(r);
                    setIsRoleFilterModalOpen(false);
                  }}
                  style={[
                    styles.filterOptionItem,
                    { borderBottomColor: theme.surfaceBorder },
                    isSelected && { backgroundColor: theme.primaryMuted },
                  ]}
                >
                  <Text style={[styles.filterOptionText, { color: isSelected ? theme.primary : theme.textPrimary, fontWeight: isSelected ? '700' : '500' }]}>
                    {r === 'All' ? 'All Roles' : r === 'Kitchen Staff' ? 'Kitchen Staff (Chef Role)' : r}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Company Filter Modal */}
      <Modal visible={isCompanyFilterModalOpen} transparent animationType="fade" onRequestClose={() => setIsCompanyFilterModalOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setIsCompanyFilterModalOpen(false)} style={styles.modalBackdrop}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor:theme.overlay},
            ]}
          />
          <View style={[styles.filterModalCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.filterModalTitle, { color: theme.textPrimary }]}>Filter Users by Company</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {['All', ...corporateAccounts.map((c) => c.companyName)].map((comp) => {
                const isSelected = companyFilter === comp;
                return (
                  <TouchableOpacity
                    key={comp}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCompanyFilter(comp);
                      setIsCompanyFilterModalOpen(false);
                    }}
                    style={[
                      styles.filterOptionItem,
                      { borderBottomColor: theme.surfaceBorder },
                      isSelected && { backgroundColor: theme.primaryMuted },
                    ]}
                  >
                    <Text style={[styles.filterOptionText, { color: isSelected ? theme.primary : theme.textPrimary, fontWeight: isSelected ? '700' : '500' }]}>
                      {comp === 'All' ? 'All Companies' : comp}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  filterDropdownsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  filterDropdownChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
  },
  filterDropdownChipText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  filterModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  filterModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  filterOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  filterOptionText: {
    fontSize: 13,
  },
  addUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    flexShrink: 0,
  },
  addUserBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
  },
  userCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  compressedUserHeaderBtn: {
    gap: 6,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
  },
  compressedSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  expandHintText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expandedUserBody: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 2,
    gap: 8,
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userEmail: {
    fontSize: 12,
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 11,
    flex: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
    paddingTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: -8,
  },
  roleSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  roleSelectTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  roleSelectDesc: {
    fontSize: 11,
  },
  modalCancelBtn: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputField: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  rolePillBtn: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalSaveBtn: {
    flex: 1.5,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

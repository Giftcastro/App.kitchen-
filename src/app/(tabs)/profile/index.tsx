/** ProfilePage.xaml + ProfileViewModel. */
import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text } from '../../../components/AppText';
import { alerts } from '../../../components/Alerts';
import { Btn, Card, Divider, Page } from '../../../components/ui';
import { useApp } from '../../../state/AppState';
import { getCompany, getDeliveryLocation, updateDeliveryFloor } from '../../../services/directory';
import { fmtMonthYear } from '../../../services/scheduling';

export default function ProfileScreen() {
  const { colors, user, setUser, signOut } = useApp();
  const router = useRouter();
  const [companyName, setCompanyName] = useState('—');
  const [mealSubsidyLabel, setMealSubsidyLabel] = useState('');
  const [locationName, setLocationName] = useState('—');

  // Company name / subsidy and delivery location are looked up on each visit.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      if (user.accountType === 'company' && user.companyId) {
        getCompany(user.companyId)
          .then(company => {
            setCompanyName(company?.name ?? '—');
            setMealSubsidyLabel(company ? `R${company.mealSubsidyAmount.toFixed(2)} per meal, incl. VAT` : '');
          })
          .catch(() => {});
      } else {
        setCompanyName('—');
        setMealSubsidyLabel('');
      }
      getDeliveryLocation(user)
        .then(location => setLocationName(location?.name ?? '—'))
        .catch(() => {});
    }, [user])
  );

  if (!user) return null;

  /** The floor/desk is the only profile field a customer can edit themselves. */
  const editDeliveryFloor = async () => {
    const newFloor = await alerts.prompt('Delivery Floor', 'Which floor or pantry drop-off point should your order be delivered to?', {
      initialValue: user.deliveryFloor,
    });
    if (newFloor === null) return;
    try {
      await updateDeliveryFloor(user.id, newFloor);
      setUser({ ...user, deliveryFloor: newFloor });
    } catch (err) {
      await alerts.show('Not Saved', (err as Error)?.message ?? 'Could not save your delivery floor.', 'OK');
    }
  };

  const confirmSignOut = async () => {
    const confirmed = await alerts.confirm('Sign Out', 'Are you sure you want to sign out?', 'Sign Out', 'Cancel');
    if (confirmed) await signOut();
  };

  /** Read-only label/value row. */
  const detailRow = (emoji: string, label: string, value: string, valueColor = colors.brandGold) => (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.detailLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: valueColor }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  /** Row that opens another page. */
  const navRow = (emoji: string, label: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={styles.detailRow} accessibilityRole="button">
      <View style={styles.detailLeft}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.detailLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
    </Pressable>
  );

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarGrid}>
          <View style={[styles.avatar, { borderColor: colors.brandGold }]}>
            <Image source={require('../../../../assets/images/user.png')} style={styles.avatarImage} resizeMode="cover" />
          </View>
          <Pressable
            onPress={() => alerts.show('Coming Soon', "Profile photo uploads aren't wired up yet.", 'OK')}
            style={[styles.camera, { backgroundColor: colors.brandGold }]}
            accessibilityLabel="Change profile picture"
          >
            <Text style={{ fontSize: 14, color: '#FFFFFF' }}>📷</Text>
          </Pressable>
        </View>

        <View style={styles.identity}>
          <Text style={[styles.name, { color: colors.text }]}>{user.fullName}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{user.email}</Text>
        </View>

        <Card radius={14} padding={[16, 8]} border={colors.surfaceBorder}>
          {detailRow('📆', 'Account Context', `Joined ${fmtMonthYear(user.joinedDate)}`)}
          <Divider />
          {detailRow('🪪', 'Role', user.role)}
          <Divider />
          {detailRow('🏢', 'Company', companyName)}
          {!!mealSubsidyLabel && (
            <>
              <Divider />
              {detailRow('🍽️', 'Meal Subsidy', mealSubsidyLabel, colors.primary)}
            </>
          )}
          <Divider />
          {detailRow('📍', 'Delivery Location', locationName)}
          <Divider />
          <Pressable onPress={editDeliveryFloor} style={styles.detailRow} accessibilityRole="button">
            <View style={styles.detailLeft}>
              <Text style={styles.emoji}>🏢</Text>
              <Text style={[styles.detailLabel, { color: colors.text }]}>Delivery Floor</Text>
            </View>
            <View style={styles.detailLeft}>
              <Text style={[styles.detailValue, { color: colors.brandGold }]}>{user.deliveryFloor.trim() ? user.deliveryFloor : 'Not set'}</Text>
              <Text style={[styles.chevronSmall, { color: colors.textSecondary }]}>›</Text>
            </View>
          </Pressable>
        </Card>

        <Card radius={14} padding={[16, 4]} border={colors.surfaceBorder}>
          {navRow('⚙️', 'Settings', () => router.push('/profile/settings'))}
          <Divider />
          {navRow('❓', 'Help & Support', () => router.push('/profile/help'))}
        </Card>

        <Btn title="Sign Out" onPress={confirmSignOut} variant="dangerOutline" bold radius={10} height={46} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, gap: 24 },
  avatarGrid: { alignSelf: 'center', width: 110, height: 110, marginTop: 10, marginBottom: 5, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 100, height: 100 },
  camera: { position: 'absolute', right: 5, bottom: 5, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  identity: { alignItems: 'center', gap: 4, marginBottom: 5 },
  name: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, gap: 12 },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0, maxWidth: '55%' },
  emoji: { fontSize: 16 },
  detailLabel: { fontSize: 14, flexShrink: 1 },
  detailValue: { fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right' },
  chevron: { fontSize: 18 },
  chevronSmall: { fontSize: 16 },
});

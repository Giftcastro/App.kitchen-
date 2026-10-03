/** HelpPage.xaml + HelpViewModel. */
import React from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Text } from '../components/AppText';
import { Card, Page } from '../components/ui';
import { useApp } from '../state/AppState';

const SUPPORT_EMAIL = 'support@yourkitchenco.com';

export default function HelpScreen() {
  const { colors, isDark } = useApp();
  const router = useRouter();
  const version = `${Constants.expoConfig?.version ?? '1.0.0'}${__DEV__ ? ' (Debug)' : ''}`;

  return (
    <Page>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.intro}>
            <Text style={[styles.title, { color: colors.text }]}>Need Assistance?</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Our dedicated operations and support desk are standing by to help you.</Text>
          </View>

          <Card radius={16} padding={20} border={colors.cardBorder} bg={isDark ? colors.cardBg : '#FFFFFF'} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <View style={styles.contact}>
              <Text style={{ fontSize: 32 }}>✉️</Text>
              <Text style={[styles.contactTitle, { color: colors.text }]}>Direct Email Support</Text>
              <Text style={[styles.email, { color: colors.primary }]}>{SUPPORT_EMAIL}</Text>
            </View>
          </Card>

          <View style={[styles.tip, { backgroundColor: colors.tan }]}>
            <Text style={{ fontSize: 18 }}>💡</Text>
            <Text style={[styles.tipText, { color: colors.tipText }]}>For immediate order assistance, check active status windows.</Text>
          </View>

          <Card radius={14} border={colors.cardBorder} bg={isDark ? colors.cardBg : '#FFFFFF'} onPress={() => router.push('/cancellation-policy')}>
            <View style={styles.policyRow}>
              <Text style={{ fontSize: 18 }}>📄</Text>
              <Text style={[styles.policyText, { color: colors.text }]}>Cancellation &amp; Holiday Policy</Text>
              <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
            </View>
          </Card>
        </ScrollView>
        <Text style={[styles.version, { color: colors.textSecondary }]}>Version: {version}</Text>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  scroll: { gap: 20 },
  intro: { gap: 6, marginLeft: 4, marginVertical: 5 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  contact: { alignItems: 'center', gap: 14 },
  contactTitle: { fontSize: 16, fontWeight: '700' },
  email: { fontSize: 15, fontWeight: '700' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 16, marginHorizontal: 2 },
  tipText: { flex: 1, fontSize: 13 },
  policyRow: { flexDirection: 'row', alignItems: 'center' },
  policyText: { flex: 1, fontSize: 14, fontWeight: '700', marginLeft: 10 },
  chevron: { fontSize: 18 },
  version: { fontSize: 12, textAlign: 'center', marginTop: 15, marginBottom: 5 },
});

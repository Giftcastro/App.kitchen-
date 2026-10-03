/** CancellationPolicyPage.xaml. */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/AppText';
import { Card, Page } from '../components/ui';
import { useApp } from '../state/AppState';

const SECTIONS: [string, string][] = [
  [
    '9 AM Cutoff Rule',
    'Your Kitchen Co. operates on a zero-food-waste, fresh-ingredient model. All corporate meal orders must be placed by 9:00 AM two business days before your scheduled delivery.',
  ],
  [
    'No Modifications or Refunds Past Cutoff',
    'Once the 9:00 AM cutoff has passed, our kitchen immediately batches, preps, and allocates fresh ingredients. Orders cannot be cancelled, rescheduled, or refunded past this window.',
  ],
  [
    'Public Holidays',
    "Our kitchens are closed on all official South African public holidays, including observed holidays when one falls on a Sunday. These dates won't appear as available delivery options.",
  ],
  [
    'Batch Drop-Off',
    'All corporate meals arrive in insulated thermal carriers at your assigned drop-off point during your scheduled delivery window.',
  ],
];

export default function CancellationPolicyScreen() {
  const { colors } = useApp();
  return (
    <Page>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: colors.text }]}>Cancellation &amp; Holiday Policy</Text>
        {SECTIONS.map(([heading, body]) => (
          <Card key={heading} radius={14} border={colors.surfaceBorder}>
            <View style={styles.stack6}>
              <Text style={[styles.heading, { color: colors.text }]}>{heading}</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 18 },
  title: { fontSize: 20, fontWeight: '700' },
  stack6: { gap: 6 },
  heading: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 13 },
});

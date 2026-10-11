/**
 * SelectDeliveryDayPage.xaml + SelectDeliveryDayViewModel — the mandatory
 * first pick after sign-in, full screen with no nav bar. Changing the day
 * later happens in DeliveryDayOverlay on the Menu / Product pages instead.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn } from '../components/ui';
import { DeliveryDayPanel } from '../components/DeliveryDayPicker';
import { useApp } from '../state/AppState';
import { STATIC_WINDOW } from '../services/scheduling';

export default function SelectDeliveryDayScreen() {
  const { colors, setSelectedOrderingDate } = useApp();
  const router = useRouter();

  // Skip / View my orders: the highlighted (earliest) day becomes the default so the Menu still has a date.
  const enter = (date: string | null, path: string) => {
    if (date) setSelectedOrderingDate(date);
    router.replace(path as never);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.pageBg }]}>
      <DeliveryDayPanel
        // Widest window (10 weekdays) so this one screen covers both menus.
        windowDays={STATIC_WINDOW}
        titleSize={24}
        subtitle="This sets the default delivery day for everything you add to your basket. You can change it any time."
        onConfirm={date => enter(date, '/')}
        footer={selected => (
          <View style={styles.row}>
            <Btn title="Skip for now" onPress={() => enter(selected, '/')} variant="outline" color={colors.primary} borderColor={colors.primary} bold height={46} radius={12} style={[styles.flex, styles.thick]} />
            <Btn title="View my orders" onPress={() => enter(selected, '/orders')} variant="outline" color={colors.primary} borderColor={colors.primary} bold height={46} radius={12} style={[styles.flex, styles.thick]} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  thick: { borderWidth: 1.5 },
  row: { flexDirection: 'row', gap: 10 },
});

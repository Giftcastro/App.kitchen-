/** SelectDeliveryDayPage.xaml + SelectDeliveryDayViewModel. */
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../components/AppText';
import { Btn, Page } from '../components/ui';
import { useApp } from '../state/AppState';
import { fmtDayLabel, getOrderableDeliveryDates, STATIC_WINDOW } from '../services/scheduling';

export default function SelectDeliveryDayScreen() {
  const { colors, isDark, selectedOrderingDate, setSelectedOrderingDate } = useApp();
  const router = useRouter();
  // Widest window (10 weekdays) so this one screen covers both menus.
  const [dates] = useState(() => getOrderableDeliveryDates(STATIC_WINDOW));
  const [selected, setSelected] = useState<string | null>(
    selectedOrderingDate && dates.includes(selectedOrderingDate) ? selectedOrderingDate : dates[0] ?? null
  );
  // Reached mid-session (Change day / "Order for a different day") rather than right after login.
  const [isChangingDay] = useState(() => selectedOrderingDate !== null);

  const confirm = () => {
    if (!selected) return;
    setSelectedOrderingDate(selected);
    if (isChangingDay && router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image
          source={isDark ? require('../../assets/images/yourkcodark.png') : require('../../assets/images/yourkcolight.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.titles}>
          <Text style={[styles.title, { color: colors.text }]}>Which day are you ordering for?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            This sets the default delivery day for everything you add to your basket. You can change it any time.
          </Text>
        </View>
        <View style={styles.grid}>
          {dates.map(date => {
            const isSelected = date === selected;
            return (
              <Pressable
                key={date}
                onPress={() => setSelected(date)}
                accessibilityRole="radio"
                aria-checked={isSelected}
                style={[
                  styles.option,
                  { borderColor: colors.primary, backgroundColor: isSelected ? colors.primary : isDark ? colors.cardBg : '#FFFFFF' },
                ]}
              >
                <Text style={[styles.optionText, { color: isSelected ? colors.onPrimary : colors.text }]}>{fmtDayLabel(date)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Btn testID="confirm-day" title="Confirm" onPress={confirm} bold height={50} radius={12} style={styles.confirm} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, gap: 20 },
  logo: { width: '100%', height: 70, marginTop: 10 },
  titles: { gap: 4, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 13, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    width: '48%',
    flexGrow: 1,
    height: 66,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  optionText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  confirm: { marginTop: 10 },
});

import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { getEstimatedDelivery } from '../utils/deliveryHelpers';
import { ThemeColors } from '../utils/theme';

interface DeliveryEstimatorProps {
  theme: ThemeColors;
}

export const DeliveryEstimator: React.FC<DeliveryEstimatorProps> = ({ theme }) => {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [deliveryInfo, setDeliveryInfo] = useState(() => getEstimatedDelivery());

  useEffect(() => {
    const interval = setInterval(() => {
      setDeliveryInfo(getEstimatedDelivery());
    }, 30000); // Check and update local time state every 30s
    return () => clearInterval(interval);
  }, []);

  const { formattedEarliestShort, minutesLeft, open, cutoffPassed, isOpenToday } = deliveryInfo;

  // Two parts, not one sentence: a headline saying what's happening and what
  // to do, then the delivery date on its own line. Each state still leads with
  // the action and names the 9:00 AM cutoff driving the date rather than
  // leaving the reader to guess — but the date no longer rides at the end of
  // an ~80-character sentence clamped to two lines, where a 320-360px phone
  // ellipsised away the one fact the banner exists to deliver ("...delivery
  // Wednesday…"). A short line of its own can't be eaten by wrapping.
  const isUrgent = cutoffPassed || (minutesLeft > 0 && minutesLeft <= 60);
  let headline: string;
  if (!open && !cutoffPassed) {
    // Two different situations were sharing one message here before: on a
    // weekday morning before 8am there's still a 9am cutoff today to hit, so
    // "order by 9am today" stays accurate no matter when in that window they
    // actually check out. A weekend is different: getOrderCutoffInfo rolls the
    // start of the count forward to Monday first (rollForwardToWeekday), so a
    // weekend day is never day zero — Saturday and Monday both yield the same
    // Wednesday. Naming the next cutoff day here would look like it should
    // relate arithmetically to the delivery date and it does not — so this
    // states only what's actually true: ordering now gets you that date.
    headline = isOpenToday
      ? 'Kitchen opens 8:00 AM — order by 9:00 AM today'
      : `Kitchen's closed for the weekend — order now`;
  } else if (cutoffPassed) {
    headline = `Today's 9:00 AM cutoff has passed — order now`;
  } else if (minutesLeft > 0 && minutesLeft <= 60) {
    headline = `${minutesLeft} min left before the 9:00 AM cutoff — order now`;
  } else {
    headline = 'Order by 9:00 AM today';
  }



  return (
    <View style={[styles.row, isUrgent && styles.rowUrgent]}>
      <View style={[styles.iconWrapper, isUrgent && styles.iconWrapperUrgent]}>
        <Ionicons name="bicycle" size={16} color={isUrgent ? '#8A6D00' : theme.onAccent} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.text, isUrgent && styles.textUrgent]} numberOfLines={2}>
          {isUrgent ? '⚠️ ' : ''}{headline}
        </Text>
        <Text style={[styles.delivery, isUrgent && styles.textUrgent]} numberOfLines={1}>
          Delivery {formattedEarliestShort}
        </Text>
      </View>
    </View>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  rowUrgent: { backgroundColor: '#FFF8E1', borderColor: '#F0DFA0' },
  iconWrapper: {
    backgroundColor: theme.accent,
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconWrapperUrgent: { backgroundColor: '#FFFFFF' },
  copy: { flex: 1 },
  text: { fontSize: 12.5, fontWeight: '700', color: theme.text },
  delivery: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginTop: 2 },
  textUrgent: { color: '#8A6D00' },
});

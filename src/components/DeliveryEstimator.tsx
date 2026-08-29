import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEstimatedDelivery } from '../utils/deliveryHelpers';

export const DeliveryEstimator: React.FC = () => {
  const [deliveryInfo, setDeliveryInfo] = useState(() => getEstimatedDelivery());

  useEffect(() => {
    const interval = setInterval(() => {
      setDeliveryInfo(getEstimatedDelivery());
    }, 30000); // Check and update local time state every 30s
    return () => clearInterval(interval);
  }, []);

  const { formattedDate, minutesLeft, open, cutoffPassed, isOpenToday } = deliveryInfo;

  // One line instead of a header + divider + separate badge repeating the
  // same date/cutoff info three ways — same facts, said once. Each state
  // leads with what to DO, always names the 9:00 AM cutoff driving the date
  // (rather than leaving the reader to guess), and ends with the date it
  // gets you.
  const isUrgent = cutoffPassed || (minutesLeft > 0 && minutesLeft <= 60);
  let text: string;
  if (!open && !cutoffPassed) {
    // Two different situations were sharing one message here before: on a
    // weekday morning before 8am there's still a 9am cutoff today to hit, so
    // "order by 9am today" stays accurate no matter when in that window they
    // actually check out. A weekend is different — the 2-business-day count
    // toward formattedDate starts from TODAY (a weekend day counts as day 0,
    // same as any other day it's measured from), not from the next cutoff.
    // Naming the next cutoff day here would look like it should relate
    // arithmetically to formattedDate and it doesn't — so this states only
    // what's actually true: ordering now gets you formattedDate.
    text = isOpenToday
      ? `Kitchen opens 8:00 AM — order by 9:00 AM today for delivery ${formattedDate}`
      : `Kitchen's closed for the weekend — order now for delivery ${formattedDate}`;
  } else if (cutoffPassed) {
    text = `Today's 9:00 AM cutoff has passed — order now for delivery ${formattedDate}`;
  } else if (minutesLeft > 0 && minutesLeft <= 60) {
    text = `${minutesLeft} min left before the 9:00 AM cutoff — order now for delivery ${formattedDate}!`;
  } else {
    text = `Order by 9:00 AM today for delivery ${formattedDate}`;
  }

  return (
    <View style={[styles.row, isUrgent && styles.rowUrgent]}>
      <View style={[styles.iconWrapper, isUrgent && styles.iconWrapperUrgent]}>
        <Ionicons name="bicycle" size={16} color={isUrgent ? '#8A6D00' : '#FFFFFF'} />
      </View>
      <Text style={[styles.text, isUrgent && styles.textUrgent]} numberOfLines={2}>
        {isUrgent ? '⚠️ ' : ''}{text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    marginBottom: 12,
  },
  rowUrgent: { backgroundColor: '#FFF8E1', borderColor: '#F0DFA0' },
  iconWrapper: {
    backgroundColor: '#000000',
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconWrapperUrgent: { backgroundColor: '#FFFFFF' },
  text: { flex: 1, fontSize: 12.5, fontWeight: '700', color: '#000000' },
  textUrgent: { color: '#8A6D00' },
});

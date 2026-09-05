import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import { getOrderCutoffInfo } from '../utils/deliveryHelpers';
import { ThemeColors } from '../utils/theme';

interface CutoffCountdownProps {
  theme: ThemeColors;
  compact?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const CutoffCountdown: React.FC<CutoffCountdownProps> = ({ theme, compact }) => {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [info, setInfo] = useState(() => getOrderCutoffInfo());

  useEffect(() => {
    const interval = setInterval(() => setInfo(getOrderCutoffInfo()), 30000);
    return () => clearInterval(interval);
  }, []);

  const { minutesUntilCutoff, cutoffPassed, isOpenToday, formattedEarliestShort } = info;

  if (cutoffPassed || !isOpenToday) {
    // Abbreviated date and trimmed wording: spelled out, this line needed
    // 385px of a 288px pill on a 320px phone and hard-clipped mid-date
    // ("...Wednesday, 09"), losing the month entirely. numberOfLines={2} is the
    // backstop rather than the fix — the text fits on one line now, but a large
    // system font scale should wrap it instead of cutting the date off again.
    return (
      <View style={[styles.pill, styles.pillClosed, compact && styles.pillCompact]}>
        <View style={[styles.dot, styles.dotClosed]} />
        <Text style={styles.closedText} numberOfLines={2}>
          Closed today · next delivery {formattedEarliestShort}
        </Text>
      </View>
    );
  }

  const days = Math.floor(minutesUntilCutoff / (60 * 24));
  const hours = Math.floor((minutesUntilCutoff % (60 * 24)) / 60);
  const mins = minutesUntilCutoff % 60;
  const urgent = minutesUntilCutoff <= 60;

  return (
    <View style={[styles.pill, urgent ? styles.pillUrgent : styles.pillOpen, compact && styles.pillCompact]}>
      <View style={[styles.dot, urgent ? styles.dotUrgent : styles.dotOpen]} />
      <Text style={[styles.label, urgent && styles.labelUrgent]} numberOfLines={2}>
        Order closes in {pad(days)}d : {pad(hours)}h : {pad(mins)}m
      </Text>
    </View>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pillCompact: { paddingVertical: 6, paddingHorizontal: 10 },
  pillOpen: { borderColor: '#22C55E40', backgroundColor: '#EAF7EE' },
  pillUrgent: { borderColor: '#F0DFA0', backgroundColor: '#FFF8E1' },
  pillClosed: { borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
  dotOpen: { backgroundColor: '#1DA836' },
  dotUrgent: { backgroundColor: '#E8A100' },
  dotClosed: { backgroundColor: theme.textTertiary },
  label: { fontSize: 12, fontWeight: '800', color: '#1DA836', letterSpacing: 0.2 },
  labelUrgent: { color: '#8A6D00' },
  closedText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, flexShrink: 1 },
});

/**
 * The full-screen "Which day are you ordering for?" picker, in its two MAUI
 * presentations, which share one layout:
 *
 *  - SelectDeliveryDayPage: the mandatory first pick after sign-in (its own
 *    route, no nav bar, Confirm + "Skip for now" / "View my orders").
 *  - Views/Controls/DeliveryDayOverlay + DeliveryDayPickerState: "change
 *    day" mid-session, drawn inside the host page (Menu, Product) over its
 *    content, with a ✕ to back out.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import { Btn } from './ui';
import { useApp } from '../state/AppState';
import { BrandLogo } from './BrandLogo';
import { fmtDayLabel, getOrderableDeliveryDates } from '../services/scheduling';

interface PanelProps {
  windowDays: number;
  titleSize: number;
  subtitle: string;
  onConfirm: (date: string) => void;
  onClose?: () => void;
  /** Rendered under Confirm (first pick only). Receives the highlighted date. */
  footer?: (selected: string | null) => React.ReactNode;
}

export function DeliveryDayPanel({ windowDays, titleSize, subtitle, onConfirm, onClose, footer }: PanelProps) {
  const { colors, selectedOrderingDate } = useApp();
  const [dates] = useState(() => getOrderableDeliveryDates(windowDays));
  const [selected, setSelected] = useState<string | null>(
    selectedOrderingDate && dates.includes(selectedOrderingDate) ? selectedOrderingDate : dates[0] ?? null
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <BrandLogo size={24} />
          {onClose && (
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.close, { backgroundColor: colors.chipBg }, pressed && styles.pressed]}
            >
              <Text style={[styles.closeText, { color: colors.text }]}>✕</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.titles}>
          <Text style={{ fontSize: titleSize, fontWeight: '700', color: colors.text }}>Which day are you ordering for?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.grid}>
        {dates.map(date => {
          const isSelected = date === selected;
          return (
            <Pressable
              key={date}
              onPress={() => setSelected(date)}
              accessibilityRole="radio"
              aria-checked={isSelected}
              style={[styles.option, { borderColor: colors.brandGold, backgroundColor: isSelected ? colors.primary : colors.cardBg }]}
            >
              <Text style={[styles.optionText, { color: isSelected ? colors.onPrimary : colors.text }]}>{fmtDayLabel(date)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.actions}>
        <Btn testID="confirm-day" title="Confirm" onPress={() => selected && onConfirm(selected)} bold height={50} radius={12} />
        {footer?.(selected)}
      </View>
    </View>
  );
}

/** DeliveryDayOverlay: covers the host page while `visible`. */
export function DeliveryDayOverlay({
  visible,
  windowDays,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  windowDays: number;
  onConfirm: (date: string) => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <DeliveryDayPanel
        windowDays={windowDays}
        titleSize={22}
        subtitle="This sets the default delivery day for everything you add to your basket."
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, paddingHorizontal: 24 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
  header: { gap: 16, marginTop: 20, marginBottom: 24 },
  // Logo centred on the page; the overlay's ✕ is pinned right so it doesn't push the logo off-centre.
  logoRow: { minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', right: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  titles: { gap: 4 },
  subtitle: { fontSize: 13 },
  // Span 2: an odd last tile stays half-width, as in the CollectionView.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  option: {
    width: '48.5%',
    height: 66,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  optionText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  actions: { gap: 10, marginTop: 16, marginBottom: 48 },
});

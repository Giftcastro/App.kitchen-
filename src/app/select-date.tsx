/**
 * "Which day are you ordering for?" — the delivery day a customer picks up
 * front, before they ever see the menu.
 *
 * Added in the Sep 2026 client review, which asked for the date row to come
 * OFF the menu (it read as clutter above the food) and become one deliberate
 * choice made once. What's picked here lands in `orderingForDate` on the
 * Kitchen context and is stamped onto everything added to the basket from
 * then on; the added-to-basket sheet on the Menu screen routes back here
 * whenever someone wants a second day.
 *
 * Two ways in:
 *   - forced  — a signed-in customer with no day chosen yet is redirected
 *               here by src/app/_layout.tsx. No back button; Confirm is the
 *               only way out.
 *   - change  — `?change=1`, opened from the menu header pill or the
 *               added-to-basket sheet. Shows a back button and pre-selects
 *               the day already in play.
 *
 * Only genuinely orderable weekdays are offered: getUpcomingOrderableWeekdays()
 * already drops weekends and anything inside the 9:00 AM / 2-business-day
 * cutoff, so every option on this screen is one the kitchen can actually cook.
 */
import React, { useMemo, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ScrollView, StatusBar,
} from 'react-native';
import { Text } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKitchen } from '../context/KitchenCoContext';
import { getUpcomingOrderableWeekdays, UpcomingWeekday, ORDER_CUTOFF_LABEL } from '../utils/deliveryHelpers';
import { ThemeColors } from '../utils/theme';
import { haptics } from '../utils/haptics';

// Order the three buckets deliberately rather than relying on the order they
// happen to appear in the data — "This week" must always lead, even when it
// is empty (late in the week every remaining slot is already in the next one).
const WEEK_GROUPS: UpcomingWeekday['weekLabel'][] = ['This week', 'Next week', 'In 2 weeks'];

export default function SelectDateScreen() {
  const { orderingForDate, setOrderingForDate, theme } = useKitchen();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { change, view } = useLocalSearchParams<{ change?: string; view?: string }>();
  const isChanging = change === '1';

  // Today's Menu (the rotating cycle menu) can only be pre-ordered up to a
  // week ahead — narrower than the Main Menu's ~2 week horizon — so this
  // drops the "In 2 weeks" bucket for that view. Mirrors index.tsx's
  // `cycleOrderableDays`; keep the two in sync, since this is the screen
  // that actually gates which date lands in `orderingForDate`.
  const allDays = useMemo(() => getUpcomingOrderableWeekdays(), []);
  const days = useMemo(
    () => (view === 'today' ? allDays.filter(d => d.weekLabel !== 'In 2 weeks') : allDays),
    [allDays, view]
  );

  // Local until Confirm, so backing out of a "change" visit leaves the day
  // already in play untouched. Seeded with the current choice when there is
  // one, otherwise the earliest day the kitchen can still cook.
  const [draft, setDraft] = useState<string | null>(
    () => orderingForDate ?? days[0]?.iso ?? null
  );

  // A day chosen before (say) a midnight rollover can fall out of the
  // orderable window entirely — don't let Confirm commit a date that is no
  // longer on offer.
  const draftIsOrderable = days.some(d => d.iso === draft);

  const handleConfirm = () => {
    if (!draft || !draftIsOrderable) return;
    haptics.success();
    setOrderingForDate(draft);
    // replace, not push: this screen is a decision point, not somewhere to
    // land on Back after browsing the menu. Carries back whichever menu
    // toggle (Standard Classics / Today's Menu) was showing before this
    // "change date" trip — see index.tsx's router.push(`/select-date...`) —
    // so confirming doesn't silently reset the customer to Standard Classics.
    router.replace(view === 'today' ? '/?view=today' : '/');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />

      {isChanging && (
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back without changing the delivery day"
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Which day are you ordering for?</Text>
        <Text style={styles.subtitle}>
          This sets the delivery day for everything you add to your basket. You can change it at any time.
        </Text>

        {days.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={30} color={theme.textTertiary} />
            <Text style={styles.emptyTitle}>No delivery days open</Text>
            <Text style={styles.emptySub}>
              Orders close {ORDER_CUTOFF_LABEL} at least 2 business days ahead. Check back shortly.
            </Text>
          </View>
        ) : (
          WEEK_GROUPS.map((group) => {
            const groupDays = days.filter(d => d.weekLabel === group);
            if (groupDays.length === 0) return null;
            return (
              <View key={group} style={styles.group}>
                <Text style={styles.groupLabel}>{group}</Text>
                <View style={styles.dayGrid}>
                  {groupDays.map((day) => {
                    const isSelected = draft === day.iso;
                    return (
                      <TouchableOpacity
                        key={day.iso}
                        style={[styles.dayChip, isSelected && styles.dayChipActive]}
                        onPress={() => { haptics.selection(); setDraft(day.iso); }}
                        activeOpacity={0.85}
                        accessibilityRole="radio"
                        // react-native-web drops accessibilityState, so the
                        // aria attribute is what actually reaches the DOM and
                        // what any web driver can assert on.
                        accessibilityState={{ selected: isSelected }}
                        aria-checked={isSelected}
                        accessibilityLabel={`${day.label}${isSelected ? ', selected' : ''}`}
                      >
                        <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.cutoffHint}>
          Orders close {ORDER_CUTOFF_LABEL} on business days, at least 2 business days before delivery.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, !draftIsOrderable && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!draftIsOrderable}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Confirm delivery day"
        >
          <Text style={styles.confirmBtnText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 12, paddingTop: 4, height: 44, justifyContent: 'center' },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 19,
    marginBottom: 26,
  },
  group: { marginBottom: 22 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textTertiary,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  // Two per row via flexWrap + a 48% basis, so an odd day count leaves the
  // last chip half-width rather than stretching it across the row.
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dayChip: {
    width: '48%',
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    marginBottom: 10,
  },
  dayChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  dayChipText: { fontSize: 13, fontWeight: '600', color: theme.text },
  dayChipTextActive: { color: theme.onAccent, fontWeight: '700' },
  cutoffHint: {
    fontSize: 11,
    color: theme.textTertiary,
    lineHeight: 16,
    marginTop: 2,
  },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: theme.text, marginTop: 4 },
  emptySub: { fontSize: 12, color: theme.textSecondary, textAlign: 'center', lineHeight: 18 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    backgroundColor: theme.background,
  },
  confirmBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: theme.onAccent, letterSpacing: 0.2 },
});

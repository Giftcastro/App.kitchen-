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
 * Rendered as a centered card over a dimmed backdrop (client reference,
 * 2026-09-10) rather than a full-bleed page — the wordmark + close-X header,
 * flat (ungrouped) day list and single-line "Cutoff: <day> at <time>" row are
 * all part of that reference, replacing the earlier "This week / Next week /
 * In 2 weeks" section headers and the multi-line cutoff paragraph.
 *
 * Two ways in:
 *   - forced  — a signed-in customer with no day chosen yet is redirected
 *               here by src/app/_layout.tsx. No close button; Confirm is the
 *               only way out.
 *   - change  — `?change=1`, opened from the menu header pill or the
 *               added-to-basket sheet. Shows a close button and pre-selects
 *               the day already in play.
 *
 * Only genuinely orderable weekdays are offered: getUpcomingOrderableWeekdays()
 * already drops weekends and anything inside the 9:00 AM / 2-business-day
 * cutoff, so every option on this screen is one the kitchen can actually cook.
 */
import React, { useMemo, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ScrollView, StatusBar, TextProps,
} from 'react-native';
import { Text as BrandText } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKitchen } from '../context/KitchenCoContext';
import KitchenLogo from '../components/KitchenLogo';
import { getUpcomingOrderableWeekdays, getOrderCutoffInfo, ORDER_CUTOFF_LABEL } from '../utils/deliveryHelpers';
import { ThemeColors } from '../utils/theme';
import { haptics } from '../utils/haptics';
import { legacyTypography } from '../utils/legacyTypography';

// Same pre-KitchenCo RobotoCondensed body / GotchaGothic headline pairing as
// Menu, Activity, and Profile (see legacyTypography.ts) — this is the
// screen those three route to for picking a delivery day, so it keeps the
// same look rather than snapping back to Montserrat mid-flow.
const Text: React.FC<TextProps> = ({ style, ...rest }) => (
  <BrandText style={[{ fontFamily: legacyTypography.body }, style]} {...rest} />
);

export default function SelectDateScreen() {
  const { orderingForDate, setOrderingForDate, theme, isDark } = useKitchen();
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

  // "Cutoff: Friday, 11 Sept at 9:00 AM SAST" — the next 9am cutoff that
  // hasn't passed yet, computed once at mount same as `allDays` above.
  const cutoffInfo = useMemo(() => getOrderCutoffInfo(), []);
  const cutoffDayLabel = cutoffInfo.nextCutoffDate.toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'short',
  });

  // Local until Confirm, so backing out of a "change" visit leaves the day
  // already in play untouched. Seeded with the current choice when it's
  // actually one of the days on offer here — a date picked under a wider
  // horizon (e.g. Main Menu's ~2 weeks) can land outside this view's own
  // window (Today's Menu caps at 1 week), in which case that stale value
  // wouldn't match any chip anyway and would just leave nothing selected;
  // falling back to the earliest orderable day instead means arriving here
  // always shows one real, confirmable choice.
  const [draft, setDraft] = useState<string | null>(
    () => (orderingForDate && days.some(d => d.iso === orderingForDate) ? orderingForDate : days[0]?.iso) ?? null
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
    <SafeAreaView style={[styles.backdrop, { backgroundColor: theme.modalOverlay }]}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.modalOverlay} />

      <View style={styles.cardOuter}>
        <View style={styles.card}>
          {isChanging && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close without changing the delivery day"
            >
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}

          <View style={styles.logoWrap}>
            <KitchenLogo compact variant={isDark ? 'onDark' : 'onLight'} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Which day are you ordering for?</Text>
            <Text style={styles.subtitle}>
              This sets the default delivery day for everything you add to your basket. You can change it any time.
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
              <View style={styles.dayGrid}>
                {days.map((day) => {
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
            )}

            <View style={styles.cutoffRow}>
              <Ionicons name="time-outline" size={13} color={theme.textTertiary} />
              <Text style={styles.cutoffText}>
                Cutoff: {cutoffDayLabel} at {ORDER_CUTOFF_LABEL} SAST
              </Text>
            </View>
          </ScrollView>

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
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1 },
  cardOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '100%',
    backgroundColor: theme.cardBg,
    borderRadius: 22,
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  logoWrap: { alignItems: 'center', marginBottom: 18 },
  scrollContent: { paddingBottom: 4 },
  title: {
    fontFamily: legacyTypography.heading,
    fontSize: 21,
    fontWeight: '700',
    color: theme.text,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12.5,
    color: theme.textSecondary,
    lineHeight: 18,
    marginBottom: 18,
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
  cutoffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  cutoffText: { fontSize: 11.5, color: theme.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: theme.text, marginTop: 4 },
  emptySub: { fontSize: 12, color: theme.textSecondary, textAlign: 'center', lineHeight: 18 },
  confirmBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: theme.onAccent, letterSpacing: 0.2 },
});

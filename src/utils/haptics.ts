import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Haptics aren't supported on web and can throw on some Android devices/
// emulators without a vibration motor — every call is guarded the same way
// the existing local-notification calls in payfast.tsx are (fire-and-forget,
// silently swallow failures, never block the interaction it's decorating).
function fire(fn: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  fn().catch(() => {});
}

export const haptics = {
  /** Light tap — add to cart, quantity +/-, minor toggles. */
  light: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Medium tap — a more deliberate action (e.g. confirming a modal choice). */
  medium: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Positive outcome — discount applied, order placed, payment succeeded. */
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Negative/destructive outcome — invalid code, delete confirmation. */
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Neutral selection change — switches, segmented controls, tab pills. */
  selection: () => fire(() => Haptics.selectionAsync()),
};

// src/utils/orderReminders.ts
//
// A single, local (on-device) reminder nudging the user to place today's
// order before the 9:00 AM cutoff — deliberately restrained so it never
// turns into notification spam:
//   - at most ONE reminder per business day
//   - never fires once there's nothing left to remind about (already
//     ordered today, or already has items sitting in the cart)
//   - never fires on a day with no menu (weekends)
//   - only ever an ADVANCE nudge — if the reminder hour has already passed
//     by the time this runs, it's skipped rather than firing late
//   - the user can turn it off entirely (KitchenCoContext `remindersEnabled`)
//
// This uses expo-notifications' local scheduling, which needs no backend —
// real server push (Stage 2 of the SLA) isn't built yet. Like Alert.alert(),
// expo-notifications has no scheduling support on web, so this is a no-op
// in the browser and can only be verified on a real device/simulator build.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { isWeekday, ORDER_CUTOFF_HOUR, BUSINESS_HOURS_START } from './deliveryHelpers';

// One hour's notice ahead of the daily cutoff — enough time to actually act
// on it, not so early it reads as noise. Clamped to never land before the
// shop opens (a cutoff close to opening time, like 9am, would otherwise push
// this before 8am — a time almost nobody has the app open to receive it).
export const ORDER_REMINDER_HOUR = Math.max(BUSINESS_HOURS_START, ORDER_CUTOFF_HOUR - 1);

const ORDER_REMINDER_ID = 'kitchenco-order-reminder';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export interface ReminderDecisionParams {
  now: Date;
  remindersEnabled: boolean;
  hasOrderedToday: boolean;
  cartHasItems: boolean;
}

/**
 * Pure yes/no decision, kept separate from the actual expo-notifications
 * call so the "don't be annoying" rules above are easy to read and to test
 * without a device.
 */
export function shouldScheduleTodayReminder({
  now,
  remindersEnabled,
  hasOrderedToday,
  cartHasItems,
}: ReminderDecisionParams): boolean {
  if (!remindersEnabled) return false;
  if (hasOrderedToday || cartHasItems) return false;
  if (!isWeekday(now)) return false;
  if (now.getHours() >= ORDER_REMINDER_HOUR) return false;
  return true;
}

function getTodayReminderTime(now: Date): Date {
  const target = new Date(now);
  target.setHours(ORDER_REMINDER_HOUR, 0, 0, 0);
  return target;
}

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

/**
 * Re-evaluates whether today's single reminder should exist and
 * schedules/cancels it to match. Safe to call on every relevant state
 * change (cart, orders, login, toggle) — it always clears any previously
 * scheduled reminder first, so there's never more than one pending.
 */
export async function syncOrderReminder(params: ReminderDecisionParams): Promise<void> {
  if (Platform.OS === 'web') return;

  await Notifications.cancelScheduledNotificationAsync(ORDER_REMINDER_ID).catch(() => {});

  if (!shouldScheduleTodayReminder(params)) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('order-reminders', {
      name: 'Order reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }

  const granted = await ensurePermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    identifier: ORDER_REMINDER_ID,
    content: {
      title: "Don't forget today's order",
      body: "Today's menu closes at 9:00 AM — place your order before the cutoff.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: getTodayReminderTime(params.now),
    },
  }).catch(() => {});
}

export async function cancelOrderReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(ORDER_REMINDER_ID).catch(() => {});
}

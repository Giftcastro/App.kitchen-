// src/utils/deliveryHelpers.ts
//
// Centralised business-hours rules for Kitchen Co.
//
// Business hours  : Monday - Friday, 08:00 - 17:00 (local)
// Daily order cutoff: 09:00 AM
// Advance ordering cutoff (client rule, confirmed 26 Aug 2026):
//   - Orders close two business days before delivery, at 09:00 AM.
//   - e.g. order Wednesday by 9am -> delivery Friday.
//         order Thursday by 9am -> delivery Monday (weekend skipped).
//   - Orders placed at/after the 09:00 AM cutoff on a business day push
//     delivery out by one extra business day (3 business days' lead).
//
// These rules previously lived inline in deliveryHelpers.ts; they are centralised
// here so the cutoff logic is defined in one place and reused everywhere.

export const BUSINESS_HOURS_START = 8; // 08:00 local
export const BUSINESS_HOURS_END = 17; // 17:00 local
export const ORDER_CUTOFF_HOUR = 9; // 09:00 AM daily order cutoff
export const ORDER_CUTOFF_MINUTE = 0;

/** Monday(1) ... Friday(5) — getDay() returns 1-5 on weekdays. */
export const BUSINESS_DAYS: number[] = [1, 2, 3, 4, 5];

export const BUSINESS_HOURS_LABEL = 'Mon-Fri 08:00-17:00';
export const ORDER_CUTOFF_LABEL = '9:00 AM';

export interface OrderWindowInfo {
  /** Currently within Mon-Fri 08:00-17:00. */
  open: boolean;
  /** Is today a business day AND has the 9:00 AM cutoff already passed? */
  cutoffPassed: boolean;
  /** Minutes remaining until the next 9:00 AM order cutoff. */
  minutesUntilCutoff: number;
  /** Is there an ordering window open today (before cutoff, on a weekday)? */
  isOpenToday: boolean;
  /** Earliest guaranteed delivery date (respects the 48h advance cutoff). */
  earliestDeliveryDate: Date;
  /** Locale-formatted earliest delivery date, spelled out ("Wednesday, 09 September"). */
  formattedEarliest: string;
  /**
   * Abbreviated earliest delivery date ("Wed, 09 Sept"), for anywhere the long
   * form does not survive a narrow screen — a one-line pill, or a sentence that
   * would otherwise push the date past a clamp and ellipsise the one fact the
   * reader needs. Defined here so the components that need it cannot drift.
   */
  formattedEarliestShort: string;
  /** The next 9:00 AM cutoff that hasn't passed yet — e.g. Monday 9am when checked over a weekend. */
  nextCutoffDate: Date;
  /** Human-readable explanation shown to the user. */
  message: string;
}

export function isWeekday(date: Date = new Date()): boolean {
  return BUSINESS_DAYS.includes(date.getDay());
}

export function isWithinBusinessHours(date: Date = new Date()): boolean {
  if (!isWeekday(date)) return false;
  const hour = date.getHours();
  return hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END;
}

/** Adds `days` WEEKDAY days to `date`, skipping weekends. */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isWeekday(result)) added++;
  }
  return result;
}

/** `date` itself if it's already a weekday, otherwise the next Monday. */
function rollForwardToWeekday(date: Date): Date {
  const result = new Date(date);
  while (!isWeekday(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/**
 * Returns the next 9:00 AM order cutoff that has not yet passed.
 * If today's cutoff has passed (or today is a weekend), rolls forward to the
 * next business day's cutoff.
 */
function nextCutoffDate(date: Date): Date {
  const cutoff = new Date(date);
  cutoff.setHours(ORDER_CUTOFF_HOUR, ORDER_CUTOFF_MINUTE, 0, 0);
  if (cutoff.getTime() <= date.getTime()) {
    cutoff.setDate(cutoff.getDate() + 1);
    while (!isWeekday(cutoff)) {
      cutoff.setDate(cutoff.getDate() + 1);
    }
    cutoff.setHours(ORDER_CUTOFF_HOUR, ORDER_CUTOFF_MINUTE, 0, 0);
  }
  return cutoff;
}

/**
 * Computes the live order window, 48-hour advance cutoff and earliest delivery
 * date for the given moment (defaults to now).
 */
export function getOrderCutoffInfo(now: Date = new Date()): OrderWindowInfo {
  const weekday = isWeekday(now);
  const withinHours = isWithinBusinessHours(now);

  const todayCutoff = new Date(now);
  todayCutoff.setHours(ORDER_CUTOFF_HOUR, ORDER_CUTOFF_MINUTE, 0, 0);
  const cutoffPassed = weekday && now.getTime() >= todayCutoff.getTime();

  // Client rule: orders close 2 business days before delivery, at 9:00 AM.
  // Once that day's 9am cutoff has passed, delivery pushes out one extra
  // business day. This is purely time-of-day — it does not depend on
  // whether we're inside the 8am-5pm "business hours" window (a 7am order
  // still counts as before cutoff).
  const leadBusinessDays = cutoffPassed ? 3 : 2;

  // The 2-business-day count only runs across Mon-Fri — a weekend order
  // doesn't start counting until Monday arrives (Saturday/Sunday aren't
  // working days, so they can't be "day zero" of a business-day count).
  // No-op for a weekday order, which already starts counting from itself.
  const countFrom = rollForwardToWeekday(now);
  const earliest = addBusinessDays(countFrom, leadBusinessDays);
  earliest.setHours(0, 0, 0, 0);

  const nextCutoff = nextCutoffDate(now);
  const minutesUntilCutoff = Math.max(
    0,
    Math.floor((nextCutoff.getTime() - now.getTime()) / 60000)
  );

  const isOpenToday = weekday && !cutoffPassed;

  let message: string;
  if (!weekday) {
    message = `Orders close ${ORDER_CUTOFF_LABEL} on business days. We're closed today.`;
  } else if (cutoffPassed) {
    message = `Today's order cutoff (${ORDER_CUTOFF_LABEL}) has passed. Place before ${ORDER_CUTOFF_LABEL} on a business day for the earliest delivery.`;
  } else {
    message = `Order before ${ORDER_CUTOFF_LABEL} to ship in ${leadBusinessDays} business days.`;
  }

  return {
    open: withinHours,
    cutoffPassed,
    minutesUntilCutoff,
    isOpenToday,
    earliestDeliveryDate: earliest,
    formattedEarliest: earliest.toLocaleDateString('en-ZA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    formattedEarliestShort: earliest.toLocaleDateString('en-ZA', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }),
    nextCutoffDate: nextCutoff,
    message,
  };
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * The delivery date a given cart item will actually land on: its own
 * pre-scheduled date (yyyy-mm-dd, set when a customer booked a specific
 * weekday on the Main Menu) if it has one, otherwise the earliest date the
 * order as a whole would have been computed for at the moment it was placed.
 * Needed because a single order can mix items scheduled for different days —
 * "when is this order due" isn't a single field on the order itself.
 */
export function getItemDueDate(item: { deliveryDate?: string }, orderPlacedAt: Date): Date {
  if (item.deliveryDate) {
    const [y, m, d] = item.deliveryDate.split('-').map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  return getOrderCutoffInfo(orderPlacedAt).earliestDeliveryDate;
}

export interface DeliveryEstimate {
  isAfterCutoff: boolean;
  minutesLeft: number;
  formattedDate: string;
  /** True when currently within business hours (Mon-Fri 08:00-17:00). */
  open: boolean;
  /** True when today's 9:00 AM order cutoff has already passed. */
  cutoffPassed: boolean;
  /** Minutes remaining until the next 9:00 AM order cutoff. */
  minutesUntilCutoff: number;
  /** Is there an ordering window open today? */
  isOpenToday: boolean;
  /** Earliest guaranteed delivery date (respects the 2-business-day advance cutoff). */
  earliestDeliveryDate: Date;
  /** Locale-formatted earliest delivery date, spelled out. */
  formattedEarliest: string;
  /** Abbreviated earliest delivery date ("Wed, 09 Sept") — see OrderCutoffInfo. */
  formattedEarliestShort: string;
  /** The next 9:00 AM cutoff that hasn't passed yet — e.g. Monday 9am when checked over a weekend. */
  nextCutoffDate: Date;
  /** Human-readable explanation shown to the user. */
  message: string;
}

/**
 * Backwards-compatible delivery estimate, now backed by the centralised
 * business-hours rules above:
 *   - Business hours: Mon-Fri 08:00-17:00
 *   - Daily order cutoff: 9:00 AM
 *   - Advance ordering: 2 business days' lead normally, 3 if the order is
 *     placed at/after the 9:00 AM cutoff on a business day.
 */
export function getEstimatedDelivery(now: Date = new Date()): DeliveryEstimate {
  const info = getOrderCutoffInfo(now);
  return {
    isAfterCutoff: info.cutoffPassed,
    minutesLeft: info.minutesUntilCutoff,
    formattedDate: info.formattedEarliest,
    open: info.open,
    cutoffPassed: info.cutoffPassed,
    minutesUntilCutoff: info.minutesUntilCutoff,
    isOpenToday: info.isOpenToday,
    earliestDeliveryDate: info.earliestDeliveryDate,
    formattedEarliest: info.formattedEarliest,
    formattedEarliestShort: info.formattedEarliestShort,
    nextCutoffDate: info.nextCutoffDate,
    message: info.message,
  };
}

export interface UpcomingWeekday {
  /** yyyy-mm-dd, used as the stable identity for a scheduled delivery day. */
  iso: string;
  /** e.g. "Mon, 8 Sep" */
  label: string;
  /** e.g. "Monday" */
  dayName: string;
  weekLabel: 'This week' | 'Next week' | 'In 2 weeks';
}

/**
 * Weekday (Mon-Fri) delivery slots a customer can pre-schedule an order for,
 * starting from the earliest allowed delivery date (respects the 48h/cutoff
 * rules above) through `spanDays` calendar days out.
 *
 * This is only offered on the static Main Menu — its catalogue never
 * changes, so committing to a delivery date weeks out is safe. The rotating
 * weekly menu is intentionally NOT bookable this far ahead since its content
 * is admin-controlled week to week.
 */
export function getUpcomingOrderableWeekdays(now: Date = new Date(), spanDays: number = 14): UpcomingWeekday[] {
  const { earliestDeliveryDate } = getOrderCutoffInfo(now);

  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - ((startOfThisWeek.getDay() + 6) % 7)); // Monday
  startOfThisWeek.setHours(0, 0, 0, 0);
  const startOfNextWeek = new Date(startOfThisWeek);
  startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);
  const startOfWeekAfter = new Date(startOfNextWeek);
  startOfWeekAfter.setDate(startOfWeekAfter.getDate() + 7);

  // The horizon must always reach Friday of the "In 2 weeks" bucket so that
  // week is fully populated (Mon-Fri), regardless of which weekday "now" is.
  // A fixed `now + spanDays` cutoff was clipping that third week short.
  const endOfWeekAfter = new Date(startOfWeekAfter);
  endOfWeekAfter.setDate(endOfWeekAfter.getDate() + 4); // Friday
  endOfWeekAfter.setHours(23, 59, 59, 999);

  const calendarHorizon = new Date(now);
  calendarHorizon.setDate(calendarHorizon.getDate() + spanDays);
  calendarHorizon.setHours(23, 59, 59, 999);

  const horizon = endOfWeekAfter.getTime() > calendarHorizon.getTime() ? endOfWeekAfter : calendarHorizon;

  const slots: UpcomingWeekday[] = [];
  const cursor = new Date(earliestDeliveryDate);
  while (cursor.getTime() <= horizon.getTime()) {
    if (isWeekday(cursor)) {
      const weekLabel: UpcomingWeekday['weekLabel'] =
        cursor.getTime() < startOfNextWeek.getTime() ? 'This week'
        : cursor.getTime() < startOfWeekAfter.getTime() ? 'Next week'
        : 'In 2 weeks';
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, '0');
      const day = String(cursor.getDate()).padStart(2, '0');
      slots.push({
        iso: `${year}-${month}-${day}`,
        label: cursor.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }),
        dayName: cursor.toLocaleDateString('en-ZA', { weekday: 'long' }),
        weekLabel,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}

// ============================================================
// Distance-based delivery fee (client rule, confirmed 26 Aug 2026)
// ============================================================
//   0    - 15km  : R100
//   15.01 - 20km : R140
//   20.01 - 30km : R200
//   30.01 - 50km : R350
//   beyond 50km  : outside the covered delivery radius (no fee quoted)
export interface DeliveryFeeBand {
  /** Upper bound of this band, in km (inclusive). */
  maxKm: number;
  fee: number;
}

export const DELIVERY_FEE_BANDS: DeliveryFeeBand[] = [
  { maxKm: 15, fee: 100 },
  { maxKm: 20, fee: 140 },
  { maxKm: 30, fee: 200 },
  { maxKm: 50, fee: 350 },
];

export const MAX_DELIVERY_KM = DELIVERY_FEE_BANDS[DELIVERY_FEE_BANDS.length - 1].maxKm;

/**
 * Looks up the flat delivery fee for a given distance. Returns `null` when
 * the address falls outside the covered radius (currently 50km) — callers
 * should treat that as "we can't deliver there" rather than defaulting to
 * the top fee band.
 */
export function calculateDeliveryFee(distanceKm: number): number | null {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  for (const band of DELIVERY_FEE_BANDS) {
    if (distanceKm <= band.maxKm) return band.fee;
  }
  return null;
}
/**
 * Timezone & Date Utilities anchored to South Africa Standard Time (SAST, UTC+2).
 * SAST has no Daylight Saving Time, so it is strictly UTC+2 year-round.
 */

import { getSouthAfricanHoliday } from '../data/holidays';
import { DeliveryDateOption } from '../types';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

/**
 * Returns the current date/time converted to SAST (UTC+2).
 */
export function getNowInSAST(): Date {
  const now = new Date();
  const utcTimestamp = now.getTime() + now.getTimezoneOffset() * 60000;
  const sastTimestamp = utcTimestamp + 2 * 3600000; // SAST is UTC+2
  return new Date(sastTimestamp);
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses YYYY-MM-DD string into a Date at 00:00:00 in local representation
 */
export function parseDateISO(isoStr: string): Date {
  const [year, month, day] = isoStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Calculates the exact cutoff deadline timestamp for a given delivery date.
 * Rule: 48 business hours advance notice + 9:00 AM SAST cutoff.
 * If delivery is Wednesday -> Cutoff is Monday 9:00 AM SAST (2 business days prior).
 * If delivery is Thursday -> Cutoff is Tuesday 9:00 AM SAST.
 * If delivery is Friday -> Cutoff is Wednesday 9:00 AM SAST.
 * If delivery is Monday -> Cutoff is Thursday 9:00 AM SAST (2 business days prior).
 * If delivery is Tuesday -> Cutoff is Friday 9:00 AM SAST (2 business days prior).
 */
export function calculateCutoffDate(deliveryDate: Date): Date {
  const cutoff = new Date(deliveryDate);
  cutoff.setHours(9, 0, 0, 0);

  let businessDaysToSubtract = 2;
  while (businessDaysToSubtract > 0) {
    cutoff.setDate(cutoff.getDate() - 1);
    const dayOfWeek = cutoff.getDay(); // 0 is Sunday, 6 is Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDaysToSubtract--;
    }
  }

  return cutoff;
}

/**
 * Generates the list of valid upcoming weekdays (Monday to Friday) in SAST for up to 2 weeks in advance (10 weekdays),
 * evaluating 48-hour 9:00 AM SAST cutoff and public holidays.
 */
export function generateWeekdayOptions(referenceDate?: Date, count: number = 10): DeliveryDateOption[] {
  const nowSAST = referenceDate || getNowInSAST();
  const options: DeliveryDateOption[] = [];

  let candidateDate = new Date(nowSAST);
  candidateDate.setHours(0, 0, 0, 0);

  // Next 5 business weekdays (1 whole week advance)
  while (options.length < count) {
    candidateDate.setDate(candidateDate.getDate() + 1);
    const dayOfWeek = candidateDate.getDay();

    // Skip weekends (Saturday: 6, Sunday: 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }

    const isoString = formatDateISO(candidateDate);
    const holidayName = getSouthAfricanHoliday(isoString);
    const isHoliday = Boolean(holidayName);

    // Compute cutoff for this candidate delivery date
    const cutoffDate = calculateCutoffDate(candidateDate);
    const isPastCutoff = nowSAST.getTime() >= cutoffDate.getTime();

    const isLocked = isPastCutoff || isHoliday;
    const isAvailable = !isLocked;

    const dayName = DAY_NAMES[dayOfWeek];
    const fullDayName = FULL_DAY_NAMES[dayOfWeek];
    const dayNumber = candidateDate.getDate();
    const monthName = MONTH_NAMES[candidateDate.getMonth()];
    const fullMonthName = FULL_MONTH_NAMES[candidateDate.getMonth()];
    const year = candidateDate.getFullYear();

    const fullFormattedDate = `${fullDayName}, ${dayNumber} ${monthName} ${year}`;

    // Cutoff deadline description (9:00 AM SAST)
    const cutoffDayOfWeek = FULL_DAY_NAMES[cutoffDate.getDay()];
    const cutoffDayNum = cutoffDate.getDate();
    const cutoffMonth = MONTH_NAMES[cutoffDate.getMonth()];
    const cutoffDeadlineFormatted = `${cutoffDayOfWeek}, ${cutoffDayNum} ${cutoffMonth} at 9:00 AM SAST`;

    const noticeBannerText = `Orders for ${fullDayName}, ${dayNumber} ${fullMonthName} 12:00 PM must be placed before ${cutoffDayOfWeek} 9:00 AM SAST.`;

    options.push({
      dateString: isoString,
      dayName,
      dayNumber,
      monthName,
      year,
      fullFormattedDate,
      isAvailable,
      isLocked,
      isHoliday,
      holidayName: holidayName || undefined,
      cutoffDeadlineFormatted,
      noticeBannerText,
    });
  }

  return options;
}

// Alias for backwards compatibility with existing imports
export const generate14WeekdayOptions = generateWeekdayOptions;

export interface WeekdayWeekGroup {
  label: string;
  weekOffset: number;
  days: DeliveryDateOption[];
}

/**
 * Groups a list of DeliveryDateOption items into chronological calendar week groups
 * (e.g. 'THIS WEEK', 'NEXT WEEK', 'IN 2 WEEKS') relative to SAST current time or referenceDate.
 * Optionally limits up to maxWeeks in advance (default 2 weeks).
 */
export function groupWeekdaysByWeek(
  days: DeliveryDateOption[],
  referenceDate?: Date,
  maxWeeks: number = 2
): WeekdayWeekGroup[] {
  if (days.length === 0) return [];
  let now = referenceDate || getNowInSAST();
  const currentMonday = new Date(now);
  currentMonday.setHours(0, 0, 0, 0);
  const dayOfWeek = currentMonday.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  currentMonday.setDate(currentMonday.getDate() + diffToMonday);

  // If no referenceDate was explicitly passed and days contain earlier dates (e.g. mock or test dates),
  // align base Monday with the earliest date's week so dates are never dropped.
  if (!referenceDate && days.length > 0) {
    const firstDayDate = parseDateISO(days[0].dateString);
    if (firstDayDate.getTime() < currentMonday.getTime()) {
      currentMonday.setTime(firstDayDate.getTime());
      currentMonday.setHours(0, 0, 0, 0);
      const dow = currentMonday.getDay();
      const dtm = dow === 0 ? -6 : 1 - dow;
      currentMonday.setDate(currentMonday.getDate() + dtm);
    }
  }

  const groups: { [weekOffset: number]: DeliveryDateOption[] } = {};

  for (const day of days) {
    const dayDate = parseDateISO(day.dateString);
    const diffMs = dayDate.getTime() - currentMonday.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const weekOffset = Math.floor(diffDays / 7);

    // Skip past weeks or weeks beyond maxWeeks
    if (weekOffset < 0 || (maxWeeks > 0 && weekOffset > maxWeeks)) {
      continue;
    }

    if (!groups[weekOffset]) {
      groups[weekOffset] = [];
    }
    groups[weekOffset].push(day);
  }

  const result: WeekdayWeekGroup[] = [];
  const sortedOffsets = Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b);

  for (const offset of sortedOffsets) {
    let label = 'THIS WEEK';
    if (offset === 1) label = 'NEXT WEEK';
    else if (offset === 2) label = 'IN 2 WEEKS';
    else if (offset === 3) label = 'IN 3 WEEKS';
    else if (offset > 3) label = `IN ${offset} WEEKS`;

    if (groups[offset].length > 0) {
      result.push({
        label,
        weekOffset: offset,
        days: groups[offset],
      });
    }
  }

  return result;
}

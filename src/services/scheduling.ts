/**
 * Port of the MAUI OrderSchedulingService. Ordering is open every day; a
 * weekend order (or one after the 9:00 AM cutoff) counts from the next
 * weekday, and delivery is 2 business days after that effective order date.
 * place_order re-checks the same rule server-side (earliest_orderable_date).
 *
 * Dates are ISO yyyy-mm-dd strings built from local date parts — never
 * toISOString(), which is UTC and can land on the wrong calendar day.
 */

export const CUTOFF_HOUR = 9;
export const CUTOFF_MINUTE = 0;
/** Static menu: order up to 2 weeks (10 weekdays) ahead. */
export const STATIC_WINDOW = 10;
/** Cycle menu: order across the coming week (5 weekdays). */
export const CYCLE_WINDOW = 5;

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(): string {
  return toIso(new Date());
}

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

function nextWeekday(d: Date): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  while (isWeekend(next)) next.setDate(next.getDate() + 1);
  return next;
}

function addBusinessDays(d: Date, days: number): Date {
  const result = new Date(d);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) added++;
  }
  return result;
}

/** Always true — kept, as in MAUI, so a future closure rule has somewhere to live. */
export function isOrderingOpen(_now: Date = new Date()): boolean {
  return true;
}

export function getEffectiveOrderDate(now: Date = new Date()): Date {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // At/after 9:00 counts as past (MAUI uses strictly-after): place_order's
  // earliest_orderable_date treats 9:00 itself as past the cutoff, and the
  // UI must never offer a date the server will then reject.
  const pastCutoff = now.getHours() > CUTOFF_HOUR || (now.getHours() === CUTOFF_HOUR && now.getMinutes() >= CUTOFF_MINUTE);
  return isWeekend(now) || pastCutoff ? nextWeekday(date) : date;
}

export function getNextAvailableDeliveryDate(now: Date = new Date()): string {
  return toIso(addBusinessDays(getEffectiveOrderDate(now), 2));
}

export function getOrderableDeliveryDates(windowInWeekdays: number, now: Date = new Date()): string[] {
  const dates: string[] = [];
  let date = fromIso(getNextAvailableDeliveryDate(now));
  for (let i = 0; i < windowInWeekdays; i++) {
    dates.push(toIso(date));
    date = nextWeekday(date);
  }
  return dates;
}

export function isValidDeliveryDate(iso: string, windowInWeekdays: number, now: Date = new Date()): boolean {
  return getOrderableDeliveryDates(windowInWeekdays, now).includes(iso);
}

// ── Formatting (C# format strings MAUI binds with) ──────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "dddd, dd MMM" — e.g. "Wednesday, 07 Oct" */
export function fmtDayLabel(iso: string): string {
  const d = fromIso(iso);
  return `${DAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** "dddd, dd MMM yyyy" */
export function fmtLongDate(iso: string): string {
  return `${fmtDayLabel(iso)} ${fromIso(iso).getFullYear()}`;
}

/** "dddd" */
export function fmtWeekday(iso: string): string {
  return DAYS[fromIso(iso).getDay()];
}

/** "ddd" */
export function fmtShortWeekday(iso: string): string {
  return DAYS[fromIso(iso).getDay()].slice(0, 3);
}

/** "dd MMM yyyy" from a timestamp */
export function fmtDate(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** "MMM dd, yyyy" */
export function fmtMonthDayYear(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
}

/** "MMM dd, yyyy - hh:mm tt" */
export function fmtSentAt(ts: string): string {
  const d = new Date(ts);
  const h = d.getHours() % 12 || 12;
  return `${fmtMonthDayYear(d)} - ${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** "MMMM yyyy" */
export function fmtMonthYear(ts: string): string {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "MMM yyyy" */
export function fmtShortMonthYear(ts: string): string {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** "dddd, dd MMM yyyy HH:mm" */
export function fmtGenerated(d: Date = new Date()): string {
  return `${fmtLongDate(toIso(d))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const money = (n: number) => n.toFixed(2);

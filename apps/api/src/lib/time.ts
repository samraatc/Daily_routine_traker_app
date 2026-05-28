import { DateTime } from 'luxon';

/** Today's date as YYYY-MM-DD in the given IANA timezone. */
export function todayInZone(timezone: string): string {
  return DateTime.now().setZone(timezone).toISODate() ?? DateTime.utc().toISODate()!;
}

/** Convert a JS Date to YYYY-MM-DD string. */
export function toDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Subtract n calendar days from a YYYY-MM-DD string. */
export function addDays(dateStr: string, n: number): string {
  const dt = DateTime.fromISO(dateStr, { zone: 'utc' }).plus({ days: n });
  return dt.toISODate() ?? dateStr;
}

/** Returns day-of-week (0=Sunday .. 6=Saturday) for a YYYY-MM-DD. */
export function dayOfWeek(dateStr: string): number {
  // Luxon: 1 = Monday .. 7 = Sunday. Convert to 0..6 with Sunday = 0.
  const dt = DateTime.fromISO(dateStr, { zone: 'utc' });
  return dt.weekday % 7;
}

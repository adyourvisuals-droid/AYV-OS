/**
 * Attendance is a calendar-day concept, not a timestamp — "did this person
 * show up today?" The day must be the org's local day, not the server's.
 *
 * On Vercel the server runs in UTC, so a naive `new Date().setHours(0,0,0,0)`
 * pins the day to the UTC calendar. For an India-based org (Asia/Kolkata,
 * UTC+5:30) that is wrong for the first 5.5 hours of every local day: a
 * check-in at 01:00 IST lands on the previous UTC date, so the record is
 * filed under yesterday and the "today" lookup can't find it — which is
 * exactly why Check out never appeared.
 *
 * These helpers derive the day from the org's timezone and return it as
 * midnight-UTC of that local day, a single deterministic value per local
 * calendar day that keeps the `userId_date` unique constraint meaningful.
 */

/** Midnight-UTC of the org-local calendar day containing `now`. */
export function attendanceDay(timezone: string, now: Date = new Date()): Date {
  // en-CA formats as YYYY-MM-DD, which we can turn straight into a UTC date.
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  return new Date(`${localDate}T00:00:00.000Z`);
}

/** First and last day (inclusive) of the org-local month containing `now`, as midnight-UTC dates. */
export function attendanceMonthRange(timezone: string, now: Date = new Date()): { start: Date; end: Date } {
  const day = attendanceDay(timezone, now);
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  const end = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0));
  return { start, end };
}

/** First and last day (inclusive) of an explicit month/year, as midnight-UTC dates. */
export function attendanceMonthRangeFor(month: number, year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
}

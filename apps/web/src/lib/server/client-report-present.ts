const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A human month label like "August 2026". */
export function monthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1] ?? '?'} ${year}`;
}

/**
 * The UTC half-open range [start, end) covering a calendar month.
 * Retainer deliverables are keyed by {month, year} integers, but invoices
 * and social posts are timestamped — so we filter those by this window.
 */
export function monthRange(month: number, year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

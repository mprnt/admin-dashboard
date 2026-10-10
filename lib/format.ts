/**
 * Display formatting. Kept in one place so currency and dates read the same
 * everywhere, and so the locale is a single decision rather than scattered.
 */

const LOCALE = 'en-IN';

export function currency(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

/** Compact form for stat tiles, where ₹1,24,500 would overflow on a phone. */
export function currencyCompact(value: number): string {
  if (Math.abs(value) >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }
  if (Math.abs(value) >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }
  return currency(value);
}

export function number(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value || 0);
}

export function dateTime(value: string | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function dateOnly(value: string | null): string {
  if (!value) return '-';
  // Date-only strings from the API are already in the shop's timezone; parsing
  // them as UTC avoids the browser shifting them by its own offset.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short' }).format(d);
}

/**
 * "8 October 2026", with the year, in the given timezone.
 *
 * For a moment in time rather than a calendar date: a shop that joined at
 * 11pm should see the day it joined in its own timezone, not whatever day it
 * was on the server or in the browser's.
 */
export function dateLong(value: string | null, timeZone?: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  try {
    return new Intl.DateTimeFormat(LOCALE, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone,
    }).format(d);
  } catch {
    // An unrecognised timezone name should not blank the page.
    return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  }
}

/** How long ago, in the largest sensible unit: "3 days", "5 months", "2 years". */
export function sinceLabel(value: string | null, now: number = Date.now()): string {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';

  const days = Math.max(0, Math.floor((now - then) / 86_400_000));
  if (days < 1) return 'today';
  if (days < 60) return `${days} day${days === 1 ? '' : 's'}`;

  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months`;

  const years = Math.floor(days / 365.25);
  return `${years} years`;
}

export function duration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function relativeAge(seconds: number): string {
  if (seconds < 60) return 'just now';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function titleCase(value: string): string {
  return value.replace(/[_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

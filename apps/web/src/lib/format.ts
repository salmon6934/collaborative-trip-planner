/**
 * Formatting helpers shared across the TripSync UI:
 * date-range display, relative timestamps, and timezone abbreviations.
 * Implemented without external date libraries to keep the bundle lean.
 */

/**
 * Parses a date-only string (YYYY-MM-DD) or ISO string into a local Date at midnight.
 */
function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // Date-only strings are anchored to local midnight to avoid TZ drift.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value + 'T00:00:00');
  }
  return new Date(value);
}

/**
 * Formats a single date like "Mon, Jan 15".
 */
export function formatDayLabel(value: string | Date): string {
  return parseDate(value).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a date range like "Mon, Jan 15 – Fri, Jan 19".
 * Collapses to a single date when start and end are the same day.
 */
export function formatDateRange(start: string | Date, end: string | Date): string {
  const s = formatDayLabel(start);
  const e = formatDayLabel(end);
  if (s === e) return s;
  return `${s} – ${e}`;
}

/**
 * Returns a compact relative time string like "just now", "5 min ago", "2 h ago",
 * "3 d ago", or a short date for anything older than a week.
 */
export function formatRelativeTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 0) return 'just now';
  if (diffSec < 45) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Returns true if the given timestamp is within the last `hours` hours.
 */
export function isWithinHours(value: string | Date, hours: number): boolean {
  const date = value instanceof Date ? value : new Date(value);
  return Date.now() - date.getTime() < hours * 60 * 60 * 1000;
}

/**
 * Formats an "on {date}" absolute date like "Jan 15, 2025".
 */
export function formatAbsoluteDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Formats an HH:mm 24h time string into a 12h display like "10:30 AM".
 * Optionally appends a timezone abbreviation (e.g. "10:30 AM JST").
 */
export function formatTime(time: string | null, tzAbbrev?: string | null): string {
  if (!time) return '';
  const parts = time.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1] ?? '00';
  if (Number.isNaN(hours)) return time;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  const base = `${displayHour}:${minutes} ${ampm}`;
  return tzAbbrev ? `${base} ${tzAbbrev}` : base;
}

/**
 * IANA timezone identifier -> short abbreviation lookup for common destinations.
 * Falls back to deriving an abbreviation from the identifier when unknown.
 */
const TZ_ABBREVIATIONS: Record<string, string> = {
  'Asia/Tokyo': 'JST',
  'Asia/Kolkata': 'IST',
  'Asia/Calcutta': 'IST',
  'Asia/Dubai': 'GST',
  'Asia/Singapore': 'SGT',
  'Asia/Shanghai': 'CST',
  'Asia/Hong_Kong': 'HKT',
  'Asia/Bangkok': 'ICT',
  'Asia/Seoul': 'KST',
  'Europe/London': 'GMT',
  'Europe/Paris': 'CET',
  'Europe/Berlin': 'CET',
  'Europe/Madrid': 'CET',
  'Europe/Rome': 'CET',
  'Europe/Moscow': 'MSK',
  'America/New_York': 'ET',
  'America/Chicago': 'CT',
  'America/Denver': 'MT',
  'America/Los_Angeles': 'PT',
  'America/Sao_Paulo': 'BRT',
  'Australia/Sydney': 'AEST',
  'Pacific/Auckland': 'NZST',
  UTC: 'UTC',
};

/**
 * Resolves a timezone identifier to a short abbreviation suitable for display
 * next to times. Returns null for empty/unknown-but-unresolvable values.
 */
export function timezoneAbbreviation(tz: string | null | undefined): string | null {
  if (!tz) return null;
  if (TZ_ABBREVIATIONS[tz]) return TZ_ABBREVIATIONS[tz];

  // Try to derive a live abbreviation via Intl for arbitrary IANA zones.
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (name && !/^GMT[+-]/.test(name)) return name;
    if (name) return name; // GMT+X style is still informative
  } catch {
    // Invalid IANA id — fall through
  }

  // Last resort: take the city portion initials.
  const city = tz.split('/').pop();
  return city ? city.replace(/_/g, ' ') : null;
}

/**
 * A small curated list of timezones to suggest, keyed by lowercase destination
 * substrings. Returns an IANA id or null.
 */
const DESTINATION_TZ_HINTS: { match: string; tz: string }[] = [
  { match: 'japan', tz: 'Asia/Tokyo' },
  { match: 'tokyo', tz: 'Asia/Tokyo' },
  { match: 'india', tz: 'Asia/Kolkata' },
  { match: 'delhi', tz: 'Asia/Kolkata' },
  { match: 'mumbai', tz: 'Asia/Kolkata' },
  { match: 'goa', tz: 'Asia/Kolkata' },
  { match: 'manali', tz: 'Asia/Kolkata' },
  { match: 'dubai', tz: 'Asia/Dubai' },
  { match: 'singapore', tz: 'Asia/Singapore' },
  { match: 'bangkok', tz: 'Asia/Bangkok' },
  { match: 'thailand', tz: 'Asia/Bangkok' },
  { match: 'london', tz: 'Europe/London' },
  { match: 'paris', tz: 'Europe/Paris' },
  { match: 'france', tz: 'Europe/Paris' },
  { match: 'berlin', tz: 'Europe/Berlin' },
  { match: 'rome', tz: 'Europe/Rome' },
  { match: 'italy', tz: 'Europe/Rome' },
  { match: 'new york', tz: 'America/New_York' },
  { match: 'chicago', tz: 'America/Chicago' },
  { match: 'los angeles', tz: 'America/Los_Angeles' },
  { match: 'san francisco', tz: 'America/Los_Angeles' },
  { match: 'sydney', tz: 'Australia/Sydney' },
  { match: 'australia', tz: 'Australia/Sydney' },
];

/**
 * Suggests an IANA timezone id from a free-text destination string.
 * Returns null when no confident match is found.
 */
export function suggestTimezoneFromDestination(destination: string | null | undefined): string | null {
  if (!destination) return null;
  const lower = destination.toLowerCase();
  for (const hint of DESTINATION_TZ_HINTS) {
    if (lower.includes(hint.match)) return hint.tz;
  }
  return null;
}

/**
 * A curated list of common IANA timezones for the settings dropdown.
 */
export const COMMON_TIMEZONES: string[] = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Seoul',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

// ─── Money / minor-unit formatting ───────────────────────────────────────────
//
// All monetary values travel over the wire as integer minor units (e.g. paise
// or cents) to avoid floating-point drift. These helpers convert to/from a
// decimal representation for display and form input only.

/**
 * Number of minor-unit decimal places per currency. Most currencies use 2
 * (e.g. INR paise, USD cents). Zero-decimal currencies are listed explicitly.
 */
const CURRENCY_DECIMALS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
};

/** Returns the number of minor-unit decimal places for a currency code. */
export function currencyDecimals(currency: string): number {
  return CURRENCY_DECIMALS[currency?.toUpperCase()] ?? 2;
}

/**
 * Formats an integer minor-unit amount for display, e.g. formatMoney(2450000, 'INR')
 * -> "INR 24,500.00". Uses grouped thousands and the currency's decimal places.
 */
export function formatMoney(amountMinor: number, currency = 'INR'): string {
  const decimals = currencyDecimals(currency);
  const factor = 10 ** decimals;
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const major = abs / factor;
  const formatted = major.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${negative ? '-' : ''}${currency} ${formatted}`;
}

/**
 * Formats a signed net balance with an explicit sign, e.g. "+INR 1,200.00" or
 * "-INR 800.00". Zero renders without a sign.
 */
export function formatSignedMoney(amountMinor: number, currency = 'INR'): string {
  if (amountMinor === 0) return formatMoney(0, currency);
  const sign = amountMinor > 0 ? '+' : '-';
  return `${sign}${formatMoney(Math.abs(amountMinor), currency)}`;
}

/**
 * Converts an integer minor-unit amount to a decimal-string suitable for a
 * form input value, e.g. toMajorString(2450000, 'INR') -> "24500.00".
 */
export function toMajorString(amountMinor: number, currency = 'INR'): string {
  const decimals = currencyDecimals(currency);
  const factor = 10 ** decimals;
  return (amountMinor / factor).toFixed(decimals);
}

/**
 * Parses a user-entered decimal amount (major units) into integer minor units.
 * Returns null when the input is empty or not a valid non-negative number.
 * Rounds to the nearest minor unit to avoid floating-point residue.
 */
export function parseMoneyToMinor(input: string, currency = 'INR'): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  const factor = 10 ** currencyDecimals(currency);
  return Math.round(value * factor);
}

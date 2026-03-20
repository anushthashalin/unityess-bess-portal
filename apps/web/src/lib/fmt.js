/** Format a number as Indian Rupees with Cr/L shorthand */
export function inr(v) {
  if (v == null) return '—';
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)} L`;
  return `₹${Number(v).toLocaleString('en-IN')}`;
}

/** Format a number with Indian comma grouping + optional unit */
export function num(v, unit = '') {
  if (v == null) return '—';
  return `${Number(v).toLocaleString('en-IN')}${unit ? ' ' + unit : ''}`;
}

/** Lookup helper — find name field by id in an array */
export function lookup(arr, id, field = 'company_name') {
  return arr?.find(r => r.id === id)?.[field] ?? '—';
}

/** Format ISO date string to Indian locale */
export function date(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Days since a timestamp */
export function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - new Date(ts)) / 86_400_000);
}

/**
 * Build a Google Calendar "Add to Calendar" deep link.
 *
 * @param {object} opts
 * @param {string}  opts.title        — event title
 * @param {string}  opts.dateStr      — ISO date string OR YYYY-MM-DD (due date)
 * @param {number}  [opts.hour=9]     — start hour in IST (local) when using a date-only string
 * @param {number}  [opts.durationMin=30] — event duration in minutes
 * @param {string}  [opts.description] — event description / notes
 * @param {string}  [opts.location]   — location field
 *
 * Returns a fully-encoded Google Calendar URL.
 */
export function gcalLink({ title, dateStr, hour = 9, durationMin = 30, description = '', location = '' }) {
  // Build a local Date at the given hour, then convert to UTC for the URL
  const base = new Date(dateStr);
  // dateStr might be YYYY-MM-DD (date-only); in that case getTime() is midnight UTC.
  // We add the IST offset (UTC+5:30 = 330 min) then set the desired hour.
  const startLocal = new Date(base);
  startLocal.setUTCHours(hour - 5, 30 - 30, 0, 0);   // IST hour → UTC (subtract 5h30m)

  const endLocal = new Date(startLocal.getTime() + durationMin * 60_000);

  // Format: YYYYMMDDTHHmmssZ
  const fmt = d =>
    d.toISOString()
      .replace(/[-:]/g, '')   // remove dashes and colons
      .replace(/\.\d{3}/, '') // remove milliseconds
      .slice(0, 15) + 'Z';

  const dates = `${fmt(startLocal)}/${fmt(endLocal)}`;

  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${dates}` +
    `&details=${encodeURIComponent(description)}` +
    `&location=${encodeURIComponent(location)}` +
    '&trp=false'
  );
}

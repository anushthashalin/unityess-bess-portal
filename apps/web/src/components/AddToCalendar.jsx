import { gcalLink } from '../lib/fmt.js';
import { Calendar } from 'lucide-react';

/**
 * Reusable "Add to Google Calendar" button.
 *
 * Props:
 *   title        — event title (required)
 *   dateStr      — ISO date or YYYY-MM-DD string (required)
 *   hour         — start hour in IST, default 9
 *   durationMin  — event length in minutes, default 30
 *   description  — pre-filled event description
 *   location     — pre-filled location
 *   size         — 'sm' (default) | 'md'
 *   label        — button label override (default "Add to Calendar")
 */
export default function AddToCalendar({
  title,
  dateStr,
  hour = 9,
  durationMin = 30,
  description = '',
  location = '',
  size = 'sm',
  label,
}) {
  if (!title || !dateStr) return null;

  const url = gcalLink({ title, dateStr, hour, durationMin, description, location });

  const isSm = size === 'sm';

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Open in Google Calendar"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? 4 : 6,
        padding: isSm ? '4px 9px' : '7px 13px',
        border: '1px solid #bbf7d0',
        borderRadius: 7,
        background: '#f0fdf4',
        color: '#16a34a',
        fontSize: isSm ? 11 : 12,
        fontWeight: 700,
        fontFamily: "'Chivo', sans-serif",
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'all 0.12s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#dcfce7';
        e.currentTarget.style.borderColor = '#86efac';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = '#f0fdf4';
        e.currentTarget.style.borderColor = '#bbf7d0';
      }}
    >
      <Calendar size={isSm ? 11 : 13} />
      {label ?? (isSm ? 'Calendar' : 'Add to Calendar')}
    </a>
  );
}

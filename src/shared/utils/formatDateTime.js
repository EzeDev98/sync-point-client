// Date and time formatting for the Nigerian locale.
const SHORT_DATE_TIME = {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
};

const LOCALE = 'en-NG';

export function formatShortDateTime(value) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(LOCALE, SHORT_DATE_TIME);
}

/**
 * Naira formatting.
 *
 * The pattern `₦${Number(x).toLocaleString()}` appeared at more than twenty
 * call sites, each re-deciding whether to coerce the value first and what to
 * do with a null. Centralised so amounts render identically everywhere.
 */

const NAIRA = '₦';

export function formatNaira(amount, { signed = false } = {}) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return `${NAIRA}0`;

  const formatted = `${NAIRA}${Math.abs(numeric).toLocaleString('en-NG')}`;

  if (!signed) return formatted;
  return numeric < 0 ? `-${formatted}` : `+${formatted}`;
}

/** Formats a transaction amount with the sign implied by its entry type. */
export function formatEntryAmount(amount, entryType) {
  const numeric = Math.abs(Number(amount) || 0);
  const prefix = entryType === 'CREDIT' ? '+' : '-';
  return `${prefix}${NAIRA}${numeric.toLocaleString('en-NG')}`;
}
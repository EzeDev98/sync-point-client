// Naira currency formatting.
const NAIRA = '₦';

export function formatNaira(amount, { signed = false } = {}) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return `${NAIRA}0`;

  const formatted = `${NAIRA}${Math.abs(numeric).toLocaleString('en-NG')}`;

  if (!signed) return formatted;
  return numeric < 0 ? `-${formatted}` : `+${formatted}`;
}

export function formatEntryAmount(amount, entryType) {
  const numeric = Math.abs(Number(amount) || 0);
  const prefix = entryType === 'CREDIT' ? '+' : '-';
  return `${prefix}${NAIRA}${numeric.toLocaleString('en-NG')}`;
}

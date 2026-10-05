/** Locale-aware money. Zero renders as "Free", which the old formatPrice silently dropped. */
export function formatMoney(amount: number | undefined | null, currency = 'THB'): string {
  if (amount === undefined || amount === null) return '';
  if (amount === 0) return 'Free';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

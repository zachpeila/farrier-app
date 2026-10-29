/** Money is stored as integer cents with a currency code ('usd' or 'cad'). */

export function formatMoney(cents: number | null | undefined, currency = 'usd'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(
    (cents ?? 0) / 100,
  );
}

/** "45", "45.5", "$45.50" → 4550. Returns null when it isn't a number. */
export function parseMoney(text: string): number | null {
  const n = Number(text.replace(/[^0-9.]/g, ''));
  if (!text.trim() || !Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export const INVOICE_STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  partially_paid: 'Part paid',
  paid: 'Paid',
  void: 'Void',
} as const;

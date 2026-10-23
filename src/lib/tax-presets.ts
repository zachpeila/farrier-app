/**
 * Starting points for sales tax by province. Rates are in basis points
 * (500 = 5%). The farrier confirms them; whether shoeing is taxable, and
 * whether they're registered, depends on their situation.
 * QST is 9.975%, which the schema's whole-basis-point column stores as 998.
 */
export const CA_TAX_PRESETS: Record<string, { name: string; rate_bp: number }[]> = {
  AB: [{ name: 'GST', rate_bp: 500 }],
  BC: [
    { name: 'GST', rate_bp: 500 },
    { name: 'PST', rate_bp: 700 },
  ],
  MB: [
    { name: 'GST', rate_bp: 500 },
    { name: 'PST', rate_bp: 700 },
  ],
  NB: [{ name: 'HST', rate_bp: 1500 }],
  NL: [{ name: 'HST', rate_bp: 1500 }],
  NS: [{ name: 'HST', rate_bp: 1400 }],
  ON: [{ name: 'HST', rate_bp: 1300 }],
  PE: [{ name: 'HST', rate_bp: 1500 }],
  QC: [
    { name: 'GST', rate_bp: 500 },
    { name: 'QST', rate_bp: 998 },
  ],
  SK: [
    { name: 'GST', rate_bp: 500 },
    { name: 'PST', rate_bp: 600 },
  ],
  NT: [{ name: 'GST', rate_bp: 500 }],
  NU: [{ name: 'GST', rate_bp: 500 }],
  YT: [{ name: 'GST', rate_bp: 500 }],
};

export function formatRate(bp: number): string {
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
}

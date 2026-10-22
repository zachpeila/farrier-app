import type { ShoeStatus } from './types';

export const SHOE_OPTIONS: { value: ShoeStatus; label: string }[] = [
  { value: 'barefoot', label: 'Barefoot' },
  { value: 'shod_front', label: 'Shod front' },
  { value: 'shod_full', label: 'Shod all round' },
  { value: 'other', label: 'Other' },
];

/** The schema allows 3 to 16 weeks; these are the common cycles. */
export const INTERVAL_OPTIONS = [4, 5, 6, 7, 8, 10, 12].map((w) => ({ value: String(w), label: `${w} wk` }));

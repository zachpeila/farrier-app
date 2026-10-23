import type { Database } from './database.types';

export type Foot = Database['public']['Enums']['foot_position'];

export const FEET: { value: Foot; label: string }[] = [
  { value: 'LF', label: 'Left front' },
  { value: 'RF', label: 'Right front' },
  { value: 'LH', label: 'Left hind' },
  { value: 'RH', label: 'Right hind' },
];

export const WORK_TYPES = [
  { value: 'trim', label: 'Trim' },
  { value: 'shoe_front', label: 'Front shoes' },
  { value: 'shoe_full', label: 'Full set' },
  { value: 'reset', label: 'Reset' },
];

export const FOOT_WORK = [
  { value: 'trim', label: 'Trim' },
  { value: 'reset', label: 'Reset' },
  { value: 'new_shoe', label: 'New shoe' },
  { value: 'pull', label: 'Pull' },
  { value: 'none', label: 'Nothing' },
];

/** What each foot gets for a visit-level work type, as a starting point to edit. */
export function footWorkFor(workType: string, foot: Foot): string {
  const front = foot === 'LF' || foot === 'RF';
  switch (workType) {
    case 'shoe_front':
      return front ? 'new_shoe' : 'trim';
    case 'shoe_full':
      return 'new_shoe';
    case 'reset':
      return 'reset';
    default:
      return 'trim';
  }
}

export const FLAG_TYPES = [
  { value: 'crack', label: 'Crack' },
  { value: 'abscess', label: 'Abscess' },
  { value: 'lameness', label: 'Lameness' },
  { value: 'thrush', label: 'Thrush' },
  { value: 'other', label: 'Other problem' },
];

export const GROUND = [
  { value: 'wet_pasture', label: 'Wet pasture' },
  { value: 'dry_rocky', label: 'Dry / rocky' },
  { value: 'stalled', label: 'Stalled' },
  { value: 'mixed', label: 'Mixed' },
];

export function label(options: { value: string; label: string }[], value: string | null | undefined) {
  return options.find((o) => o.value === value)?.label ?? value ?? '';
}

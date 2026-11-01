/** Shared bits for the farrier listing and the owner's farrier search. */

export const SERVICES = [
  { value: 'trim', label: 'Trims' },
  { value: 'shoeing', label: 'Shoeing' },
  { value: 'therapeutic', label: 'Therapeutic / corrective' },
  { value: 'glue_on', label: 'Glue-ons' },
  { value: 'barefoot_rehab', label: 'Barefoot rehab' },
  { value: 'draft', label: 'Draft horses' },
  { value: 'minis', label: 'Minis and donkeys' },
  { value: 'emergency', label: 'Emergencies' },
];

export function serviceLabels(values: string[]) {
  return values.map((v) => SERVICES.find((s) => s.value === v)?.label ?? v);
}

/** Travel radius choices in the farrier's own unit; the value is stored in km. */
export function radiusOptions(unit: string) {
  if (unit === 'mi') {
    return [15, 25, 40, 50, 75, 100].map((mi) => ({ value: String(Math.round(mi * 1.609344)), label: `${mi} mi` }));
  }
  return [25, 40, 60, 80, 120, 160].map((km) => ({ value: String(km), label: `${km} km` }));
}

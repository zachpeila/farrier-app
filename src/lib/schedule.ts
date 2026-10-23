/** Helpers for appointment windows. Times are shown in the device's time zone. */

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** 'YYYY-MM-DD' in local time, for Postgres `date` columns. */
export function toDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatDay(d: Date): string {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "9:00 AM – 11:00 AM", or just the start when there is no end. */
export function formatWindow(start: string, end: string | null): string {
  const s = formatTime(new Date(start));
  return end ? `${s} – ${formatTime(new Date(end))}` : s;
}

/** Arrival window start choices, 6 AM to 5 PM on the half hour, as minutes after midnight. */
export const WINDOW_STARTS = Array.from({ length: 23 }, (_, i) => 6 * 60 + i * 30);

export const WINDOW_LENGTHS = [
  { value: '60', label: '1 hr' },
  { value: '120', label: '2 hr' },
  { value: '180', label: '3 hr' },
  { value: '240', label: 'Half day' },
];

export function minutesLabel(minutes: number): string {
  const d = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return formatTime(d);
}

export function atMinutes(day: Date, minutes: number): Date {
  const d = startOfDay(day);
  d.setMinutes(minutes);
  return d;
}

export function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

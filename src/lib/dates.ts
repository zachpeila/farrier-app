/** Date helpers. Postgres `date` columns arrive as 'YYYY-MM-DD' strings with no time zone. */

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole days from today until the date; negative when it is in the past. */
export function daysUntil(d: string): number {
  return Math.round((parseDate(d).getTime() - today().getTime()) / DAY_MS);
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return 'Never';
  return parseDate(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export type DueStatus = 'overdue' | 'this_week' | 'soon' | 'later' | 'unknown';

/** Buckets for the due list. "Soon" is the next 3 weeks, roughly half a shoeing cycle. */
export function dueStatus(nextDue: string | null): DueStatus {
  if (!nextDue) return 'unknown';
  const days = daysUntil(nextDue);
  if (days < 0) return 'overdue';
  if (days <= 7) return 'this_week';
  if (days <= 21) return 'soon';
  return 'later';
}

export function dueLabel(nextDue: string | null): string {
  if (!nextDue) return 'No due date yet';
  const days = daysUntil(nextDue);
  if (days < -1) return `${-days} days overdue`;
  if (days === -1) return '1 day overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

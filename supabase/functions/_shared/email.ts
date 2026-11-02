// Sends email through Resend (https://resend.com). Needs the secrets
// RESEND_API_KEY and EMAIL_FROM (e.g. "Farrier App <hello@yourdomain.com>",
// on a domain verified in Resend). Without them, email is skipped.

export const emailEnabled = () => !!Deno.env.get('RESEND_API_KEY') && !!Deno.env.get('EMAIL_FROM');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A plain, readable email: a few paragraphs and one button. */
export function emailHtml(paragraphs: string[], button?: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${esc(p)}</p>`).join('');
  const cta = button
    ? `<p style="margin:24px 0"><a href="${esc(button.url)}" style="background:#8A4B14;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(button.label)}</a></p>`
    : '';
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a;max-width:32rem">${body}${cta}</div>`;
}

export async function sendEmail(to: string, subject: string, html: string, replyTo?: string | null) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM'), to, subject, html, reply_to: replyTo ?? undefined }),
  });
  if (!res.ok) throw new Error(`email failed: ${res.status} ${await res.text()}`);
}

export const SITE = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://farrier-app.vercel.app';

export function formatWindow(start: string, end: string | null, timeZone: string) {
  const opts: Intl.DateTimeFormatOptions = { timeZone, hour: 'numeric', minute: '2-digit' };
  const day = new Date(start).toLocaleDateString('en-US', { timeZone, weekday: 'long', month: 'short', day: 'numeric' });
  const from = new Date(start).toLocaleTimeString('en-US', opts);
  return end ? `${day}, arriving ${from}–${new Date(end).toLocaleTimeString('en-US', opts)}` : `${day}, ${from}`;
}

export function money(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

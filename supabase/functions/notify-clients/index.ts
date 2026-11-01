// The farrier's app calls this after booking, moving or cancelling a visit,
// sending an invoice, or running late. Each owner gets an email with their
// own link (if they have an email address), and owners on the app also get
// a push notification. Texts go from the farrier's own phone instead.

import { emailEnabled, emailHtml, formatWindow, money, sendEmail, SITE } from '../_shared/email.ts';
import { admin, callerId, cors, json } from '../_shared/stripe.ts';

type Kind = 'booked' | 'changed' | 'cancelled' | 'invoice' | 'late';
type Client = { id: string; full_name: string; email: string | null; linked_user_id: string | null };

async function linkFor(providerId: string, clientId: string, ref: { appointment_id?: string; invoice_id?: string }) {
  const col = ref.appointment_id ? 'appointment_id' : 'invoice_id';
  const val = ref.appointment_id ?? ref.invoice_id!;
  const { data: found } = await admin.from('public_links').select('token').eq('client_id', clientId).eq(col, val).maybeSingle();
  if (found) return `${SITE}/l/${found.token}`;
  const { data, error } = await admin
    .from('public_links')
    .insert({ provider_id: providerId, client_id: clientId, ...ref })
    .select('token')
    .single();
  if (error) throw error;
  return `${SITE}/l/${data.token}`;
}

async function push(userIds: string[], title: string, body: string, url: string) {
  if (!userIds.length) return 0;
  const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', userIds);
  if (!tokens?.length) return 0;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tokens.map((t) => ({ to: t.token, title, body, data: { url } }))),
  });
  return tokens.length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const userId = await callerId(req);
  if (!userId) return json({ error: 'not signed in' }, 401);

  try {
    const { kind, appointmentId, invoiceId, minutesLate } = (await req.json()) as {
      kind: Kind;
      appointmentId?: string;
      invoiceId?: string;
      minutesLate?: number;
    };
    const { data: me } = await admin
      .from('profiles')
      .select('full_name, business_name, email, phone, timezone')
      .eq('id', userId)
      .single();
    const from = me?.business_name || me?.full_name || 'Your farrier';
    const tz = me?.timezone ?? 'America/Denver';
    const sign = me?.phone ? `${from} · ${me.phone}` : from;

    const emailed: string[] = [];
    const noEmail: string[] = [];
    let pushed = 0;

    if (kind === 'invoice') {
      const { data: inv } = await admin
        .from('invoices')
        .select('id, provider_id, invoice_number, total_cents, amount_paid_cents, currency, due_date, clients(id, full_name, email, linked_user_id)')
        .eq('id', invoiceId!)
        .single();
      if (!inv || inv.provider_id !== userId) return json({ error: 'invoice not found' }, 404);
      const client = inv.clients as unknown as Client;
      const url = await linkFor(userId, client.id, { invoice_id: inv.id });
      const owing = money((inv.total_cents ?? 0) - inv.amount_paid_cents, inv.currency);
      if (client.email && emailEnabled()) {
        await sendEmail(
          client.email,
          `Invoice #${inv.invoice_number} from ${from}: ${owing}`,
          emailHtml(
            [`Hi ${client.full_name.split(' ')[0]},`, `Here is invoice #${inv.invoice_number} for ${owing}${inv.due_date ? `, due ${inv.due_date}` : ''}.`, sign],
            { label: 'View and pay', url },
          ),
          me?.email,
        );
        emailed.push(client.full_name);
        await admin.from('client_messages').insert({ provider_id: userId, client_id: client.id, kind, channel: 'email', invoice_id: inv.id });
      } else noEmail.push(client.full_name);
      if (client.linked_user_id) pushed += await push([client.linked_user_id], `Invoice from ${from}`, `Invoice #${inv.invoice_number}: ${owing}`, `/invoice/${inv.id}`);
      return json({ emailed, noEmail, pushed, emailEnabled: emailEnabled() });
    }

    const { data: appt } = await admin
      .from('appointments')
      .select('id, provider_id, scheduled_start, scheduled_end, locations(name), appointment_horses(horse_id, horses(name))')
      .eq('id', appointmentId!)
      .single();
    if (!appt || appt.provider_id !== userId) return json({ error: 'visit not found' }, 404);
    const horseIds = appt.appointment_horses.map((h) => h.horse_id);
    const { data: owners } = await admin
      .from('horse_owners')
      .select('horse_id, clients!inner(id, full_name, email, linked_user_id, provider_id)')
      .in('horse_id', horseIds)
      .eq('clients.provider_id', userId);

    const byClient = new Map<string, { client: Client; horses: string[] }>();
    for (const o of owners ?? []) {
      const c = o.clients as unknown as Client;
      const name = (appt.appointment_horses.find((h) => h.horse_id === o.horse_id)?.horses as unknown as { name: string } | null)?.name;
      const entry = byClient.get(c.id) ?? { client: c, horses: [] };
      if (name) entry.horses.push(name);
      byClient.set(c.id, entry);
    }

    const when = formatWindow(appt.scheduled_start, appt.scheduled_end, tz);
    const barn = (appt.locations as unknown as { name: string } | null)?.name;
    for (const { client, horses } of byClient.values()) {
      const first = client.full_name.split(' ')[0];
      const names = horses.join(' and ') || 'your horses';
      const url = await linkFor(userId, client.id, { appointment_id: appt.id });
      const content: Record<Kind, { subject: string; lines: string[]; button?: string; push: string }> = {
        booked: {
          subject: `Farrier visit booked: ${when}`,
          lines: [`Hi ${first},`, `${from} is booked for ${names}${barn ? ` at ${barn}` : ''} on ${when}.`, 'Please confirm the time, or ask for a different one.', sign],
          button: 'Confirm or change',
          push: `${from} is coming ${when}. Tap to confirm.`,
        },
        changed: {
          subject: `New time for your farrier visit: ${when}`,
          lines: [`Hi ${first},`, `${from} moved the visit for ${names} to ${when}.`, 'Please confirm the new time, or ask for a different one.', sign],
          button: 'Confirm or change',
          push: `New time: ${when}. Tap to confirm.`,
        },
        cancelled: {
          subject: 'Farrier visit cancelled',
          lines: [`Hi ${first},`, `${from} cancelled the visit for ${names} on ${when}. They will be in touch to rebook.`, sign],
          push: `The visit on ${when} is cancelled.`,
        },
        late: {
          subject: `${from} is running late`,
          lines: [`Hi ${first},`, `${from} is running about ${minutesLate ?? 30} minutes late for ${names} today. Sorry for the wait.`, sign],
          push: `Running about ${minutesLate ?? 30} minutes late today.`,
        },
        invoice: { subject: '', lines: [], push: '' },
      };
      const c = content[kind];
      if (client.email && emailEnabled()) {
        await sendEmail(client.email, c.subject, emailHtml(c.lines, c.button ? { label: c.button, url } : undefined), me?.email);
        emailed.push(client.full_name);
        await admin.from('client_messages').insert({ provider_id: userId, client_id: client.id, kind, channel: 'email', appointment_id: appt.id });
      } else noEmail.push(client.full_name);
      if (client.linked_user_id) pushed += await push([client.linked_user_id], c.subject, c.push, `/appointment/${appt.id}`);
    }
    return json({ emailed, noEmail, pushed, emailEnabled: emailEnabled() });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

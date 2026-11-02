// Daily reminder job. Called once a day by pg_cron (see supabase/migrations).
// Sends Expo push notifications and logs each one in `notifications`, which
// is also how it avoids sending the same reminder twice.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (provided by Supabase).
// The cron job sends the vault secret `cron_secret` in the x-cron-secret
// header, and check_cron_secret() compares it inside the database, so the
// secret only lives in the vault.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { emailEnabled, emailHtml, formatWindow as longWindow, money, sendEmail, SITE } from '../_shared/email.ts';

type Kind = 'due_soon' | 'appointment_proposed' | 'appointment_reminder' | 'invoice_unpaid';

type Reminder = {
  userId: string;
  kind: Kind;
  title: string;
  body: string;
  url: string;
  horseId?: string;
  appointmentId?: string;
  invoiceId?: string;
  /** Don't resend if the same reminder went out within this many days (0 = only ever once). */
  quietDays: number;
};

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const DAY = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function formatWindow(start: string, end: string | null, timeZone: string) {
  const opts: Intl.DateTimeFormatOptions = { timeZone, hour: 'numeric', minute: '2-digit' };
  const day = new Date(start).toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' });
  const from = new Date(start).toLocaleTimeString('en-US', opts);
  return end ? `${day}, ${from}–${new Date(end).toLocaleTimeString('en-US', opts)}` : `${day}, ${from}`;
}

async function check<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

async function collect(): Promise<Reminder[]> {
  const now = new Date();
  const today = isoDate(now);
  const inAWeek = isoDate(new Date(now.getTime() + 7 * DAY));
  const out: Reminder[] = [];

  // Horses with an upcoming scheduled visit don't need a "due" nudge.
  const upcoming = await check(
    db
      .from('appointments')
      .select('id, provider_id, scheduled_start, scheduled_end, owner_confirmed_at, appointment_horses(horse_id)')
      .eq('status', 'scheduled')
      .gte('scheduled_start', now.toISOString()),
  );
  const booked = new Set(upcoming.flatMap((a) => a.appointment_horses.map((h) => h.horse_id)));

  // 1. Due soon: a weekly digest for the farrier, and a nudge for each owner.
  const due = await check(
    db.from('due_horses').select('horse_id, provider_id, horse_name, next_due').lte('next_due', inAWeek),
  );
  const notBooked = due.filter((d) => d.horse_id && !booked.has(d.horse_id));
  const byFarrier = new Map<string, number>();
  for (const d of notBooked) byFarrier.set(d.provider_id!, (byFarrier.get(d.provider_id!) ?? 0) + 1);
  for (const [userId, n] of byFarrier) {
    out.push({
      userId,
      kind: 'due_soon',
      title: 'Horses coming due',
      body: `${n} ${n === 1 ? 'horse is' : 'horses are'} due in the next week and not booked yet.`,
      url: '/',
      quietDays: 7,
    });
  }
  const horseIds = notBooked.map((d) => d.horse_id!);
  if (horseIds.length) {
    const owners = await check(
      db.from('horse_owners').select('horse_id, user_id').in('horse_id', horseIds).not('user_id', 'is', null),
    );
    for (const o of owners) {
      const d = notBooked.find((x) => x.horse_id === o.horse_id)!;
      // A farrier's own horse is already in their digest.
      if (o.user_id === d.provider_id) continue;
      const overdue = d.next_due! < today;
      out.push({
        userId: o.user_id!,
        kind: 'due_soon',
        title: `${d.horse_name} is ${overdue ? 'overdue' : 'due soon'}`,
        body: overdue
          ? `${d.horse_name} is past due for the farrier. Tap to request a visit.`
          : `${d.horse_name} is due for the farrier in the next week. Tap to request a visit.`,
        url: `/horse/${o.horse_id}`,
        horseId: o.horse_id,
        quietDays: 21,
      });
    }
  }

  // 2. Owners: a new visit to confirm, and a reminder the day before.
  const apptHorseIds = [...new Set(upcoming.flatMap((a) => a.appointment_horses.map((h) => h.horse_id)))];
  const apptOwners = apptHorseIds.length
    ? await check(
        db
          .from('horse_owners')
          .select('horse_id, user_id, profiles!horse_owners_user_id_fkey(timezone)')
          .in('horse_id', apptHorseIds)
          .not('user_id', 'is', null),
      )
    : [];
  const tomorrowFrom = now.getTime() + 12 * 3_600_000;
  const tomorrowTo = now.getTime() + 36 * 3_600_000;
  for (const a of upcoming) {
    const horses = new Set(a.appointment_horses.map((h) => h.horse_id));
    const owners = new Map<string, string>();
    for (const o of apptOwners) {
      if (horses.has(o.horse_id) && o.user_id !== a.provider_id) {
        owners.set(o.user_id!, (o.profiles as unknown as { timezone: string } | null)?.timezone ?? 'America/Denver');
      }
    }
    const start = new Date(a.scheduled_start).getTime();
    for (const [userId, tz] of owners) {
      const when = formatWindow(a.scheduled_start, a.scheduled_end, tz);
      if (!a.owner_confirmed_at) {
        out.push({
          userId,
          kind: 'appointment_proposed',
          title: 'Farrier visit booked',
          body: `Your farrier is coming ${when}. Tap to confirm the time.`,
          url: `/appointment/${a.id}`,
          appointmentId: a.id,
          quietDays: 0,
        });
      }
      if (start >= tomorrowFrom && start < tomorrowTo) {
        out.push({
          userId,
          kind: 'appointment_reminder',
          title: 'Farrier visit tomorrow',
          body: `Your farrier is coming ${when}.`,
          url: `/appointment/${a.id}`,
          appointmentId: a.id,
          quietDays: 0,
        });
      }
    }
  }

  // 3. Owners on the app: invoices past their due date, at most weekly.
  const overdue = await check(
    db
      .from('invoices')
      .select('id, invoice_number, total_cents, amount_paid_cents, currency, clients(linked_user_id)')
      .in('status', ['sent', 'partially_paid'])
      .lt('due_date', today),
  );
  for (const inv of overdue) {
    const userId = (inv.clients as unknown as { linked_user_id: string | null } | null)?.linked_user_id;
    if (!userId) continue;
    const owing = new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency.toUpperCase() }).format(
      ((inv.total_cents ?? 0) - inv.amount_paid_cents) / 100,
    );
    out.push({
      userId,
      kind: 'invoice_unpaid',
      title: 'Invoice past due',
      body: `Invoice #${inv.invoice_number} has ${owing} still owing.`,
      url: `/invoice/${inv.id}`,
      invoiceId: inv.id,
      quietDays: 7,
    });
  }
  return out;
}

/** Drops reminders already sent recently, using the notifications log. */
async function unsent(reminders: Reminder[]): Promise<Reminder[]> {
  if (!reminders.length) return [];
  const users = [...new Set(reminders.map((r) => r.userId))];
  const since = new Date(Date.now() - 60 * DAY).toISOString();
  const log = await check(
    db
      .from('notifications')
      .select('user_id, kind, horse_id, appointment_id, invoice_id, sent_at')
      .in('user_id', users)
      .gte('sent_at', since),
  );
  return reminders.filter((r) => {
    const cutoff = r.quietDays ? Date.now() - r.quietDays * DAY : 0;
    return !log.some(
      (l) =>
        l.user_id === r.userId &&
        l.kind === r.kind &&
        (l.horse_id ?? undefined) === r.horseId &&
        (l.appointment_id ?? undefined) === r.appointmentId &&
        (l.invoice_id ?? undefined) === r.invoiceId &&
        new Date(l.sent_at).getTime() >= cutoff,
    );
  });
}

async function send(reminders: Reminder[]) {
  if (!reminders.length) return { sent: 0 };
  const tokens = await check(
    db.from('push_tokens').select('user_id, token').in('user_id', [...new Set(reminders.map((r) => r.userId))]),
  );
  const messages: { to: string; title: string; body: string; data: { url: string } }[] = [];
  const delivered: Reminder[] = [];
  for (const r of reminders) {
    const mine = tokens.filter((t) => t.user_id === r.userId);
    // No phone registered: skip without logging, so it goes out once they install the app.
    if (!mine.length) continue;
    for (const t of mine) messages.push({ to: t.token, title: r.title, body: r.body, data: { url: r.url } });
    delivered.push(r);
  }
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
    if (!res.ok) throw new Error(`Expo push failed: ${res.status} ${await res.text()}`);
  }
  if (delivered.length) {
    await check(
      db.from('notifications').insert(
        delivered.map((r) => ({
          user_id: r.userId,
          kind: r.kind,
          channel: 'push',
          horse_id: r.horseId ?? null,
          appointment_id: r.appointmentId ?? null,
          invoice_id: r.invoiceId ?? null,
        })),
      ),
    );
  }
  return { sent: delivered.length, messages: messages.length };
}

/**
 * Owners who aren't on the app can't get push, so they get email: the day
 * before a visit, and weekly for a past-due invoice. Logged in
 * client_messages so each goes out once (or once a week).
 */
async function emailClients() {
  if (!emailEnabled()) return { emailed: 0 };
  const now = Date.now();
  let emailed = 0;

  async function link(providerId: string, clientId: string, ref: { appointment_id?: string; invoice_id?: string }) {
    const col = ref.appointment_id ? 'appointment_id' : 'invoice_id';
    const { data: found } = await db.from('public_links').select('token').eq('client_id', clientId).eq(col, ref.appointment_id ?? ref.invoice_id!).maybeSingle();
    if (found) return `${SITE}/l/${found.token}`;
    const created = await check(db.from('public_links').insert({ provider_id: providerId, client_id: clientId, ...ref }).select('token').single());
    return `${SITE}/l/${(created as unknown as { token: string }).token}`;
  }
  async function already(clientId: string, kind: string, ref: { appointment_id?: string; invoice_id?: string }, sinceDays: number) {
    let q = db.from('client_messages').select('id').eq('client_id', clientId).eq('kind', kind).eq('channel', 'email');
    q = ref.appointment_id ? q.eq('appointment_id', ref.appointment_id) : q.eq('invoice_id', ref.invoice_id!);
    if (sinceDays) q = q.gte('sent_at', new Date(now - sinceDays * DAY).toISOString());
    const { data } = await q.limit(1);
    return !!data?.length;
  }

  // The day before a visit.
  const soon = await check(
    db
      .from('appointments')
      .select('id, provider_id, scheduled_start, scheduled_end, profiles!appointments_provider_id_fkey(full_name, business_name, email, phone, timezone), appointment_horses(horse_id, horses(name))')
      .eq('status', 'scheduled')
      .gte('scheduled_start', new Date(now + 12 * 3_600_000).toISOString())
      .lt('scheduled_start', new Date(now + 36 * 3_600_000).toISOString()),
  );
  for (const a of soon) {
    const p = a.profiles as unknown as { full_name: string; business_name: string | null; email: string | null; phone: string | null; timezone: string };
    const from = p.business_name || p.full_name;
    const owners = await check(
      db
        .from('horse_owners')
        .select('horse_id, clients!inner(id, full_name, email, linked_user_id, provider_id)')
        .in('horse_id', a.appointment_horses.map((h) => h.horse_id))
        .eq('clients.provider_id', a.provider_id),
    );
    const byClient = new Map<string, { name: string; email: string; horses: string[] }>();
    for (const o of owners) {
      const c = o.clients as unknown as { id: string; full_name: string; email: string | null; linked_user_id: string | null };
      // Owners on the app get the push reminder instead.
      if (!c.email || c.linked_user_id) continue;
      const horse = (a.appointment_horses.find((h) => h.horse_id === o.horse_id)?.horses as unknown as { name: string } | null)?.name;
      const e = byClient.get(c.id) ?? { name: c.full_name, email: c.email, horses: [] };
      if (horse) e.horses.push(horse);
      byClient.set(c.id, e);
    }
    for (const [clientId, c] of byClient) {
      if (await already(clientId, 'visit_tomorrow', { appointment_id: a.id }, 0)) continue;
      const url = await link(a.provider_id, clientId, { appointment_id: a.id });
      await sendEmail(
        c.email,
        `Farrier visit tomorrow: ${longWindow(a.scheduled_start, a.scheduled_end, p.timezone)}`,
        emailHtml(
          [`Hi ${c.name.split(' ')[0]},`, `A reminder that ${from} is coming for ${c.horses.join(' and ') || 'your horses'} ${longWindow(a.scheduled_start, a.scheduled_end, p.timezone)}.`, p.phone ? `${from} · ${p.phone}` : from],
          { label: 'See the visit', url },
        ),
        p.email,
      );
      await db.from('client_messages').insert({ provider_id: a.provider_id, client_id: clientId, kind: 'visit_tomorrow', channel: 'email', appointment_id: a.id });
      emailed++;
    }
  }

  // Past-due invoices, at most weekly.
  const overdue = await check(
    db
      .from('invoices')
      .select('id, provider_id, invoice_number, total_cents, amount_paid_cents, currency, client_id, clients(full_name, email, linked_user_id), profiles!invoices_provider_id_fkey(full_name, business_name, email)')
      .in('status', ['sent', 'partially_paid'])
      .lt('due_date', isoDate(new Date())),
  );
  for (const inv of overdue) {
    const c = inv.clients as unknown as { full_name: string; email: string | null; linked_user_id: string | null } | null;
    const p = inv.profiles as unknown as { full_name: string; business_name: string | null; email: string | null };
    if (!c?.email || c.linked_user_id) continue;
    if (await already(inv.client_id, 'invoice_overdue', { invoice_id: inv.id }, 7)) continue;
    const url = await link(inv.provider_id, inv.client_id, { invoice_id: inv.id });
    const owing = money((inv.total_cents ?? 0) - inv.amount_paid_cents, inv.currency);
    const from = p.business_name || p.full_name;
    await sendEmail(
      c.email,
      `Reminder: invoice #${inv.invoice_number} from ${from} (${owing})`,
      emailHtml([`Hi ${c.full_name.split(' ')[0]},`, `Invoice #${inv.invoice_number} from ${from} still has ${owing} owing.`, from], { label: 'View and pay', url }),
      p.email,
    );
    await db.from('client_messages').insert({ provider_id: inv.provider_id, client_id: inv.client_id, kind: 'invoice_overdue', channel: 'email', invoice_id: inv.id });
    emailed++;
  }
  return { emailed };
}

Deno.serve(async (req) => {
  const { data: allowed } = await db.rpc('check_cron_secret', {
    p_secret: req.headers.get('x-cron-secret') ?? '',
  });
  if (allowed !== true) return new Response('forbidden', { status: 403 });
  try {
    const result = await send(await unsent(await collect()));
    const email = await emailClients();
    return Response.json({ ...result, ...email });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});

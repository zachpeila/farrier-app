// Tells the other side when a request is sent, answered or cancelled.
//
// Called by a database trigger (see the request_notifications migration)
// whenever a visit request or client request is created or changes status.
// The trigger sends the vault secret `cron_secret` in the x-cron-secret
// header, the same way the daily reminder job does.
//
//   visit request:  received -> farrier, accepted/declined -> owner, cancelled -> farrier
//   client request: received -> farrier, accepted/declined -> owner

import { createClient } from 'npm:@supabase/supabase-js@2';

import { emailEnabled, emailHtml, sendEmail, SITE } from '../_shared/email.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

type Kind =
  | 'visit_request_received'
  | 'visit_request_accepted'
  | 'visit_request_declined'
  | 'visit_request_cancelled'
  | 'client_request_received'
  | 'client_request_accepted'
  | 'client_request_declined';

type Person = { full_name: string | null; business_name: string | null; email: string | null };

type Message = {
  userId: string;
  horseId: string;
  title: string;
  body: string;
  /** Screen in the app the push opens. */
  url: string;
  /** Email paragraphs (greeting and sign-off added here). */
  lines: string[];
  button: string;
  replyTo: string | null;
};

const nameOf = (p: Person | null, fallback: string) => p?.business_name || p?.full_name || fallback;
const firstName = (p: Person | null) => (p?.full_name ?? '').split(' ')[0] || 'there';

async function person(id: string): Promise<Person | null> {
  const { data } = await admin.from('profiles').select('full_name, business_name, email').eq('id', id).maybeSingle();
  return data;
}

async function horseName(id: string) {
  const { data } = await admin.from('horses').select('name').eq('id', id).maybeSingle();
  return data?.name ?? 'your horse';
}

async function visitMessage(id: string, kind: Kind): Promise<Message | null> {
  const { data: r } = await admin
    .from('visit_requests')
    .select('horse_id, requested_by, requested_provider_id, urgency, notes, decline_reason, preferred_start, preferred_end')
    .eq('id', id)
    .maybeSingle();
  if (!r) return null;
  const [owner, farrier, horse] = await Promise.all([person(r.requested_by), person(r.requested_provider_id), horseName(r.horse_id)]);
  const ownerName = owner?.full_name || 'An owner';
  const farrierName = nameOf(farrier, 'Your farrier');
  const urgent = r.urgency === 'urgent';
  const when =
    r.preferred_start && r.preferred_end
      ? `between ${r.preferred_start} and ${r.preferred_end}`
      : r.preferred_start
        ? `from ${r.preferred_start}`
        : null;

  switch (kind) {
    case 'visit_request_received':
      return {
        userId: r.requested_provider_id,
        horseId: r.horse_id,
        title: urgent ? `Urgent visit request for ${horse}` : `Visit request for ${horse}`,
        body: `${ownerName} asked for a visit${when ? ` ${when}` : ''}.${r.notes ? ` "${r.notes}"` : ''}`,
        url: '/schedule',
        lines: [
          `${ownerName} asked you to come out for ${horse}${when ? ` ${when}` : ''}.${urgent ? ' They marked it urgent.' : ''}`,
          ...(r.notes ? [`Their note: "${r.notes}"`] : []),
          'Open Hammer & Hoof to book a time or decline.',
        ],
        button: 'View request',
        replyTo: owner?.email ?? null,
      };
    case 'visit_request_accepted':
      return {
        userId: r.requested_by,
        horseId: r.horse_id,
        title: `${farrierName} accepted your request`,
        body: `${farrierName} will book a time for ${horse}.`,
        url: '/schedule',
        lines: [`${farrierName} accepted your visit request for ${horse}. You'll get the date and time once it's booked.`],
        button: 'Open the app',
        replyTo: farrier?.email ?? null,
      };
    case 'visit_request_declined':
      return {
        userId: r.requested_by,
        horseId: r.horse_id,
        title: `${farrierName} can't make it`,
        body: r.decline_reason ? `Request for ${horse} declined: ${r.decline_reason}` : `Your request for ${horse} was declined.`,
        url: '/schedule',
        lines: [
          `${farrierName} can't take the visit for ${horse} this time.`,
          ...(r.decline_reason ? [`Their note: "${r.decline_reason}"`] : []),
          'You can ask again later, or find another farrier near you in the app.',
        ],
        button: 'Open the app',
        replyTo: farrier?.email ?? null,
      };
    case 'visit_request_cancelled':
      return {
        userId: r.requested_provider_id,
        horseId: r.horse_id,
        title: `Visit request cancelled`,
        body: `${ownerName} cancelled the request for ${horse}.`,
        url: '/schedule',
        lines: [`${ownerName} cancelled their visit request for ${horse}. If you had booked it, that visit was cancelled too.`],
        button: 'Open your schedule',
        replyTo: owner?.email ?? null,
      };
    default:
      return null;
  }
}

async function clientMessage(id: string, kind: Kind): Promise<Message | null> {
  const { data: r } = await admin
    .from('client_requests')
    .select('horse_id, owner_id, provider_id, message')
    .eq('id', id)
    .maybeSingle();
  if (!r) return null;
  const [owner, farrier, horse] = await Promise.all([person(r.owner_id), person(r.provider_id), horseName(r.horse_id)]);
  const ownerName = owner?.full_name || 'An owner';
  const farrierName = nameOf(farrier, 'The farrier');

  switch (kind) {
    case 'client_request_received':
      return {
        userId: r.provider_id,
        horseId: r.horse_id,
        title: 'New client request',
        body: `${ownerName} found you on Hammer & Hoof and wants you for ${horse}.`,
        url: '/schedule',
        lines: [
          `${ownerName} found you in Find a farrier and would like you to take on ${horse}.`,
          ...(r.message ? [`Their note: "${r.message}"`] : []),
          'Open Hammer & Hoof to accept or decline.',
        ],
        button: 'View request',
        replyTo: owner?.email ?? null,
      };
    case 'client_request_accepted':
      return {
        userId: r.owner_id,
        horseId: r.horse_id,
        title: `${farrierName} is your farrier now`,
        body: `${farrierName} took on ${horse}. You can request visits any time.`,
        url: `/horse/${r.horse_id}`,
        lines: [`${farrierName} accepted you as a client for ${horse}. You can request a visit from the app whenever you need one.`],
        button: 'Open the app',
        replyTo: farrier?.email ?? null,
      };
    case 'client_request_declined':
      return {
        userId: r.owner_id,
        horseId: r.horse_id,
        title: `${farrierName} isn't taking ${horse}`,
        body: 'They declined this time. Tap to find another farrier near you.',
        url: '/find',
        lines: [`${farrierName} can't take on ${horse} right now.`, 'There may be other farriers near you in Find a farrier.'],
        button: 'Find a farrier',
        replyTo: farrier?.email ?? null,
      };
    default:
      return null;
  }
}

async function deliver(kind: Kind, m: Message) {
  let pushed = 0;
  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', m.userId);
  if (tokens?.length) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(tokens.map((t) => ({ to: t.token, title: m.title, body: m.body, sound: 'default', data: { url: m.url } }))),
    });
    if (res.ok) {
      pushed = tokens.length;
      await admin.from('notifications').insert({ user_id: m.userId, kind, channel: 'push', horse_id: m.horseId });
    } else console.error('push failed', res.status, await res.text());
  }

  let emailed = false;
  const to = await person(m.userId);
  if (to?.email && emailEnabled()) {
    try {
      await sendEmail(
        to.email,
        m.title,
        emailHtml([`Hi ${firstName(to)},`, ...m.lines], { label: m.button, url: `${SITE}${m.url}` }),
        m.replyTo,
      );
      emailed = true;
      await admin.from('notifications').insert({ user_id: m.userId, kind, channel: 'email', horse_id: m.horseId });
    } catch (e) {
      console.error(e);
    }
  }
  return { pushed, emailed };
}

Deno.serve(async (req) => {
  const { data: allowed } = await admin.rpc('check_cron_secret', { p_secret: req.headers.get('x-cron-secret') ?? '' });
  if (allowed !== true) return new Response('forbidden', { status: 403 });

  try {
    const { table, id, kind } = (await req.json()) as { table: string; id: string; kind: Kind };
    const message =
      table === 'visit_requests' ? await visitMessage(id, kind) : table === 'client_requests' ? await clientMessage(id, kind) : null;
    if (!message) return Response.json({ skipped: true });
    return Response.json(await deliver(kind, message));
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
});

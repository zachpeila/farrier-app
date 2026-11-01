// The page behind a link texted or emailed to an owner who isn't on the
// app: see a booked visit and confirm it, ask for another time, or leave a
// note for a horse; or see an invoice and pay it by card.
//
// No sign-in: the unguessable token in the link is the permission, and it
// only ever shows that one client's horses and invoice.

import { CheckoutError, invoiceCheckoutUrl } from '../_shared/checkout.ts';
import { admin, cors, json } from '../_shared/stripe.ts';

const SITE = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://farrier-app.vercel.app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Link = { token: string; provider_id: string; client_id: string; appointment_id: string | null; invoice_id: string | null };

async function farrier(providerId: string) {
  const { data } = await admin
    .from('profiles')
    .select('full_name, business_name, phone, email, timezone, stripe_charges_enabled')
    .eq('id', providerId)
    .single();
  return {
    name: data?.business_name || data?.full_name || 'Your farrier',
    phone: data?.phone ?? null,
    email: data?.email ?? null,
    timezone: data?.timezone ?? 'America/Denver',
    takesCards: !!data?.stripe_charges_enabled,
  };
}

/** The client's horses on this visit (other owners' horses at the barn stay private). */
async function clientHorseIds(clientId: string) {
  const { data } = await admin.from('horse_owners').select('horse_id').eq('client_id', clientId);
  return new Set((data ?? []).map((h) => h.horse_id));
}

async function viewVisit(link: Link) {
  const { data: a, error } = await admin
    .from('appointments')
    .select(
      `id, status, scheduled_start, scheduled_end, owner_confirmed_at, owner_change_request, notes,
       locations(name, address), appointment_horses(horse_id, owner_note, horses(name))`,
    )
    .eq('id', link.appointment_id!)
    .single();
  if (error || !a) return null;
  const mine = await clientHorseIds(link.client_id);
  return {
    kind: 'visit' as const,
    farrier: await farrier(link.provider_id),
    visit: {
      status: a.status,
      start: a.scheduled_start,
      end: a.scheduled_end,
      confirmed: !!a.owner_confirmed_at,
      changeRequest: a.owner_change_request,
      notes: a.notes,
      barn: a.locations,
      horses: a.appointment_horses
        .filter((h) => mine.has(h.horse_id))
        .map((h) => ({ id: h.horse_id, name: (h.horses as unknown as { name: string } | null)?.name ?? 'Horse', note: h.owner_note })),
    },
  };
}

async function viewInvoice(link: Link) {
  const { data: inv, error } = await admin
    .from('invoices')
    .select(
      `id, invoice_number, status, subtotal_cents, tax_breakdown, total_cents, amount_paid_cents, currency,
       due_date, notes, sent_at, created_at, clients(full_name),
       invoice_line_items(description, quantity, unit_price_cents, amount_cents, sort_order)`,
    )
    .eq('id', link.invoice_id!)
    .single();
  if (error || !inv) return null;
  // Drafts aren't the client's to see yet.
  if (inv.status === 'draft') return null;
  return {
    kind: 'invoice' as const,
    farrier: await farrier(link.provider_id),
    invoice: {
      ...inv,
      invoice_line_items: [...inv.invoice_line_items].sort((a, b) => a.sort_order - b.sort_order),
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? '');
    if (!UUID.test(token)) return json({ error: 'This link is not valid.' }, 404);
    const { data: link } = await admin.from('public_links').select('*').eq('token', token).maybeSingle();
    if (!link) return json({ error: 'This link is not valid or has expired.' }, 404);

    const action = String(body.action ?? 'view');

    if (link.appointment_id) {
      if (action === 'confirm') {
        await admin
          .from('appointments')
          .update({ owner_confirmed_at: new Date().toISOString(), owner_change_request: null, owner_change_requested_at: null })
          .eq('id', link.appointment_id)
          .eq('status', 'scheduled');
      } else if (action === 'change') {
        const message = String(body.message ?? '').trim().slice(0, 500);
        if (!message) return json({ error: 'Say which days or times work for you.' }, 400);
        await admin
          .from('appointments')
          .update({ owner_change_request: message, owner_change_requested_at: new Date().toISOString(), owner_confirmed_at: null })
          .eq('id', link.appointment_id)
          .eq('status', 'scheduled');
        // Let the farrier know right away.
        const [{ data: tokens }, { data: client }] = await Promise.all([
          admin.from('push_tokens').select('token').eq('user_id', link.provider_id),
          admin.from('clients').select('full_name').eq('id', link.client_id).single(),
        ]);
        if (tokens?.length) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(
              tokens.map((t) => ({
                to: t.token,
                title: `${client?.full_name ?? 'An owner'} asked for a different time`,
                body: message,
                data: { url: `/appointment/${link.appointment_id}` },
              })),
            ),
          }).catch(() => {});
        }
      } else if (action === 'note') {
        const horseId = String(body.horseId ?? '');
        if (!(await clientHorseIds(link.client_id)).has(horseId)) return json({ error: 'horse not found' }, 404);
        await admin
          .from('appointment_horses')
          .update({ owner_note: String(body.note ?? '').trim().slice(0, 1000) || null })
          .eq('appointment_id', link.appointment_id)
          .eq('horse_id', horseId);
      } else if (action !== 'view') {
        return json({ error: 'unknown action' }, 400);
      }
      const view = await viewVisit(link);
      return view ? json(view) : json({ error: 'This visit is no longer available.' }, 404);
    }

    if (action === 'pay') {
      const url = await invoiceCheckoutUrl(link.invoice_id!, {
        successUrl: `${SITE}/l/${token}?paid=1`,
        cancelUrl: `${SITE}/l/${token}`,
      });
      return json({ url });
    }
    if (action !== 'view') return json({ error: 'unknown action' }, 400);
    const view = await viewInvoice(link);
    return view ? json(view) : json({ error: 'This invoice is not available.' }, 404);
  } catch (e) {
    if (e instanceof CheckoutError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});

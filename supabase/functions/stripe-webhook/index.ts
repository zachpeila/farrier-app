// Stripe calls this. Records card payments against invoices and keeps each
// farrier's Stripe status current. Every event is stored once in
// stripe_webhook_events, so Stripe's retries are ignored.

import Stripe from 'npm:stripe@17';

import { admin, stripe } from '../_shared/stripe.ts';

const crypto = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      crypto,
    );
  } catch {
    return new Response('bad signature', { status: 400 });
  }

  // Claim the event first; a duplicate insert means it was already handled.
  const { error: dup } = await admin
    .from('stripe_webhook_events')
    .insert({ id: event.id, type: event.type, payload: event as unknown as Record<string, unknown> });
  if (dup) return new Response('already handled', { status: 200 });

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;
      if (invoiceId && session.payment_status === 'paid') {
        const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
        const intent = pi ? await stripe.paymentIntents.retrieve(pi) : null;
        const charge = typeof intent?.latest_charge === 'string' ? intent.latest_charge : intent?.latest_charge?.id;
        const { error } = await admin.from('payments').insert({
          invoice_id: invoiceId,
          amount_cents: session.amount_total ?? 0,
          method: 'card',
          status: 'succeeded',
          stripe_payment_intent_id: pi ?? null,
          stripe_charge_id: charge ?? null,
          application_fee_cents: intent?.application_fee_amount ?? null,
        });
        if (error) throw error;
        await admin.from('invoices').update({ stripe_payment_intent_id: pi ?? null }).eq('id', invoiceId);
      }
    } else if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      await admin
        .from('profiles')
        .update({ stripe_charges_enabled: account.charges_enabled, stripe_payouts_enabled: account.payouts_enabled })
        .eq('stripe_account_id', account.id);
    }
    return new Response('ok');
  } catch (e) {
    console.error(e);
    // Let Stripe retry: forget the event so the retry is processed.
    await admin.from('stripe_webhook_events').delete().eq('id', event.id);
    return new Response('error', { status: 500 });
  }
});

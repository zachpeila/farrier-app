// Owner (or the farrier, handing over their phone) pays an invoice by card.
// Creates a Stripe Checkout page for what's still owing. The money goes to
// the farrier's Stripe account; the webhook records the payment.

import { admin, callerId, cors, json, returnUrl, stripe } from '../_shared/stripe.ts';

/** Platform fee in basis points (100 = 1%). 0 for now. */
const FEE_BP = Number(Deno.env.get('PLATFORM_FEE_BP') ?? '0');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const userId = await callerId(req);
  if (!userId) return json({ error: 'not signed in' }, 401);

  try {
    const { invoiceId } = await req.json();
    const { data: inv, error } = await admin
      .from('invoices')
      .select(
        `id, invoice_number, status, total_cents, amount_paid_cents, currency, provider_id,
         clients(linked_user_id), profiles!invoices_provider_id_fkey(stripe_account_id, stripe_charges_enabled, business_name, full_name)`,
      )
      .eq('id', invoiceId)
      .single();
    if (error || !inv) return json({ error: 'invoice not found' }, 404);

    const client = inv.clients as unknown as { linked_user_id: string | null } | null;
    const farrier = inv.profiles as unknown as {
      stripe_account_id: string | null;
      stripe_charges_enabled: boolean;
      business_name: string | null;
      full_name: string;
    };
    // Same visibility as the app: the farrier, or the client it was sent to.
    if (userId !== inv.provider_id && userId !== client?.linked_user_id) {
      return json({ error: 'invoice not found' }, 404);
    }
    if (inv.status !== 'sent' && inv.status !== 'partially_paid') {
      return json({ error: `invoice is ${inv.status}` }, 400);
    }
    if (!farrier.stripe_account_id || !farrier.stripe_charges_enabled) {
      return json({ error: 'This farrier does not take card payments yet.' }, 400);
    }

    const owing = (inv.total_cents ?? 0) - inv.amount_paid_cents;
    if (owing <= 0) return json({ error: 'nothing owing' }, 400);
    const name = farrier.business_name || farrier.full_name || 'Farrier';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: inv.currency,
            unit_amount: owing,
            product_data: { name: `Invoice #${inv.invoice_number} — ${name}` },
          },
        },
      ],
      payment_intent_data: {
        on_behalf_of: farrier.stripe_account_id,
        transfer_data: { destination: farrier.stripe_account_id },
        application_fee_amount: FEE_BP ? Math.round((owing * FEE_BP) / 10000) : undefined,
        metadata: { invoice_id: inv.id },
      },
      metadata: { invoice_id: inv.id },
      success_url: returnUrl('paid'),
      cancel_url: returnUrl('cancelled'),
    });
    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

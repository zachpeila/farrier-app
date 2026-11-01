// Owner (or the farrier, handing over their phone) pays an invoice by card.
// Creates a Stripe Checkout page for what's still owing. The money goes to
// the farrier's Stripe account; the webhook records the payment.

import { CheckoutError, invoiceCheckoutUrl } from '../_shared/checkout.ts';
import { admin, callerId, cors, json } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const userId = await callerId(req);
  if (!userId) return json({ error: 'not signed in' }, 401);

  try {
    const { invoiceId } = await req.json();
    const { data: inv } = await admin
      .from('invoices')
      .select('provider_id, clients(linked_user_id)')
      .eq('id', invoiceId)
      .maybeSingle();
    const client = inv?.clients as unknown as { linked_user_id: string | null } | null;
    // Same visibility as the app: the farrier, or the client it was sent to.
    if (!inv || (userId !== inv.provider_id && userId !== client?.linked_user_id)) {
      return json({ error: 'invoice not found' }, 404);
    }
    return json({ url: await invoiceCheckoutUrl(invoiceId) });
  } catch (e) {
    if (e instanceof CheckoutError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

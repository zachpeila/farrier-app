import { admin, returnUrl, stripe } from './stripe.ts';

/** Platform fee in basis points (100 = 1%). 0 for now. */
const FEE_BP = Number(Deno.env.get('PLATFORM_FEE_BP') ?? '0');

export class CheckoutError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/**
 * A Stripe Checkout page for what's still owing on an invoice. The money is
 * a destination charge to the farrier's account; the webhook records it.
 * Callers check who is allowed to pay before calling this.
 */
export async function invoiceCheckoutUrl(invoiceId: string, opts: { successUrl?: string; cancelUrl?: string } = {}) {
  const { data: inv, error } = await admin
    .from('invoices')
    .select(
      `id, invoice_number, status, total_cents, amount_paid_cents, currency, provider_id,
       profiles!invoices_provider_id_fkey(stripe_account_id, stripe_charges_enabled, business_name, full_name)`,
    )
    .eq('id', invoiceId)
    .single();
  if (error || !inv) throw new CheckoutError('invoice not found', 404);
  const farrier = inv.profiles as unknown as {
    stripe_account_id: string | null;
    stripe_charges_enabled: boolean;
    business_name: string | null;
    full_name: string;
  };
  if (inv.status !== 'sent' && inv.status !== 'partially_paid') throw new CheckoutError(`invoice is ${inv.status}`);
  if (!farrier.stripe_account_id || !farrier.stripe_charges_enabled) {
    throw new CheckoutError('This farrier does not take card payments yet.');
  }
  const owing = (inv.total_cents ?? 0) - inv.amount_paid_cents;
  if (owing <= 0) throw new CheckoutError('nothing owing');
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
    success_url: opts.successUrl ?? returnUrl('paid'),
    cancel_url: opts.cancelUrl ?? returnUrl('cancelled'),
  });
  return session.url!;
}

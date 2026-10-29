// Farrier sets up card payments: creates their Stripe Express account the
// first time, refreshes its status, and returns an onboarding link while
// Stripe still needs details from them.

import { admin, callerId, cors, json, returnUrl, stripe } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const userId = await callerId(req);
  if (!userId) return json({ error: 'not signed in' }, 401);

  try {
    const { data: profile, error } = await admin
      .from('profiles')
      .select('id, email, country, business_name, full_name, stripe_account_id')
      .eq('id', userId)
      .single();
    if (error) throw error;

    let accountId = profile.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: profile.country,
        email: profile.email ?? undefined,
        business_profile: { name: profile.business_name || profile.full_name || undefined },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { profile_id: userId },
      });
      accountId = account.id;
    }

    const account = await stripe.accounts.retrieve(accountId);
    await admin
      .from('profiles')
      .update({
        stripe_account_id: accountId,
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
      })
      .eq('id', userId);

    if (account.charges_enabled && account.details_submitted) {
      const login = await stripe.accounts.createLoginLink(accountId);
      return json({ ready: true, dashboardUrl: login.url });
    }
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: returnUrl('onboarding-retry'),
      return_url: returnUrl('onboarding'),
    });
    return json({ ready: false, onboardingUrl: link.url });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

/** Calls one of our Edge Functions and returns its JSON, throwing its error message. */
async function call<T>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body ?? {} });
  if (error) {
    // Our functions answer errors as { error: "..." }; surface that text.
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data as T;
}

/**
 * Opens Stripe so the farrier can finish setting up card payments, or their
 * Stripe dashboard once they're set up. Resolves when the browser closes.
 */
export async function openCardSetup() {
  const res = await call<{ ready: boolean; onboardingUrl?: string; dashboardUrl?: string }>('stripe-connect');
  const url = res.onboardingUrl ?? res.dashboardUrl;
  if (url) await WebBrowser.openBrowserAsync(url);
  return res.ready;
}

/** Opens Stripe Checkout for what's owing on an invoice. Resolves when the browser closes. */
export async function payInvoiceByCard(invoiceId: string) {
  const { url } = await call<{ url: string }>('invoice-checkout', { invoiceId });
  await WebBrowser.openBrowserAsync(url);
}

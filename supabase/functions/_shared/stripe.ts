import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
});

/** Service-role client: bypasses RLS, so only use it after checking who's asking. */
export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

/** The signed-in user who called the function, from their Authorization header. */
export async function callerId(req: Request): Promise<string | null> {
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data.user?.id ?? null;
}

/** Plain page Stripe sends people back to; they then return to the app. */
export function returnUrl(kind: string) {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-return?kind=${kind}`;
}

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: cors });
}

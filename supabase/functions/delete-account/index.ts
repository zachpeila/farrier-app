// Deletes the caller's account and the data that belongs only to them.
// App stores require that people can do this from inside the app.
//
// Most tables cascade from profiles. Invoices and payments don't (they
// block deletes so money records aren't lost by accident), so a farrier's
// invoices and payments are removed here first. Horses stay when someone
// else still keeps records for them.

import { admin, callerId, cors, json } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const userId = await callerId(req);
  if (!userId) return json({ error: 'not signed in' }, 401);

  try {
    // Photos of this person's visits live in storage, outside the cascade.
    const { data: photos } = await admin
      .from('visit_photos')
      .select('storage_path, visits!inner(provider_id)')
      .eq('visits.provider_id', userId);
    const paths = (photos ?? []).map((p) => p.storage_path);
    for (let i = 0; i < paths.length; i += 100) {
      await admin.storage.from('visit-photos').remove(paths.slice(i, i + 100));
    }

    const { data: invoices, error: invError } = await admin.from('invoices').select('id').eq('provider_id', userId);
    if (invError) throw invError;
    const invoiceIds = (invoices ?? []).map((i) => i.id);
    if (invoiceIds.length) {
      const { error: payError } = await admin.from('payments').delete().in('invoice_id', invoiceIds);
      if (payError) throw payError;
      const { error: delError } = await admin.from('invoices').delete().in('id', invoiceIds);
      if (delError) throw delError;
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    return json({ deleted: true });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

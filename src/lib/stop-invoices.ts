import type { TablesInsert } from './database.types';
import { listPending } from './outbox';
import { fetchBillingSettings } from './queries';
import { supabase } from './supabase';

export type StopHorse = {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  /** The visit logged for this horse at this stop, if any. */
  visit: { id: string; workType: string | null; uploaded: boolean } | null;
};

export type StopInvoice = {
  id: string;
  invoice_number: number | null;
  status: string;
  total_cents: number | null;
  currency: string;
  client_id: string;
};

/** Everything the Finish stop screen needs: each horse, who owns it, what was logged, and invoices made so far. */
export async function loadStop(appointmentId: string, userId: string) {
  const [horses, visits, invoices, pending] = await Promise.all([
    supabase
      .from('appointment_horses')
      .select('horse_id, horses(id, name, horse_owners(client_id, clients(id, full_name)))')
      .eq('appointment_id', appointmentId),
    supabase
      .from('visits')
      .select('id, horse_id, work_type')
      .eq('appointment_id', appointmentId)
      .eq('provider_id', userId),
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total_cents, currency, client_id')
      .eq('appointment_id', appointmentId)
      .neq('status', 'void'),
    listPending(),
  ]);
  if (horses.error) throw horses.error;
  if (visits.error) throw visits.error;
  if (invoices.error) throw invoices.error;

  const stopHorses: StopHorse[] = (horses.data ?? []).map((ah) => {
    const owner = ah.horses?.horse_owners.find((o) => o.client_id) ?? null;
    const local = pending.find((p) => p.visit.appointment_id === appointmentId && p.visit.horse_id === ah.horse_id);
    const saved = (visits.data ?? []).find((v) => v.horse_id === ah.horse_id);
    return {
      id: ah.horse_id,
      name: ah.horses?.name ?? 'Horse',
      clientId: owner?.client_id ?? null,
      clientName: owner?.clients?.full_name ?? null,
      visit: local
        ? { id: local.visit.id, workType: local.visit.work_type ?? null, uploaded: false }
        : saved
          ? { id: saved.id, workType: saved.work_type, uploaded: true }
          : null,
    };
  });
  return { horses: stopHorses, invoices: (invoices.data ?? []) as StopInvoice[] };
}

/**
 * Makes one draft invoice per owner at the stop who doesn't have one yet:
 * a line per horse priced from its logged work, plus their share of the
 * trip fee (split evenly between the owners at the stop).
 */
export async function createStopInvoices(appointmentId: string, userId: string, tripFeeCents: number) {
  const [{ horses, invoices }, billing] = await Promise.all([
    loadStop(appointmentId, userId),
    fetchBillingSettings(userId),
  ]);
  const services = billing.services.filter((s) => s.active);
  // Only owners whose horses were actually worked on get billed.
  const clients = [...new Set(horses.filter((h) => h.visit).map((h) => h.clientId).filter((c): c is string => !!c))];
  const todo = clients.filter((c) => !invoices.some((i) => i.client_id === c));

  const share = clients.length ? Math.floor(tripFeeCents / clients.length) : 0;
  const remainder = tripFeeCents - share * clients.length;

  for (const clientId of todo) {
    const insert = { provider_id: userId, client_id: clientId, appointment_id: appointmentId } as TablesInsert<'invoices'>;
    const { data: inv, error } = await supabase.from('invoices').insert(insert).select('id').single();
    if (error) throw error;

    const rows: TablesInsert<'invoice_line_items'>[] = horses
      .filter((h) => h.clientId === clientId && h.visit)
      .map((h) => {
        const service = services.find((s) => s.work_type === h.visit!.workType);
        return {
          invoice_id: inv.id,
          description: service ? `${h.name} — ${service.name}` : h.name,
          quantity: 1,
          unit_price_cents: service?.price_cents ?? 0,
          taxable: service?.taxable ?? true,
          horse_id: h.id,
          // A visit still waiting to upload can't be linked yet.
          visit_id: h.visit!.uploaded ? h.visit!.id : null,
        };
      });
    const fee = share + (clientId === clients[0] ? remainder : 0);
    if (fee > 0) {
      rows.push({
        invoice_id: inv.id,
        description: clients.length > 1 ? `Trip fee (shared by ${clients.length} owners)` : 'Trip fee',
        quantity: 1,
        unit_price_cents: fee,
        taxable: true,
      });
    }
    if (rows.length) {
      const { error: linesError } = await supabase
        .from('invoice_line_items')
        .insert(rows.map((r, i) => ({ ...r, sort_order: i })));
      if (linesError) throw linesError;
    }
  }
}

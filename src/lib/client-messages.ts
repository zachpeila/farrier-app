import * as SMS from 'expo-sms';
import { Linking, Platform } from 'react-native';

import { formatMoney } from './money';
import { callFunction } from './payments';
import { formatWindow } from './schedule';
import { supabase } from './supabase';

/**
 * Reaching owners, including the many who never install the app. Each owner
 * gets their own link (to confirm a visit or pay an invoice) that works in
 * any browser. Texts go from the farrier's own phone, so owners see a
 * number they know; emails go from the server.
 */

export type MessageKind = 'booked' | 'changed' | 'cancelled' | 'invoice' | 'late';
export type Target = { appointmentId: string } | { invoiceId: string };

export const PUBLIC_SITE = 'https://farrier-app.vercel.app';

type Recipient = { clientId: string; name: string; phone: string | null; message: string };

function day(start: string) {
  return new Date(start).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

async function link(clientId: string, target: Target) {
  const { data, error } = await supabase.rpc('client_link', {
    p_client: clientId,
    ...('appointmentId' in target ? { p_appointment: target.appointmentId } : { p_invoice: target.invoiceId }),
  });
  if (error) throw error;
  return `${PUBLIC_SITE}/l/${data}`;
}

/** One text per owner, each with their own link. */
export async function buildTexts(kind: MessageKind, target: Target, from: string, minutesLate = 30): Promise<Recipient[]> {
  if ('invoiceId' in target) {
    const { data: inv, error } = await supabase
      .from('invoices')
      .select('invoice_number, total_cents, amount_paid_cents, currency, client_id, clients(full_name, phone)')
      .eq('id', target.invoiceId)
      .single();
    if (error) throw error;
    const url = await link(inv.client_id, target);
    const owing = formatMoney((inv.total_cents ?? 0) - inv.amount_paid_cents, inv.currency);
    const first = inv.clients?.full_name.split(' ')[0] ?? '';
    return [
      {
        clientId: inv.client_id,
        name: inv.clients?.full_name ?? 'Client',
        phone: inv.clients?.phone ?? null,
        message: `Hi ${first}, here's invoice #${inv.invoice_number} from ${from} for ${owing}. View and pay: ${url}`,
      },
    ];
  }

  const { data: appt, error } = await supabase
    .from('appointments')
    .select('id, provider_id, scheduled_start, scheduled_end, locations(name), appointment_horses(horse_id, horses(name))')
    .eq('id', target.appointmentId)
    .single();
  if (error) throw error;
  const { data: owners, error: ownersError } = await supabase
    .from('horse_owners')
    .select('horse_id, clients!inner(id, full_name, phone, provider_id)')
    .in('horse_id', appt.appointment_horses.map((h) => h.horse_id))
    .eq('clients.provider_id', appt.provider_id);
  if (ownersError) throw ownersError;

  const byClient = new Map<string, { name: string; phone: string | null; horses: string[] }>();
  for (const o of owners ?? []) {
    const c = o.clients;
    const horse = appt.appointment_horses.find((h) => h.horse_id === o.horse_id)?.horses?.name;
    const entry = byClient.get(c.id) ?? { name: c.full_name, phone: c.phone, horses: [] };
    if (horse) entry.horses.push(horse);
    byClient.set(c.id, entry);
  }

  const when = `${day(appt.scheduled_start)}, ${formatWindow(appt.scheduled_start, appt.scheduled_end)}`;
  const out: Recipient[] = [];
  for (const [clientId, c] of byClient) {
    const first = c.name.split(' ')[0];
    const horses = c.horses.join(' and ') || 'your horses';
    const url = kind === 'booked' || kind === 'changed' ? await link(clientId, target) : null;
    const message = {
      booked: `Hi ${first}, ${from} here. I'm booked for ${horses} on ${when}. Please confirm or pick another time: ${url}`,
      changed: `Hi ${first}, ${from} here. I've moved ${horses} to ${when}. Please confirm or pick another time: ${url}`,
      cancelled: `Hi ${first}, ${from} here. I have to cancel ${horses} on ${when}. I'll be in touch to rebook.`,
      late: `Hi ${first}, ${from} here. I'm running about ${minutesLate} minutes late for ${horses} today. Sorry!`,
      invoice: '',
    }[kind];
    out.push({ clientId, name: c.name, phone: c.phone, message });
  }
  return out;
}

/** Opens the phone's Messages app with the text filled in. Resolves once the person is back. */
export async function openText(phone: string, message: string) {
  if (Platform.OS !== 'web' && (await SMS.isAvailableAsync())) {
    await SMS.sendSMSAsync([phone], message);
    return;
  }
  const sep = Platform.OS === 'ios' ? '&' : '?';
  await Linking.openURL(`sms:${phone.replace(/[^\d+]/g, '')}${sep}body=${encodeURIComponent(message)}`);
}

export type EmailResult = { emailed: string[]; noEmail: string[]; pushed: number; emailEnabled: boolean };

/** Emails each owner (and notifies owners on the app) from the server. */
export function emailClients(kind: MessageKind, target: Target, minutesLate?: number) {
  return callFunction<EmailResult>('notify-clients', { kind, ...target, minutesLate });
}

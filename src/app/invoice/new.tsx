import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { draftLine, LineEditor, lineCents, type DraftLine } from '@/components/line-editor';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, ErrorText, Field, Loading, Screen, SectionTitle, Segmented } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/lib/auth';
import type { TablesInsert } from '@/lib/database.types';
import { formatMoney, parseMoney } from '@/lib/money';
import { fetchBillingSettings, fetchClients } from '@/lib/queries';
import { errorMessage, supabase } from '@/lib/supabase';

type Service = Awaited<ReturnType<typeof fetchBillingSettings>>['services'][number];

/**
 * Builds a draft invoice. From an appointment it starts with one line per
 * horse, priced from the logged visit's work type, plus the trip fee.
 * Taxes and totals are worked out by the database from the lines.
 */
export default function NewInvoice() {
  const params = useLocalSearchParams<{ appointmentId?: string; clientId?: string }>();
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const currency = profile?.default_currency ?? 'usd';

  const { data, loading } = useQuery(async () => {
    const [billing, clients, appt, visits] = await Promise.all([
      fetchBillingSettings(userId),
      fetchClients(userId),
      params.appointmentId
        ? supabase
            .from('appointment_horses')
            .select('horse_id, horses(id, name, horse_owners(client_id))')
            .eq('appointment_id', params.appointmentId)
        : Promise.resolve({ data: [], error: null }),
      params.appointmentId
        ? supabase
            .from('visits')
            .select('id, horse_id, work_type')
            .eq('appointment_id', params.appointmentId)
            .eq('provider_id', userId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (appt.error) throw appt.error;
    if (visits.error) throw visits.error;
    return { services: billing.services.filter((s) => s.active), clients, appt: appt.data ?? [], visits: visits.data ?? [] };
  }, `${userId}:${params.appointmentId}:${params.clientId}`);

  const [clientId, setClientId] = useState<string | null>(params.clientId ?? null);
  const [lines, setLines] = useState<DraftLine[] | null>(null);
  const [forHorse, setForHorse] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (!data) return null;

  // Clients with horses on this appointment come first, so each owner gets their own invoice.
  const apptClientIds = [
    ...new Set(data.appt.flatMap((a) => a.horses?.horse_owners.map((o) => o.client_id) ?? []).filter(Boolean)),
  ] as string[];
  const clientOptions = (apptClientIds.length ? data.clients.filter((c) => apptClientIds.includes(c.id)) : data.clients).map(
    (c) => ({ value: c.id, label: c.full_name }),
  );
  const client = clientId ?? (clientOptions.length === 1 ? clientOptions[0].value : null);

  const clientHorses = data.appt
    .filter((a) => a.horses?.horse_owners.some((o) => o.client_id === client))
    .map((a) => a.horses!);

  function suggestedLines(): DraftLine[] {
    const out: DraftLine[] = [];
    for (const h of clientHorses) {
      const visit = data!.visits.find((v) => v.horse_id === h.id);
      const service = visit ? data!.services.find((s) => s.work_type === visit.work_type) : undefined;
      out.push(
        service
          ? draftLine(`${h.name} — ${service.name}`, service.price_cents, service.taxable, { horse_id: h.id, visit_id: visit!.id })
          : draftLine(h.name, 0, true, { horse_id: h.id, visit_id: visit?.id ?? null }),
      );
    }
    if (params.appointmentId && (profile?.trip_fee_cents ?? 0) > 0) {
      out.push(draftLine('Trip fee', profile!.trip_fee_cents));
    }
    return out;
  }

  const current = lines ?? (client ? suggestedLines() : []);
  const subtotal = current.reduce((sum, l) => sum + lineCents(l), 0);
  const horseName = clientHorses.find((h) => h.id === forHorse)?.name;

  function addService(s: Service) {
    setLines([
      ...current,
      draftLine(horseName ? `${horseName} — ${s.name}` : s.name, s.price_cents, s.taxable, { horse_id: forHorse }),
    ]);
  }

  async function create() {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      // invoice_number and currency are filled in by database triggers.
      const insert = {
        provider_id: userId,
        client_id: client,
        appointment_id: params.appointmentId || null,
        notes: notes.trim() || null,
      } as TablesInsert<'invoices'>;
      const { data: inv, error } = await supabase.from('invoices').insert(insert).select('id').single();
      if (error) throw error;
      const rows = current
        .filter((l) => l.description.trim())
        .map((l, i) => ({
          invoice_id: inv.id,
          description: l.description.trim(),
          quantity: Math.max(1, Math.round(Number(l.quantity) || 1)),
          unit_price_cents: parseMoney(l.price) ?? 0,
          taxable: l.taxable,
          horse_id: l.horse_id,
          visit_id: l.visit_id,
          sort_order: i,
        }));
      if (rows.length) {
        const { error: linesError } = await supabase.from('invoice_line_items').insert(rows);
        if (linesError) throw linesError;
      }
      router.replace({ pathname: '/invoice/[id]', params: { id: inv.id } });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (data.clients.length === 0) {
    return (
      <Screen>
        <EmptyState title="No clients yet" body="Invoices go to a client. Add one from the Clients tab first." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Segmented
        label="Bill to"
        options={clientOptions}
        value={client}
        onChange={(c) => {
          setClientId(c);
          setLines(null);
        }}
      />
      {data.services.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Tip: add your prices under Account → Prices and taxes, and logged visits will be priced for you.
        </ThemedText>
      ) : null}

      {client ? (
        <>
          <SectionTitle>Lines</SectionTitle>
          {current.map((l, i) => (
            <LineEditor
              key={l.key}
              line={l}
              currency={currency}
              onChange={(next) => setLines(current.map((x, j) => (j === i ? next : x)))}
              onRemove={() => setLines(current.filter((_, j) => j !== i))}
            />
          ))}

          {clientHorses.length > 1 ? (
            <Segmented
              label="Add a line for"
              options={clientHorses.map((h) => ({ value: h.id, label: h.name }))}
              value={forHorse}
              onChange={setForHorse}
            />
          ) : null}
          <View style={{ gap: 8 }}>
            {data.services.map((s) => (
              <Button
                key={s.id}
                title={`+ ${s.name} (${formatMoney(s.price_cents, currency)})`}
                variant="secondary"
                onPress={() => addService(s)}
              />
            ))}
            <Button title="+ Other line" variant="secondary" onPress={() => setLines([...current, draftLine('', 0)])} />
          </View>

          <Field label="Note to client" value={notes} onChangeText={setNotes} multiline />
          <ThemedText style={{ fontWeight: 600 }}>
            Subtotal {formatMoney(subtotal, currency)} (tax is added on the next screen)
          </ThemedText>
          <ErrorText>{error}</ErrorText>
          <Button title="Create draft invoice" onPress={create} loading={busy} disabled={current.length === 0} />
        </>
      ) : null}
    </Screen>
  );
}

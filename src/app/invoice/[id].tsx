import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { draftLine, LineEditor, type DraftLine } from '@/components/line-editor';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Field, Loading, Screen, SectionTitle, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { centsToInput, formatMoney, INVOICE_STATUS_LABELS as STATUS_LABELS, parseMoney } from '@/lib/money';
import { payInvoiceByCard } from '@/lib/payments';
import { fetchInvoice, type InvoiceDetail } from '@/lib/queries';
import { addDays, toDateString } from '@/lib/schedule';
import { errorMessage, supabase } from '@/lib/supabase';
import { formatRate } from '@/lib/tax-presets';

type TaxLine = { name: string; rate_bp: number; tax_number: string | null; cents: number };

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Cheque / check' },
  { value: 'other', label: 'Other (e-transfer, Venmo…)' },
] as const;

/** Text the farrier shares by text or email until card payment links arrive. */
function invoiceText(inv: InvoiceDetail) {
  const from = inv.profiles?.business_name || inv.profiles?.full_name || 'Your farrier';
  const taxes = (inv.tax_breakdown as TaxLine[]).filter((t) => t.cents > 0);
  return [
    `Invoice #${inv.invoice_number} from ${from}`,
    '',
    ...inv.invoice_line_items.map(
      (l) => `${l.description}${l.quantity > 1 ? ` x${l.quantity}` : ''}: ${formatMoney(l.amount_cents, inv.currency)}`,
    ),
    '',
    `Subtotal: ${formatMoney(inv.subtotal_cents, inv.currency)}`,
    ...taxes.map(
      (t) =>
        `${t.name} ${formatRate(t.rate_bp)}${t.tax_number ? ` (${t.tax_number})` : ''}: ${formatMoney(t.cents, inv.currency)}`,
    ),
    `Total: ${formatMoney(inv.total_cents, inv.currency)}`,
    inv.due_date ? `Due: ${formatDate(inv.due_date)}` : '',
    inv.notes ? `\n${inv.notes}` : '',
  ]
    .filter((s) => s !== '')
    .join('\n');
}

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const theme = useTheme();
  const { data: inv, error: loadError, loading, refetch } = useQuery(() => fetchInvoice(id), id);
  const [editLines, setEditLines] = useState<DraftLine[] | null>(null);
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading && !inv) return <Loading />;
  if (!inv) return <Screen><ErrorText>{loadError ?? 'Invoice not found.'}</ErrorText></Screen>;

  const isFarrier = inv.provider_id === session!.user.id;
  const balance = (inv.total_cents ?? 0) - inv.amount_paid_cents;
  const taxes = inv.tax_breakdown as TaxLine[];
  const draft = inv.status === 'draft';
  const open = inv.status === 'sent' || inv.status === 'partially_paid';

  async function run(action: () => PromiseLike<{ error: unknown }>, after?: () => void) {
    setBusy(true);
    setError(null);
    const { error } = await action();
    setBusy(false);
    if (error) setError(errorMessage(error));
    else {
      after?.();
      refetch();
    }
  }

  const takesCards = !!inv.profiles?.stripe_charges_enabled;

  async function payByCard() {
    setBusy(true);
    setError(null);
    try {
      await payInvoiceByCard(id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      // The webhook records the payment; give it a moment, then reload.
      setTimeout(refetch, 2000);
    }
  }

  async function saveLines(lines: DraftLine[]) {
    // Lines can only change while the invoice is a draft; replace them all.
    const del = await supabase.from('invoice_line_items').delete().eq('invoice_id', id);
    if (del.error) return del;
    const rows = lines
      .filter((l) => l.description.trim())
      .map((l, i) => ({
        invoice_id: id,
        description: l.description.trim(),
        quantity: Math.max(1, Math.round(Number(l.quantity) || 1)),
        unit_price_cents: parseMoney(l.price) ?? 0,
        taxable: l.taxable,
        horse_id: l.horse_id,
        visit_id: l.visit_id,
        sort_order: i,
      }));
    return rows.length ? supabase.from('invoice_line_items').insert(rows) : del;
  }

  async function send() {
    await run(
      () =>
        supabase
          .from('invoices')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            due_date: inv!.due_date ?? toDateString(addDays(new Date(), 14)),
          })
          .eq('id', id),
      async () => {
        const fresh = await fetchInvoice(id);
        await Share.share({ message: invoiceText(fresh) });
      },
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `Invoice #${inv.invoice_number}` }} />
      <Card>
        <View style={styles.row}>
          <ThemedText type="subtitle">{formatMoney(inv.total_cents, inv.currency)}</ThemedText>
          <ThemedText
            type="smallBold"
            style={{ color: inv.status === 'paid' ? theme.success : inv.status === 'void' ? theme.danger : theme.warning }}>
            {STATUS_LABELS[inv.status]}
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary">
          {isFarrier
            ? inv.clients?.full_name
            : `From ${inv.profiles?.business_name || inv.profiles?.full_name || 'your farrier'}`}
        </ThemedText>
        {inv.due_date ? <ThemedText type="small">Due {formatDate(inv.due_date)}</ThemedText> : null}
        {inv.amount_paid_cents > 0 ? (
          <ThemedText type="small">
            Paid {formatMoney(inv.amount_paid_cents, inv.currency)}
            {balance > 0 ? ` · ${formatMoney(balance, inv.currency)} still owing` : ''}
          </ThemedText>
        ) : null}
      </Card>

      <SectionTitle>Lines</SectionTitle>
      {editLines ? (
        <>
          {editLines.map((l, i) => (
            <LineEditor
              key={l.key}
              line={l}
              currency={inv.currency}
              onChange={(next) => setEditLines(editLines.map((x, j) => (j === i ? next : x)))}
              onRemove={() => setEditLines(editLines.filter((_, j) => j !== i))}
            />
          ))}
          <Button title="+ Add line" variant="secondary" onPress={() => setEditLines([...editLines, draftLine('', 0)])} />
          <Button
            title="Save lines"
            loading={busy}
            onPress={() => run(() => saveLines(editLines), () => setEditLines(null))}
          />
          <Button title="Cancel" variant="secondary" onPress={() => setEditLines(null)} />
        </>
      ) : (
        <Card>
          {inv.invoice_line_items.map((l) => (
            <View key={l.id} style={styles.row}>
              <ThemedText style={{ flexShrink: 1 }}>
                {l.description}
                {l.quantity > 1 ? ` × ${l.quantity}` : ''}
              </ThemedText>
              <ThemedText>{formatMoney(l.amount_cents, inv.currency)}</ThemedText>
            </View>
          ))}
          <View style={[styles.row, styles.totals]}>
            <ThemedText themeColor="textSecondary">Subtotal</ThemedText>
            <ThemedText>{formatMoney(inv.subtotal_cents, inv.currency)}</ThemedText>
          </View>
          {taxes.map((t) => (
            <View key={t.name} style={styles.row}>
              <ThemedText themeColor="textSecondary">
                {t.name} {formatRate(t.rate_bp)}
                {t.tax_number ? ` · ${t.tax_number}` : ''}
              </ThemedText>
              <ThemedText>{formatMoney(t.cents, inv.currency)}</ThemedText>
            </View>
          ))}
          <View style={styles.row}>
            <ThemedText style={{ fontWeight: 600 }}>Total</ThemedText>
            <ThemedText style={{ fontWeight: 600 }}>{formatMoney(inv.total_cents, inv.currency)}</ThemedText>
          </View>
        </Card>
      )}

      {inv.notes ? <ThemedText>{inv.notes}</ThemedText> : null}

      {inv.payments.length ? (
        <>
          <SectionTitle>Payments</SectionTitle>
          {inv.payments.map((p) => (
            <ThemedText key={p.id} type="small">
              {formatDate(p.paid_at.slice(0, 10))} · {METHODS.find((m) => m.value === p.method)?.label ?? 'Card'} ·{' '}
              {formatMoney(p.amount_cents, inv.currency)}
              {p.status !== 'succeeded' ? ` (${p.status})` : ''}
            </ThemedText>
          ))}
        </>
      ) : null}

      <ErrorText>{error}</ErrorText>

      {isFarrier && draft && !editLines ? (
        <>
          <Button title="Send invoice" loading={busy} onPress={send} />
          <Button
            title="Edit lines"
            variant="secondary"
            onPress={() =>
              setEditLines(
                inv.invoice_line_items.map((l) => ({
                  ...draftLine(l.description, l.unit_price_cents, l.taxable, { horse_id: l.horse_id, visit_id: l.visit_id }),
                  quantity: String(l.quantity),
                })),
              )
            }
          />
          <Button
            title="Delete draft"
            variant="danger"
            loading={busy}
            onPress={() => run(() => supabase.from('invoices').delete().eq('id', id), () => router.back())}
          />
        </>
      ) : null}

      {isFarrier && open && !paying ? (
        <>
          <Button title="Record a payment" onPress={() => setPaying(true)} />
          {takesCards ? (
            <Button title="Take card payment now" variant="secondary" loading={busy} onPress={payByCard} />
          ) : null}
          <Button
            title="Share invoice again"
            variant="secondary"
            onPress={() => Share.share({ message: invoiceText(inv) })}
          />
          {inv.amount_paid_cents === 0 ? (
            <Button
              title="Void invoice"
              variant="secondary"
              loading={busy}
              onPress={() => run(() => supabase.from('invoices').update({ status: 'void' }).eq('id', id))}
            />
          ) : null}
        </>
      ) : null}

      {isFarrier && open && paying ? (
        <PaymentForm
          balance={balance}
          currency={inv.currency}
          busy={busy}
          onCancel={() => setPaying(false)}
          onSave={(amount_cents, method) =>
            run(
              () =>
                supabase
                  .from('payments')
                  .insert({ invoice_id: id, amount_cents, method, recorded_by: session!.user.id }),
              () => setPaying(false),
            )
          }
        />
      ) : null}

      {!isFarrier && open && takesCards ? (
        <Button title={`Pay ${formatMoney(balance, inv.currency)} by card`} loading={busy} onPress={payByCard} />
      ) : null}
      {!isFarrier && open && !takesCards ? (
        <ThemedText type="small" themeColor="textSecondary">
          Your farrier doesn&apos;t take card payments in the app yet. Pay them the way you usually do.
        </ThemedText>
      ) : null}
    </Screen>
  );
}

function PaymentForm({
  balance,
  currency,
  busy,
  onSave,
  onCancel,
}: {
  balance: number;
  currency: string;
  busy: boolean;
  onSave: (cents: number, method: 'cash' | 'check' | 'other') => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(centsToInput(Math.max(0, balance)));
  const [method, setMethod] = useState<'cash' | 'check' | 'other'>('cash');
  const cents = parseMoney(amount);
  return (
    <Card>
      <View style={{ gap: Spacing.three }}>
        <Field label={`Amount (${currency.toUpperCase()})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Segmented label="Paid by" options={[...METHODS]} value={method} onChange={setMethod} />
        <Button
          title="Save payment"
          loading={busy}
          disabled={!cents || cents <= 0}
          onPress={() => onSave(cents!, method)}
        />
        <Button title="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  totals: { marginTop: Spacing.two },
});

import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Field, Loading, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { callFunction } from '@/lib/payments';
import { formatWindow } from '@/lib/schedule';
import { errorMessage } from '@/lib/supabase';
import { formatRate } from '@/lib/tax-presets';

type Farrier = { name: string; phone: string | null; email: string | null; takesCards: boolean };
type VisitView = {
  kind: 'visit';
  farrier: Farrier;
  visit: {
    status: string;
    start: string;
    end: string | null;
    confirmed: boolean;
    changeRequest: string | null;
    notes: string | null;
    barn: { name: string; address: string | null } | null;
    horses: { id: string; name: string; note: string | null }[];
  };
};
type InvoiceView = {
  kind: 'invoice';
  farrier: Farrier;
  invoice: {
    invoice_number: number;
    status: string;
    subtotal_cents: number;
    tax_breakdown: { name: string; rate_bp: number; tax_number: string | null; cents: number }[];
    total_cents: number;
    amount_paid_cents: number;
    currency: string;
    due_date: string | null;
    notes: string | null;
    sent_at: string | null;
    created_at: string;
    clients: { full_name: string } | null;
    invoice_line_items: { description: string; quantity: number; unit_price_cents: number; amount_cents: number | null }[];
  };
};
type View_ = VisitView | InvoiceView;

/**
 * The page an owner opens from a text or email. No sign-in and no app
 * needed: confirm a visit, ask for another time, leave a note, or pay.
 */
export default function PublicLink() {
  const { token, paid } = useLocalSearchParams<{ token: string; paid?: string }>();
  const [view, setView] = useState<View_ | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const act = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      setBusy(action);
      setError(null);
      try {
        const res = await callFunction<View_ | { url: string }>('public-link', { token, action, ...extra });
        if ('url' in res) {
          if (Platform.OS === 'web') window.location.href = res.url;
          else await Linking.openURL(res.url);
        } else setView(res);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(null);
      }
    },
    [token],
  );

  useEffect(() => {
    callFunction<View_>('public-link', { token, action: 'view' })
      .then(setView)
      .catch((e) => setError(errorMessage(e)));
  }, [token]);

  if (!view && !error) return <Loading />;

  return (
    <Screen>
      <Stack.Screen options={{ title: view?.kind === 'invoice' ? 'Invoice' : 'Farrier visit', headerBackVisible: false }} />
      {!view ? <ErrorText>{error}</ErrorText> : null}
      {view?.kind === 'visit' ? <Visit view={view} act={act} busy={busy} error={error} /> : null}
      {view?.kind === 'invoice' ? (
        <Invoice view={view} act={act} busy={busy} error={error} paid={paid === '1'} />
      ) : null}
      {view ? <Contact farrier={view.farrier} /> : null}
    </Screen>
  );
}

type ActProps = { act: (action: string, extra?: Record<string, unknown>) => Promise<void>; busy: string | null; error: string | null };

function Visit({ view, act, busy, error }: { view: VisitView } & ActProps) {
  const theme = useTheme();
  const v = view.visit;
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState('');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const scheduled = v.status === 'scheduled';
  const day = new Date(v.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      <Card>
        <ThemedText themeColor="textSecondary">{view.farrier.name}</ThemedText>
        <ThemedText type="subtitle">{day}</ThemedText>
        <ThemedText>Arriving {formatWindow(v.start, v.end)}</ThemedText>
        {v.barn ? (
          <ThemedText type="small" themeColor="textSecondary">
            {[v.barn.name, v.barn.address].filter(Boolean).join(' · ')}
          </ThemedText>
        ) : null}
        <ThemedText
          type="smallBold"
          style={{ color: !scheduled ? theme.danger : v.confirmed ? theme.success : theme.warning }}>
          {v.status === 'cancelled'
            ? 'This visit was cancelled'
            : v.status === 'completed'
              ? 'Done'
              : v.confirmed
                ? 'You confirmed this time'
                : v.changeRequest
                  ? 'You asked for a different time'
                  : 'Please confirm this time'}
        </ThemedText>
        {v.changeRequest ? <ThemedText type="small">&ldquo;{v.changeRequest}&rdquo;</ThemedText> : null}
      </Card>

      {scheduled && !v.confirmed && !asking ? (
        <Button title="Confirm this time" loading={busy === 'confirm'} onPress={() => act('confirm')} />
      ) : null}
      {scheduled && !asking ? (
        <Button title="Ask for a different time" variant="secondary" onPress={() => setAsking(true)} />
      ) : null}
      {asking ? (
        <>
          <Field
            label="What works better?"
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder="e.g. Any morning next week except Wednesday"
          />
          <Button
            title="Send to farrier"
            loading={busy === 'change'}
            disabled={!message.trim()}
            onPress={async () => {
              await act('change', { message });
              setAsking(false);
            }}
          />
          <Button title="Never mind" variant="secondary" onPress={() => setAsking(false)} />
        </>
      ) : null}
      <ErrorText>{error}</ErrorText>

      <SectionTitle>Your horses</SectionTitle>
      {v.horses.map((h) => (
        <Card key={h.id}>
          <ThemedText style={{ fontWeight: 600 }}>{h.name}</ThemedText>
          {h.note && noteFor !== h.id ? <ThemedText type="small">Your note: {h.note}</ThemedText> : null}
          {scheduled && noteFor !== h.id ? (
            <ThemedText
              type="smallBold"
              themeColor="accent"
              onPress={() => {
                setNoteFor(h.id);
                setNote(h.note ?? '');
              }}>
              {h.note ? 'Edit note for the farrier' : 'Add a note for the farrier'}
            </ThemedText>
          ) : null}
          {noteFor === h.id ? (
            <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
              <Field
                label="Note for the farrier"
                value={note}
                onChangeText={setNote}
                multiline
                placeholder="e.g. Left front looks a bit off since Tuesday"
              />
              <Button
                title="Save note"
                loading={busy === 'note'}
                onPress={async () => {
                  await act('note', { horseId: h.id, note });
                  setNoteFor(null);
                }}
              />
              <Button title="Cancel" variant="secondary" onPress={() => setNoteFor(null)} />
            </View>
          ) : null}
        </Card>
      ))}
      {v.notes ? (
        <>
          <SectionTitle>From your farrier</SectionTitle>
          <ThemedText>{v.notes}</ThemedText>
        </>
      ) : null}
    </>
  );
}

function Invoice({ view, act, busy, error, paid }: { view: InvoiceView; paid: boolean } & ActProps) {
  const theme = useTheme();
  const inv = view.invoice;
  const balance = inv.total_cents - inv.amount_paid_cents;
  const open = inv.status === 'sent' || inv.status === 'partially_paid';
  const money = (c: number) => formatMoney(c, inv.currency);

  return (
    <>
      {paid && open ? (
        <Card>
          <ThemedText style={{ fontWeight: 600, color: theme.success }}>
            Payment received. Thank you! It can take a minute to show here.
          </ThemedText>
        </Card>
      ) : null}
      <Card>
        <ThemedText themeColor="textSecondary">{view.farrier.name}</ThemedText>
        <ThemedText type="subtitle">Invoice #{inv.invoice_number}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {[
            inv.clients?.full_name ? `For ${inv.clients.full_name}` : null,
            formatDate((inv.sent_at ?? inv.created_at).slice(0, 10)),
            inv.due_date && open ? `Due ${formatDate(inv.due_date)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
        <ThemedText
          type="smallBold"
          style={{ color: inv.status === 'paid' ? theme.success : inv.status === 'void' ? theme.textSecondary : theme.warning }}>
          {inv.status === 'paid' ? 'Paid' : inv.status === 'void' ? 'Void' : `${money(balance)} owing`}
        </ThemedText>
      </Card>

      <View style={{ gap: Spacing.one }}>
        {inv.invoice_line_items.map((l, i) => (
          <View key={i} style={styles.line}>
            <ThemedText style={{ flex: 1 }}>
              {l.description}
              {l.quantity > 1 ? ` × ${l.quantity}` : ''}
            </ThemedText>
            <ThemedText>{money(l.amount_cents ?? l.unit_price_cents * l.quantity)}</ThemedText>
          </View>
        ))}
        <View style={styles.line}>
          <ThemedText themeColor="textSecondary">Subtotal</ThemedText>
          <ThemedText themeColor="textSecondary">{money(inv.subtotal_cents)}</ThemedText>
        </View>
        {inv.tax_breakdown
          .filter((t) => t.cents > 0)
          .map((t) => (
            <View key={t.name} style={styles.line}>
              <ThemedText themeColor="textSecondary">
                {t.name} {formatRate(t.rate_bp)}
                {t.tax_number ? ` (${t.tax_number})` : ''}
              </ThemedText>
              <ThemedText themeColor="textSecondary">{money(t.cents)}</ThemedText>
            </View>
          ))}
        <View style={styles.line}>
          <ThemedText style={{ fontWeight: 600 }}>Total</ThemedText>
          <ThemedText style={{ fontWeight: 600 }}>{money(inv.total_cents)}</ThemedText>
        </View>
        {inv.amount_paid_cents > 0 ? (
          <View style={styles.line}>
            <ThemedText themeColor="textSecondary">Paid</ThemedText>
            <ThemedText themeColor="textSecondary">−{money(inv.amount_paid_cents)}</ThemedText>
          </View>
        ) : null}
      </View>
      {inv.notes ? <ThemedText>{inv.notes}</ThemedText> : null}

      <ErrorText>{error}</ErrorText>
      {open && balance > 0 && view.farrier.takesCards ? (
        <Button title={`Pay ${money(balance)} by card`} loading={busy === 'pay'} onPress={() => act('pay')} />
      ) : null}
      {open && balance > 0 && !view.farrier.takesCards ? (
        <ThemedText type="small" themeColor="textSecondary">
          Pay your farrier by cash, cheque or e-transfer as usual.
        </ThemedText>
      ) : null}
      {Platform.OS === 'web' ? (
        <Button title="Print or save as PDF" variant="secondary" onPress={() => window.print()} />
      ) : null}
    </>
  );
}

function Contact({ farrier }: { farrier: Farrier }) {
  if (!farrier.phone && !farrier.email) return null;
  return (
    <>
      <SectionTitle>Questions?</SectionTitle>
      {farrier.phone ? (
        <Button title={`Call or text ${farrier.phone}`} variant="secondary" onPress={() => Linking.openURL(`tel:${farrier.phone}`)} />
      ) : null}
      {farrier.email ? (
        <Button title={`Email ${farrier.email}`} variant="secondary" onPress={() => Linking.openURL(`mailto:${farrier.email}`)} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
});

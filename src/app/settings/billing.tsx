import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Field, Loading, Screen, SectionTitle, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/lib/auth';
import { centsToInput, formatMoney, parseMoney } from '@/lib/money';
import { openCardSetup } from '@/lib/payments';
import { fetchBillingSettings } from '@/lib/queries';
import { errorMessage, supabase } from '@/lib/supabase';
import { CA_TAX_PRESETS, formatRate } from '@/lib/tax-presets';
import { label, WORK_TYPES } from '@/lib/visit-options';

type Service = Awaited<ReturnType<typeof fetchBillingSettings>>['services'][number];
type TaxRate = Awaited<ReturnType<typeof fetchBillingSettings>>['taxes'][number];

const SERVICE_WORK = [...WORK_TYPES, { value: 'other', label: 'Other' }];

/** Farrier's price list, trip fee and sales taxes, used to build invoices. */
export default function BillingSettings() {
  const { session, profile, refreshProfile } = useAuth();
  const userId = session!.user.id;
  const currency = profile?.default_currency ?? 'usd';
  const { data, error: loadError, loading, refetch } = useQuery(() => fetchBillingSettings(userId), userId);
  const [tripFee, setTripFee] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // service id or 'new'
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  if (loading && !data) return <Loading />;
  const preset = profile?.country === 'CA' && profile.region ? CA_TAX_PRESETS[profile.region] : undefined;
  const tripValue = tripFee ?? centsToInput(profile?.trip_fee_cents ?? 0);

  return (
    <Screen>
      <ErrorText>{loadError ?? error}</ErrorText>

      <SectionTitle>Card payments</SectionTitle>
      <ThemedText type="small" themeColor="textSecondary">
        {profile?.stripe_charges_enabled
          ? 'Clients can pay your invoices by card. Money goes to your Stripe account.'
          : 'Let clients pay invoices by card. Stripe asks for your details and bank account; payouts go straight to you.'}
      </ThemedText>
      <Button
        title={profile?.stripe_charges_enabled ? 'Open Stripe dashboard' : 'Set up card payments'}
        variant={profile?.stripe_charges_enabled ? 'secondary' : 'primary'}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await openCardSetup();
            await refreshProfile();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      />

      <SectionTitle>Trip fee</SectionTitle>
      <Field
        label={`Per barn stop (${currency.toUpperCase()})`}
        value={tripValue}
        onChangeText={setTripFee}
        keyboardType="decimal-pad"
        hint="Added once per stop when you invoice a visit. Use 0 for none."
      />
      {tripFee !== null ? (
        <Button
          title="Save trip fee"
          loading={busy}
          onPress={() =>
            run(
              () =>
                supabase
                  .from('profiles')
                  .update({ trip_fee_cents: parseMoney(tripValue) ?? 0 })
                  .eq('id', userId),
              () => {
                setTripFee(null);
                refreshProfile();
              },
            )
          }
        />
      ) : null}

      <SectionTitle>Services and prices</SectionTitle>
      {data?.services.map((s) =>
        editing === s.id ? (
          <ServiceForm
            key={s.id}
            service={s}
            currency={currency}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={(fields) =>
              run(() => supabase.from('provider_services').update(fields).eq('id', s.id), () => setEditing(null))
            }
          />
        ) : (
          <Card key={s.id} onPress={() => setEditing(s.id)}>
            <View style={styles.row}>
              <ThemedText style={{ fontWeight: 600, opacity: s.active ? 1 : 0.5 }}>{s.name}</ThemedText>
              <ThemedText>{formatMoney(s.price_cents, currency)}</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                s.work_type ? label(SERVICE_WORK, s.work_type) : null,
                s.taxable ? 'Taxable' : 'Not taxed',
                s.active ? null : 'Hidden',
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </Card>
        ),
      )}
      {editing === 'new' ? (
        <ServiceForm
          currency={currency}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={(fields) =>
            run(
              () =>
                supabase
                  .from('provider_services')
                  .insert({ ...fields, provider_id: userId, sort_order: data?.services.length ?? 0 }),
              () => setEditing(null),
            )
          }
        />
      ) : (
        <Button title="Add a service" variant="secondary" onPress={() => setEditing('new')} />
      )}

      <SectionTitle>Sales tax</SectionTitle>
      <ThemedText type="small" themeColor="textSecondary">
        Taxes apply to taxable lines on new invoices. Check with your accountant which taxes you need to charge.
      </ThemedText>
      {data?.taxes.map((t) => (
        <TaxRow key={t.id} tax={t} run={run} />
      ))}
      {preset && data?.taxes.length === 0 ? (
        <Button
          title={`Add ${profile!.region} rates (${preset.map((p) => `${p.name} ${formatRate(p.rate_bp)}`).join(' + ')})`}
          loading={busy}
          onPress={() =>
            run(() =>
              supabase
                .from('tax_rates')
                .insert(preset.map((p, i) => ({ ...p, provider_id: userId, sort_order: i }))),
            )
          }
        />
      ) : null}
      <NewTax userId={userId} count={data?.taxes.length ?? 0} busy={busy} run={run} />
    </Screen>
  );
}

function ServiceForm({
  service,
  currency,
  busy,
  onSave,
  onCancel,
}: {
  service?: Service;
  currency: string;
  busy: boolean;
  onSave: (fields: { name: string; price_cents: number; work_type: string | null; taxable: boolean; active: boolean }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(service?.name ?? '');
  const [price, setPrice] = useState(service ? centsToInput(service.price_cents) : '');
  const [workType, setWorkType] = useState<string | null>(service?.work_type ?? null);
  const [taxable, setTaxable] = useState(service?.taxable ?? true);
  const [active, setActive] = useState(service?.active ?? true);
  const cents = parseMoney(price);

  return (
    <Card>
      <View style={styles.form}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Front shoes" />
        <Field label={`Price (${currency.toUpperCase()})`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        <Segmented
          label="Matches work type"
          options={SERVICE_WORK}
          value={workType}
          onChange={(w) => {
            setWorkType(w);
            if (!name.trim()) setName(label(SERVICE_WORK, w));
          }}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Used to price a logged visit automatically.
        </ThemedText>
        <View style={styles.row}>
          <ThemedText>Taxable</ThemedText>
          <Switch value={taxable} onValueChange={setTaxable} />
        </View>
        {service ? (
          <View style={styles.row}>
            <ThemedText>Show on invoices</ThemedText>
            <Switch value={active} onValueChange={setActive} />
          </View>
        ) : null}
        <Button
          title="Save service"
          loading={busy}
          disabled={!name.trim() || cents === null}
          onPress={() => onSave({ name: name.trim(), price_cents: cents ?? 0, work_type: workType, taxable, active })}
        />
        <Button title="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </Card>
  );
}

type Run = (action: () => PromiseLike<{ error: unknown }>, after?: () => void) => void;

function TaxRow({ tax, run }: { tax: TaxRate; run: Run }) {
  const [taxNumber, setTaxNumber] = useState(tax.tax_number ?? '');
  return (
    <Card>
      <View style={styles.row}>
        <ThemedText style={{ fontWeight: 600, opacity: tax.active ? 1 : 0.5 }}>
          {tax.name} {formatRate(tax.rate_bp)}
        </ThemedText>
        <Switch
          value={tax.active}
          onValueChange={(active) => run(() => supabase.from('tax_rates').update({ active }).eq('id', tax.id))}
        />
      </View>
      <Field
        label="Registration number (printed on invoices)"
        value={taxNumber}
        onChangeText={setTaxNumber}
        onBlur={() =>
          taxNumber !== (tax.tax_number ?? '') &&
          run(() => supabase.from('tax_rates').update({ tax_number: taxNumber.trim() || null }).eq('id', tax.id))
        }
      />
    </Card>
  );
}

function NewTax({ userId, count, busy, run }: { userId: string; count: number; busy: boolean; run: Run }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Sales tax');
  const [rate, setRate] = useState('');
  const pct = Number(rate.replace(/[^0-9.]/g, ''));
  const valid = !!rate.trim() && Number.isFinite(pct) && pct >= 0 && pct <= 20;

  if (!open) return <Button title="Add a tax" variant="secondary" onPress={() => setOpen(true)} />;
  return (
    <Card>
      <View style={styles.form}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="GST, HST, PST, Sales tax" />
        <Field label="Rate (%)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="e.g. 7.25" />
        <Button
          title="Save tax"
          loading={busy}
          disabled={!name.trim() || !valid}
          onPress={() =>
            run(
              () =>
                supabase
                  .from('tax_rates')
                  .insert({ provider_id: userId, name: name.trim(), rate_bp: Math.round(pct * 100), sort_order: count }),
              () => {
                setOpen(false);
                setRate('');
              },
            )
          }
        />
        <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  form: { gap: Spacing.three },
});

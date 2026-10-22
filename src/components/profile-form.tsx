import { useState } from 'react';

import { Button, ErrorText, Field, Segmented } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { errorMessage, supabase } from '@/lib/supabase';
import type { AppMode } from '@/lib/types';

type Country = 'US' | 'CA';

/** Country drives money and distance: CAD and km in Canada, USD and miles in the US. */
const COUNTRY_DEFAULTS = {
  US: { default_currency: 'usd', distance_unit: 'mi' },
  CA: { default_currency: 'cad', distance_unit: 'km' },
} as const;

export function ProfileForm({
  mode,
  submitLabel,
  onSaved,
}: {
  mode: AppMode;
  submitLabel: string;
  onSaved?: () => Promise<void> | void;
}) {
  const { session, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [businessName, setBusinessName] = useState(profile?.business_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [country, setCountry] = useState<Country>((profile?.country as Country) ?? 'US');
  const [region, setRegion] = useState(profile?.region ?? '');
  const [serviceArea, setServiceArea] = useState(profile?.service_area ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!session) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        business_name: mode === 'farrier' ? businessName.trim() || null : profile?.business_name ?? null,
        phone: phone.trim() || null,
        country,
        region: region.trim().toUpperCase() || null,
        service_area: mode === 'farrier' ? serviceArea.trim() || null : profile?.service_area ?? null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...COUNTRY_DEFAULTS[country],
      })
      .eq('id', session.user.id);
    if (error) {
      setBusy(false);
      setError(errorMessage(error));
      return;
    }
    await refreshProfile();
    try {
      await onSaved?.();
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  return (
    <>
      <Field label="Your name" value={fullName} onChangeText={setFullName} autoComplete="name" />
      {mode === 'farrier' ? (
        <Field
          label="Business name"
          value={businessName}
          onChangeText={setBusinessName}
          hint="Shown to owners and on invoices. Optional."
        />
      ) : null}
      <Field label="Mobile phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
      <Segmented
        label="Country"
        options={[
          { value: 'US', label: 'United States' },
          { value: 'CA', label: 'Canada' },
        ]}
        value={country}
        onChange={setCountry}
      />
      <Field
        label={country === 'CA' ? 'Province' : 'State'}
        value={region}
        onChangeText={setRegion}
        autoCapitalize="characters"
        maxLength={2}
        placeholder={country === 'CA' ? 'ON' : 'CO'}
        hint={country === 'CA' ? 'Sets GST/HST/PST on your invoices later.' : undefined}
      />
      {mode === 'farrier' ? (
        <Field
          label="Service area"
          value={serviceArea}
          onChangeText={setServiceArea}
          placeholder="e.g. Boulder County"
          hint="Helps owners find you."
        />
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Button title={submitLabel} onPress={save} loading={busy} disabled={!fullName.trim()} />
    </>
  );
}

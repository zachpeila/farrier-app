import { presentContactPickerAsync } from 'expo-contacts/legacy';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Field, Loading, Screen, SectionTitle, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/lib/auth';
import { INTERVAL_OPTIONS } from '@/lib/horse-options';
import { fetchMyBarns } from '@/lib/queries';
import { addClientWithHorses, barnsByName } from '@/lib/quick-add';
import { errorMessage } from '@/lib/supabase';

const NONE = 'none';
const NEW = 'new';

/** Add a client, their barn and all their horses on one screen. */
export default function QuickAddClient() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const { data: barns, loading } = useQuery(() => fetchMyBarns(userId), userId);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [barn, setBarn] = useState<string | null>(null);
  const [barnName, setBarnName] = useState('');
  const [barnAddress, setBarnAddress] = useState('');
  const [horses, setHorses] = useState<string[]>(['']);
  const [interval, setIntervalWeeks] = useState('6');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading && !barns) return <Loading />;
  const barnChoice = barn ?? (barns?.length ? NONE : NEW);

  async function pickContact() {
    setError(null);
    try {
      const c = await presentContactPickerAsync();
      if (!c) return;
      setName(c.name ?? [c.firstName, c.lastName].filter(Boolean).join(' '));
      const mobile = c.phoneNumbers?.find((p) => /mobile|cell|iphone/i.test(p.label ?? '')) ?? c.phoneNumbers?.[0];
      if (mobile?.number) setPhone(mobile.number);
      if (c.emails?.[0]?.email) setEmail(c.emails[0].email);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const clientId = await addClientWithHorses(
        {
          name,
          phone,
          email,
          barn:
            barnChoice === NONE
              ? null
              : barnChoice === NEW
                ? barnName.trim()
                  ? { name: barnName, address: barnAddress.trim() || null }
                  : null
                : { id: barnChoice },
          horses,
          intervalWeeks: Number(interval),
        },
        userId,
        await barnsByName(userId),
      );
      router.replace({ pathname: '/client/[id]', params: { id: clientId } });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      {Platform.OS !== 'web' ? (
        <Button title="Pick from phone contacts" variant="secondary" onPress={pickContact} />
      ) : null}
      <Field label="Client name" value={name} onChangeText={setName} autoComplete="name" />
      <Field label="Mobile phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" hint="Used to text visit times and invoices." />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

      <SectionTitle>Barn</SectionTitle>
      <Segmented
        options={[
          ...(barns ?? []).map((b) => ({ value: b.id, label: b.name })),
          { value: NEW, label: '+ New barn' },
          { value: NONE, label: 'Not now' },
        ]}
        value={barnChoice}
        onChange={setBarn}
      />
      {barnChoice === NEW ? (
        <>
          <Field label="Barn name" value={barnName} onChangeText={setBarnName} placeholder="e.g. Willow Creek Stables" />
          <Field label="Address" value={barnAddress} onChangeText={setBarnAddress} placeholder="Street, town" />
        </>
      ) : null}

      <SectionTitle>Horses</SectionTitle>
      {horses.map((h, i) => (
        <Field
          key={i}
          label={`Horse ${i + 1}`}
          value={h}
          onChangeText={(text) => setHorses(horses.map((x, j) => (j === i ? text : x)))}
          placeholder="Name"
        />
      ))}
      <Button title="+ Another horse" variant="secondary" onPress={() => setHorses([...horses, ''])} />
      <Segmented label="Shoeing interval" options={INTERVAL_OPTIONS} value={interval} onChange={setIntervalWeeks} />

      <ErrorText>{error}</ErrorText>
      <Button title="Save client and horses" onPress={save} loading={busy} disabled={!name.trim()} />
      <View style={{ gap: Spacing.one }}>
        <ThemedText type="small" themeColor="textSecondary">
          Have a list already?
        </ThemedText>
        <Button title="Import from a spreadsheet" variant="secondary" onPress={() => router.replace('/client/import')} />
      </View>
    </Screen>
  );
}

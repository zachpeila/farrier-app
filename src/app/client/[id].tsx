import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Field, Loading, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { inviteMessage } from '@/lib/invites';
import { errorMessage, supabase } from '@/lib/supabase';

type ClientHorse = { id: string; name: string };

/** Create (id = "new") or edit a client, see their horses, and invite them onto the app. */
export default function ClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { session, profile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [linked, setLinked] = useState(false);
  const [horses, setHorses] = useState<ClientHorse[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    supabase
      .from('clients')
      .select('*, horse_owners(horses(id, name, archived_at))')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(errorMessage(error));
        if (data) {
          setFullName(data.full_name);
          setPhone(data.phone ?? '');
          setEmail(data.email ?? '');
          setLinked(!!data.linked_user_id);
          setHorses(
            data.horse_owners
              .map((o) => o.horses)
              .filter((h): h is NonNullable<typeof h> => !!h && !h.archived_at)
              .map((h) => ({ id: h.id, name: h.name })),
          );
        }
        setLoading(false);
      });
  }, [id, isNew]);

  async function save() {
    setBusy(true);
    setError(null);
    const fields = { full_name: fullName.trim(), phone: phone.trim() || null, email: email.trim() || null };
    const { error } = isNew
      ? await supabase.from('clients').insert({ ...fields, provider_id: session!.user.id })
      : await supabase.from('clients').update(fields).eq('id', id);
    setBusy(false);
    if (error) setError(errorMessage(error));
    else router.back();
  }

  async function invite() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from('client_invites')
      .insert({ client_id: id, sent_to: phone.trim() || email.trim() || null })
      .select('token')
      .single();
    setBusy(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    const from = profile?.business_name || profile?.full_name || 'Your farrier';
    await Share.share({
      message: inviteMessage(
        data.token,
        `${from} invited you to see your horses' shoeing schedule and records.`,
      ),
    });
  }

  if (loading) return <Loading />;

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Add client' : fullName || 'Client' }} />
      <Field label="Name" value={fullName} onChangeText={setFullName} autoComplete="name" />
      <Field label="Mobile phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} loading={busy} disabled={!fullName.trim()} />

      {!isNew ? (
        <>
          <SectionTitle>Horses</SectionTitle>
          <View style={{ gap: 8 }}>
            {horses.map((h) => (
              <Card key={h.id} onPress={() => router.push({ pathname: '/horse/[id]', params: { id: h.id } })}>
                <ThemedText style={{ fontWeight: 600 }}>{h.name}</ThemedText>
              </Card>
            ))}
          </View>
          <Button
            title="Add a horse for this client"
            variant="secondary"
            onPress={() => router.push({ pathname: '/horse/new', params: { clientId: id } })}
          />
          <SectionTitle>App access</SectionTitle>
          {linked ? (
            <ThemedText themeColor="textSecondary">
              {fullName} is on the app and can see their horses&apos; records.
            </ThemedText>
          ) : (
            <Button title="Invite to the app" variant="secondary" onPress={invite} loading={busy} />
          )}
        </>
      ) : null}
    </Screen>
  );
}

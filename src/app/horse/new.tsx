import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, ErrorText, Field, Loading, Screen, Segmented } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/lib/auth';
import { INTERVAL_OPTIONS, SHOE_OPTIONS } from '@/lib/horse-options';
import { fetchClients, fetchMyBarns } from '@/lib/queries';
import { errorMessage, supabase } from '@/lib/supabase';
import type { ShoeStatus } from '@/lib/types';

const NONE = 'none';
const OWN = 'own';

export default function NewHorse() {
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { session, mode } = useAuth();
  const userId = session!.user.id;
  const farrier = mode === 'farrier';

  const { data, loading } = useQuery(
    async () => ({
      barns: await fetchMyBarns(userId),
      clients: farrier ? await fetchClients(userId) : [],
    }),
    `${userId}:${mode}`,
  );

  const [name, setName] = useState('');
  const [barnId, setBarnId] = useState<string>(NONE);
  const [owner, setOwner] = useState<string>(clientId ?? OWN);
  const [shoeStatus, setShoeStatus] = useState<ShoeStatus | null>(null);
  const [interval, setIntervalWeeks] = useState<string | null>(farrier ? '6' : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const location = barnId === NONE ? undefined : barnId;
      // horses has no insert policy; these functions also create the owner/provider rows.
      const { data: horseId, error } = farrier
        ? await supabase.rpc('create_horse_for_client', {
            p_name: name.trim(),
            p_client_id: owner === OWN ? undefined : owner,
            p_location_id: location,
          })
        : await supabase.rpc('create_own_horse', { p_name: name.trim(), p_location_id: location });
      if (error) throw error;

      if (shoeStatus) {
        const { error } = await supabase.from('horses').update({ shoe_status: shoeStatus }).eq('id', horseId);
        if (error) throw error;
      }
      if (farrier && interval) {
        const { error } = await supabase.rpc('set_shoeing_interval', { p_horse: horseId, p_weeks: Number(interval) });
        if (error) throw error;
      }
      router.replace({ pathname: '/horse/[id]', params: { id: horseId } });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (loading && !data) return <Loading />;

  return (
    <Screen>
      <Field label="Horse's name" value={name} onChangeText={setName} autoFocus />

      {farrier ? (
        <Segmented
          label="Owner"
          options={[
            { value: OWN, label: 'My own horse' },
            ...(data?.clients ?? []).map((c) => ({ value: c.id, label: c.full_name })),
          ]}
          value={owner}
          onChange={setOwner}
        />
      ) : null}
      {farrier && data?.clients.length === 0 ? (
        <Button
          title="Add a client first"
          variant="secondary"
          onPress={() => router.push({ pathname: '/client/[id]', params: { id: 'new' } })}
        />
      ) : null}

      <Segmented
        label="Barn"
        options={[
          { value: NONE, label: 'Not set' },
          ...(data?.barns ?? []).map((b) => ({ value: b.id, label: b.name })),
        ]}
        value={barnId}
        onChange={setBarnId}
      />
      <Button
        title="Add a barn"
        variant="secondary"
        onPress={() => router.push({ pathname: '/barn/[id]', params: { id: 'new' } })}
      />

      <Segmented label="Shoes" options={SHOE_OPTIONS} value={shoeStatus} onChange={setShoeStatus} />

      {farrier ? (
        <Segmented label="Shoeing interval" options={INTERVAL_OPTIONS} value={interval} onChange={setIntervalWeeks} />
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button title="Save horse" onPress={save} loading={busy} disabled={!name.trim()} />
    </Screen>
  );
}

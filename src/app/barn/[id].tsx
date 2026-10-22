import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { errorMessage, supabase } from '@/lib/supabase';

/** Create (id = "new") or edit a barn. Map pins come with the day route step. */
export default function BarnScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [canEdit, setCanEdit] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    supabase
      .from('locations')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(errorMessage(error));
        if (data) {
          setName(data.name);
          setAddress(data.address ?? '');
          setNotes(data.notes ?? '');
          setCanEdit(data.created_by === session?.user.id);
        }
        setLoading(false);
      });
  }, [id, isNew, session]);

  async function save() {
    setBusy(true);
    setError(null);
    const fields = { name: name.trim(), address: address.trim() || null, notes: notes.trim() || null };
    const { error } = isNew
      ? await supabase.from('locations').insert({ ...fields, created_by: session!.user.id })
      : await supabase.from('locations').update(fields).eq('id', id);
    setBusy(false);
    if (error) setError(errorMessage(error));
    else router.back();
  }

  async function archive() {
    setBusy(true);
    const { error } = await supabase.from('locations').update({ archived_at: new Date().toISOString() }).eq('id', id);
    setBusy(false);
    if (error) setError(errorMessage(error));
    else router.back();
  }

  if (loading) return <Loading />;

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Add barn' : name || 'Barn' }} />
      <Field label="Name" value={name} onChangeText={setName} editable={canEdit} placeholder="e.g. Willow Creek Stables" />
      <Field
        label="Address"
        value={address}
        onChangeText={setAddress}
        editable={canEdit}
        autoComplete="street-address"
        hint="Used for directions and the day route."
      />
      <Field
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        editable={canEdit}
        multiline
        placeholder="Gate code, where to park, who to ask for"
      />
      <ErrorText>{error}</ErrorText>
      {canEdit ? <Button title="Save" onPress={save} loading={busy} disabled={!name.trim()} /> : null}
      {canEdit && !isNew ? <Button title="Archive barn" variant="secondary" onPress={archive} /> : null}
    </Screen>
  );
}

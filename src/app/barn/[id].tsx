import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Field, Loading, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { errorMessage, supabase } from '@/lib/supabase';

/** Create (id = "new") or edit a barn, and pin it on the map for the day route. */
export default function BarnScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pinning, setPinning] = useState(false);
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
          if (data.latitude != null && data.longitude != null) {
            setPin({ latitude: data.latitude, longitude: data.longitude });
          }
          setCanEdit(data.created_by === session?.user.id);
        }
        setLoading(false);
      });
  }, [id, isNew, session]);

  async function save() {
    setBusy(true);
    setError(null);
    const fields = {
      name: name.trim(),
      address: address.trim() || null,
      notes: notes.trim() || null,
      latitude: pin?.latitude ?? null,
      longitude: pin?.longitude ?? null,
    };
    const { error } = isNew
      ? await supabase.from('locations').insert({ ...fields, created_by: session!.user.id })
      : await supabase.from('locations').update(fields).eq('id', id);
    setBusy(false);
    if (error) setError(errorMessage(error));
    else router.back();
  }

  async function pinFrom(source: 'address' | 'here') {
    setPinning(true);
    setError(null);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) throw new Error('Location permission is needed to pin the barn.');
      if (source === 'here') {
        const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setPin({ latitude: coords.latitude, longitude: coords.longitude });
      } else {
        const [match] = await Location.geocodeAsync(address.trim());
        if (!match) throw new Error("Couldn't find that address. Try pinning it while you're at the barn.");
        setPin({ latitude: match.latitude, longitude: match.longitude });
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPinning(false);
    }
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
      {canEdit ? (
        <>
          <SectionTitle>Map pin</SectionTitle>
          <ThemedText type="small" themeColor="textSecondary">
            {pin
              ? `Pinned at ${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}. Used for drive distances on your day route.`
              : 'Not pinned yet. Pin the barn so your day route can estimate drive distances.'}
          </ThemedText>
          {/* Address lookup uses the phone's geocoder, which the web build doesn't have. */}
          {Platform.OS !== 'web' && address.trim() ? (
            <Button title="Pin from address" variant="secondary" loading={pinning} onPress={() => pinFrom('address')} />
          ) : null}
          <Button title="Pin where I am now" variant="secondary" loading={pinning} onPress={() => pinFrom('here')} />
        </>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {canEdit ? <Button title="Save" onPress={save} loading={busy} disabled={!name.trim()} /> : null}
      {canEdit && !isNew ? <Button title="Archive barn" variant="secondary" onPress={archive} /> : null}
    </Screen>
  );
}

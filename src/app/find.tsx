import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, ErrorText, Field, Loading, Screen, SectionTitle, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { confirmAction } from '@/lib/confirm';
import { serviceLabels } from '@/lib/finder';
import { formatDistance } from '@/lib/geo';
import { formatMoney } from '@/lib/money';
import { fetchHorses } from '@/lib/queries';
import { errorMessage, supabase } from '@/lib/supabase';

type Farrier = Awaited<ReturnType<typeof search>>[number];
type Point = { latitude: number; longitude: number };

async function search(p: Point) {
  const { data, error } = await supabase.rpc('find_farriers', { p_lat: p.latitude, p_lng: p.longitude });
  if (error) throw error;
  return data;
}

/**
 * Owners find farriers who travel to their barn, and ask to become a
 * client. Farriers are only listed if they turned it on.
 */
export default function FindFarrier() {
  const params = useLocalSearchParams<{ horseId?: string }>();
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const unit = profile?.distance_unit ?? 'mi';
  const theme = useTheme();

  const { data: start, loading, refetch } = useQuery(async () => {
    const [horses, requests] = await Promise.all([fetchHorses(), supabase.rpc('my_farrier_requests')]);
    const mine = horses.filter((h) => h.horse_owners.some((o) => o.user_id === userId));
    const ids = [...new Set(mine.map((h) => h.location_id).filter((x): x is string => !!x))];
    const barns = ids.length
      ? ((await supabase.from('locations').select('id, name, latitude, longitude').in('id', ids)).data ?? [])
      : [];
    return { horses: mine, barns, requests: requests.data ?? [] };
  }, userId);

  const [from, setFrom] = useState<string | null>(null);
  const [place, setPlace] = useState('');
  const [results, setResults] = useState<Farrier[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);

  if (loading && !start) return <Loading />;
  const pinned = (start?.barns ?? []).filter((b) => b.latitude != null && b.longitude != null);
  const source = from ?? (pinned[0]?.id ?? 'place');

  async function find() {
    setSearching(true);
    setError(null);
    try {
      let point: Point | null = null;
      const barn = pinned.find((b) => b.id === source);
      if (barn) point = { latitude: barn.latitude!, longitude: barn.longitude! };
      else {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) throw new Error('Location permission is needed to search near you.');
        if (source === 'here') {
          const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          point = coords;
        } else {
          const [match] = await Location.geocodeAsync(place.trim());
          if (!match) throw new Error("Couldn't find that place. Try a town name.");
          point = match;
        }
      }
      setResults(await search(point));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSearching(false);
    }
  }

  const openRequests = (start?.requests ?? []).filter((r) => r.status === 'pending' || r.status === 'accepted');

  return (
    <Screen>
      {openRequests.length ? (
        <>
          <SectionTitle>Your requests</SectionTitle>
          {openRequests.map((r) => (
            <Card key={r.id}>
              <ThemedText style={{ fontWeight: 600 }}>
                {r.farrier_name} · {r.horse_name}
              </ThemedText>
              <ThemedText type="small" style={{ color: r.status === 'accepted' ? theme.success : theme.warning }}>
                {r.status === 'accepted' ? 'Accepted. They are now your farrier.' : 'Waiting for the farrier to answer'}
              </ThemedText>
              {r.status === 'pending' ? (
                <ThemedText
                  type="smallBold"
                  themeColor="accent"
                  onPress={async () => {
                    if (!(await confirmAction({ title: 'Cancel this request?', confirmLabel: 'Cancel request' }))) return;
                    const { error } = await supabase.rpc('cancel_client_request', { p_request: r.id });
                    if (error) setError(errorMessage(error));
                    else refetch();
                  }}>
                  Cancel request
                </ThemedText>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      <SectionTitle>Search near</SectionTitle>
      <Segmented
        options={[
          ...pinned.map((b) => ({ value: b.id, label: b.name })),
          { value: 'here', label: 'Where I am' },
          { value: 'place', label: 'A town' },
        ]}
        value={source}
        onChange={setFrom}
      />
      {source === 'place' ? <Field label="Town or area" value={place} onChangeText={setPlace} placeholder="e.g. Longmont, CO" /> : null}
      <Button
        title="Find farriers"
        onPress={find}
        loading={searching}
        disabled={source === 'place' && !place.trim()}
      />
      <ErrorText>{error}</ErrorText>

      {results && results.length === 0 ? (
        <EmptyState
          title="No farriers listed here yet"
          body="The app is new in many areas. If you already have a farrier, invite them so they can keep your horse's records here."
          action={
            start?.horses[0] ? (
              <Button
                title="Invite your farrier"
                variant="secondary"
                onPress={() => router.push({ pathname: '/horse/invite', params: { horseId: params.horseId ?? start.horses[0].id } })}
              />
            ) : undefined
          }
        />
      ) : null}

      {results?.map((f) => (
        <Card key={f.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }}>
            <ThemedText style={{ fontWeight: 600, flexShrink: 1 }}>{f.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDistance(f.distance_km, unit)}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {[
              f.service_area,
              f.years_experience ? `${f.years_experience} years` : null,
              f.certifications,
              f.price_from_cents ? `from ${formatMoney(f.price_from_cents, f.currency)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
          {f.services.length ? <ThemedText type="small">{serviceLabels(f.services).join(', ')}</ThemedText> : null}
          {f.bio ? <ThemedText type="small">{f.bio}</ThemedText> : null}
          {f.already_mine ? (
            <ThemedText type="smallBold" style={{ color: theme.success }}>
              Already your farrier
            </ThemedText>
          ) : f.requested ? (
            <ThemedText type="smallBold" style={{ color: theme.warning }}>
              Request sent
            </ThemedText>
          ) : !f.accepting ? (
            <ThemedText type="smallBold" themeColor="textSecondary">
              Not taking new clients right now
            </ThemedText>
          ) : asking === f.id ? (
            <AskForm
              farrier={f}
              horses={start?.horses ?? []}
              initialHorse={params.horseId}
              onDone={() => {
                setAsking(null);
                setResults((rs) => rs?.map((x) => (x.id === f.id ? { ...x, requested: true } : x)) ?? null);
                refetch();
              }}
              onCancel={() => setAsking(null)}
            />
          ) : (
            <Button title="Ask to become a client" variant="secondary" onPress={() => setAsking(f.id)} />
          )}
        </Card>
      ))}
    </Screen>
  );
}

function AskForm({
  farrier,
  horses,
  initialHorse,
  onDone,
  onCancel,
}: {
  farrier: Farrier;
  horses: { id: string; name: string }[];
  initialHorse?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [horse, setHorse] = useState<string | null>(initialHorse ?? horses[0]?.id ?? null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!horses.length) {
    return (
      <View style={{ gap: Spacing.two }}>
        <ThemedText type="small">Add your horse first, so the farrier knows who they would be shoeing.</ThemedText>
        <Button title="Add a horse" variant="secondary" onPress={() => router.push('/horse/new')} />
      </View>
    );
  }

  async function send() {
    if (!horse) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('request_farrier', { p_provider: farrier.id, p_horse: horse, p_message: message });
    setBusy(false);
    if (error) setError(errorMessage(error));
    else onDone();
  }

  return (
    <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
      <Segmented label="Which horse" options={horses.map((h) => ({ value: h.id, label: h.name }))} value={horse} onChange={setHorse} />
      <Field
        label={`Message to ${farrier.name}`}
        value={message}
        onChangeText={setMessage}
        multiline
        placeholder="e.g. 12-year-old gelding, barefoot, easy to handle. Boarded at Willow Creek."
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Send request" onPress={send} loading={busy} disabled={!horse} />
      <Button title="Cancel" variant="secondary" onPress={onCancel} />
    </View>
  );
}

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Field, Loading, Screen, SectionTitle, Segmented } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/lib/auth';
import { dueLabel, formatDate } from '@/lib/dates';
import { INTERVAL_OPTIONS, SHOE_OPTIONS } from '@/lib/horse-options';
import { usePendingVisits } from '@/lib/outbox';
import { fetchHorse, fetchHorseVisits, fetchMyBarns } from '@/lib/queries';
import { FLAG_TYPES, label, WORK_TYPES } from '@/lib/visit-options';
import { errorMessage, supabase } from '@/lib/supabase';
import type { ShoeStatus } from '@/lib/types';

const NONE = 'none';

export default function HorseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, mode } = useAuth();
  const userId = session!.user.id;

  const { data, error: loadError, loading, refetch } = useQuery(
    async () => {
      const [horse, barns, due, invites, visits] = await Promise.all([
        fetchHorse(id),
        fetchMyBarns(userId),
        supabase.from('due_horses').select('*').eq('horse_id', id),
        supabase
          .from('provider_invites')
          .select('id, sent_to, token, created_at')
          .eq('horse_id', id)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString()),
        fetchHorseVisits(id),
      ]);
      if (due.error) throw due.error;
      if (invites.error) throw invites.error;
      return { horse, barns, due: due.data, invites: invites.data, visits };
    },
    `${id}:${userId}`,
  );

  const horse = data?.horse;
  const isOwner = !!horse?.horse_owners.some((o) => o.user_id === userId);
  const farriers = horse?.horse_providers.filter((p) => p.role === 'farrier' && p.status === 'active') ?? [];
  const myLink = farriers.find((p) => p.user_id === userId);
  const myDue = data?.due.find((d) => d.provider_id === userId) ?? data?.due[0];

  if (loading && !data) return <Loading />;
  if (!horse) return <Screen><ErrorText>{loadError ?? 'Horse not found.'}</ErrorText></Screen>;

  return (
    <Screen>
      <Stack.Screen options={{ title: horse.name }} />

      {farriers.length > 0 ? (
        <Card>
          <ThemedText style={{ fontWeight: 600 }}>{dueLabel(myDue?.next_due ?? null)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Last shod {formatDate(myDue?.last_visit)}
            {myDue?.next_due ? ` · next ${formatDate(myDue.next_due)}` : ''}
          </ThemedText>
        </Card>
      ) : null}

      {myLink ? (
        <Segmented
          label="Shoeing interval"
          options={INTERVAL_OPTIONS}
          value={myLink.interval_weeks ? String(myLink.interval_weeks) : null}
          onChange={async (w) => {
            const { error } = await supabase.rpc('set_shoeing_interval', { p_horse: id, p_weeks: Number(w) });
            if (!error) refetch();
          }}
        />
      ) : null}

      {myLink ? (
        <Button
          title="Log a visit"
          onPress={() =>
            router.push({
              pathname: '/visit/new',
              params: { horseId: id, horseName: horse.name, interval: String(myLink.interval_weeks ?? '') },
            })
          }
        />
      ) : null}
      {myLink ? (
        <Button
          variant="secondary"
          title="Book a visit"
          onPress={() =>
            router.push({
              pathname: '/appointment/new',
              params: { horseIds: id, barnId: horse.location_id ?? '' },
            })
          }
        />
      ) : null}
      {isOwner && mode === 'owner' && farriers.length > 0 ? (
        <Button title="Request a visit" onPress={() => router.push({ pathname: '/request/new', params: { horseId: id } })} />
      ) : null}

      <SectionTitle>Farrier</SectionTitle>
      {farriers.map((f) => (
        <Card key={f.id}>
          <ThemedText style={{ fontWeight: 600 }}>
            {f.user_id === userId ? 'You' : f.profiles?.business_name || f.profiles?.full_name || 'Farrier'}
          </ThemedText>
          {f.interval_weeks ? (
            <ThemedText type="small" themeColor="textSecondary">
              Every {f.interval_weeks} weeks
            </ThemedText>
          ) : null}
        </Card>
      ))}
      {farriers.length === 0 ? (
        <ThemedText themeColor="textSecondary">No farrier yet.</ThemedText>
      ) : null}
      {data.invites.map((inv) => (
        <ThemedText key={inv.id} type="small" themeColor="textSecondary">
          Invite {inv.token} sent to {inv.sent_to}, waiting for them to join.
        </ThemedText>
      ))}
      {isOwner && mode === 'owner' ? (
        <Button
          title={farriers.length ? 'Invite a different farrier' : 'Invite your farrier'}
          variant={farriers.length ? 'secondary' : 'primary'}
          onPress={() => router.push({ pathname: '/horse/invite', params: { horseId: id } })}
        />
      ) : null}

      {mode === 'farrier' && horse.horse_owners.length > 0 ? (
        <>
          <SectionTitle>Owner</SectionTitle>
          {horse.horse_owners.map((o) =>
            o.clients ? (
              <Card
                key={o.id}
                onPress={() => router.push({ pathname: '/client/[id]', params: { id: o.clients!.id } })}>
                <ThemedText style={{ fontWeight: 600 }}>{o.clients.full_name}</ThemedText>
              </Card>
            ) : o.user_id === userId ? (
              <ThemedText key={o.id} themeColor="textSecondary">
                Your own horse
              </ThemedText>
            ) : null,
          )}
        </>
      ) : null}

      <SectionTitle>History</SectionTitle>
      <VisitHistory horseId={id} visits={data.visits} />

      <SectionTitle>Details</SectionTitle>
      <HorseDetailsForm key={horse.updated_at} horse={horse} barns={data.barns} onSaved={refetch} />
    </Screen>
  );
}

function VisitHistory({
  horseId,
  visits,
}: {
  horseId: string;
  visits: Awaited<ReturnType<typeof fetchHorseVisits>>;
}) {
  const { items: pending } = usePendingVisits();
  const waiting = pending.filter((p) => p.visit.horse_id === horseId);
  const rows = [
    ...waiting.map((p) => ({
      id: p.visit.id,
      date: p.visit.visit_date,
      work: p.visit.work_type ?? null,
      flags: p.flags.map((f) => f.flag_type),
      by: null as string | null,
      note: 'Waiting to upload',
    })),
    ...visits
      .filter((v) => !waiting.some((p) => p.visit.id === v.id))
      .map((v) => ({
        id: v.id,
        date: v.visit_date,
        work: v.work_type,
        flags: v.visit_flags.map((f) => f.flag_type),
        by: v.profiles?.business_name || v.profiles?.full_name || null,
        note: v.visit_photos.length ? `${v.visit_photos.length} photos` : null,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (rows.length === 0) return <ThemedText themeColor="textSecondary">No visits recorded yet.</ThemedText>;

  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => (
        <Card key={r.id} onPress={() => router.push({ pathname: '/visit/[id]', params: { id: r.id } })}>
          <ThemedText style={{ fontWeight: 600 }}>
            {formatDate(r.date)} · {label(WORK_TYPES, r.work) || 'Visit'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[r.by, r.flags.length ? r.flags.map((f) => label(FLAG_TYPES, f)).join(', ') : null, r.note]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        </Card>
      ))}
    </View>
  );
}

function HorseDetailsForm({
  horse,
  barns,
  onSaved,
}: {
  horse: NonNullable<Awaited<ReturnType<typeof fetchHorse>>>;
  barns: Awaited<ReturnType<typeof fetchMyBarns>>;
  onSaved: () => void;
}) {
  const [name, setName] = useState(horse.name);
  const [barnId, setBarnId] = useState(horse.location_id ?? NONE);
  const [shoeStatus, setShoeStatus] = useState<ShoeStatus | null>(horse.shoe_status);
  const [breed, setBreed] = useState(horse.breed ?? '');
  const [color, setColor] = useState(horse.color ?? '');
  const [discipline, setDiscipline] = useState(horse.discipline ?? '');
  const [foaled, setFoaled] = useState(horse.foaled_year ? String(horse.foaled_year) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Include the horse's current barn even if someone else created it.
  const barnOptions = [
    { value: NONE, label: 'Not set' },
    ...barns.map((b) => ({ value: b.id, label: b.name })),
    ...(horse.locations && !barns.some((b) => b.id === horse.locations!.id)
      ? [{ value: horse.locations.id, label: horse.locations.name }]
      : []),
  ];

  async function save() {
    setBusy(true);
    setError(null);
    const year = foaled.trim() ? Number(foaled.trim()) : null;
    const { error } = await supabase
      .from('horses')
      .update({
        name: name.trim(),
        location_id: barnId === NONE ? null : barnId,
        shoe_status: shoeStatus,
        breed: breed.trim() || null,
        color: color.trim() || null,
        discipline: discipline.trim() || null,
        foaled_year: year && Number.isFinite(year) ? year : null,
      })
      .eq('id', horse.id);
    setBusy(false);
    if (error) setError(errorMessage(error));
    else onSaved();
  }

  async function archive() {
    setBusy(true);
    const { error } = await supabase.from('horses').update({ archived_at: new Date().toISOString() }).eq('id', horse.id);
    setBusy(false);
    if (error) setError(errorMessage(error));
    else router.back();
  }

  return (
    <View style={{ gap: 16 }}>
      <Field label="Name" value={name} onChangeText={setName} />
      <Segmented label="Barn" options={barnOptions} value={barnId} onChange={setBarnId} />
      <Segmented label="Shoes" options={SHOE_OPTIONS} value={shoeStatus} onChange={setShoeStatus} />
      <Field label="Breed" value={breed} onChangeText={setBreed} />
      <Field label="Color" value={color} onChangeText={setColor} />
      <Field label="Discipline" value={discipline} onChangeText={setDiscipline} placeholder="e.g. Hunter/jumper, trail" />
      <Field label="Year foaled" value={foaled} onChangeText={setFoaled} keyboardType="number-pad" maxLength={4} />
      <ErrorText>{error}</ErrorText>
      <Button title="Save details" onPress={save} loading={busy} disabled={!name.trim()} />
      <Button title="Archive horse" variant="secondary" onPress={archive} />
    </View>
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button, DateStepper, EmptyState, ErrorText, Field, Loading, Screen, Segmented } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/lib/auth';
import { fetchHorses } from '@/lib/queries';
import { addDays, formatDay, startOfDay, toDateString } from '@/lib/schedule';
import { errorMessage, supabase } from '@/lib/supabase';

type Urgency = 'routine' | 'urgent';

/** Owner asks their horse's farrier for a visit, with a preferred range of days. */
export default function NewRequest() {
  const { horseId } = useLocalSearchParams<{ horseId?: string }>();
  const { session } = useAuth();
  const userId = session!.user.id;

  const { data, loading } = useQuery(async () => {
    const horses = await fetchHorses();
    // Only the person's own horses that have a farrier to ask.
    return horses
      .filter((h) => h.horse_owners.some((o) => o.user_id === userId))
      .map((h) => ({
        ...h,
        farrier: h.horse_providers.find((p) => p.role === 'farrier' && p.status === 'active'),
      }))
      .filter((h) => !!h.farrier);
  }, userId);

  const today = startOfDay(new Date());
  const [picked, setPicked] = useState<string | null>(horseId ?? null);
  const [from, setFrom] = useState(addDays(today, 1));
  const [to, setTo] = useState(addDays(today, 7));
  const [urgency, setUrgency] = useState<Urgency>('routine');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  const horses = data ?? [];
  const horse = horses.find((h) => h.id === picked) ?? (horses.length === 1 ? horses[0] : undefined);

  if (horses.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="No farrier to ask yet"
          body="Invite your farrier from your horse's page first. Once they join, you can request visits here."
        />
      </Screen>
    );
  }

  async function send() {
    if (!horse?.farrier) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('visit_requests').insert({
      horse_id: horse.id,
      requested_by: userId,
      requested_provider_id: horse.farrier.user_id,
      preferred_start: toDateString(from),
      preferred_end: toDateString(to < from ? from : to),
      urgency,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) setError(errorMessage(error));
    else router.back();
  }

  return (
    <Screen>
      <Segmented
        label="Horse"
        options={horses.map((h) => ({ value: h.id, label: h.name }))}
        value={horse?.id ?? null}
        onChange={setPicked}
      />
      <DateStepper label="Earliest day" value={from} onChange={setFrom} min={today} format={formatDay} />
      <DateStepper label="Latest day" value={to < from ? from : to} onChange={setTo} min={from} format={formatDay} />
      <Segmented
        label="How soon"
        options={[
          { value: 'routine', label: 'Routine' },
          { value: 'urgent', label: 'Urgent (lost shoe, lame)' },
        ]}
        value={urgency}
        onChange={setUrgency}
      />
      <Field
        label="Notes for your farrier"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="e.g. Lost a front shoe, only free mornings"
      />
      <ThemedText type="small" themeColor="textSecondary">
        Your farrier will pick a day and arrival window, and you&apos;ll confirm it here.
      </ThemedText>
      <ErrorText>{error}</ErrorText>
      <Button title="Send request" onPress={send} loading={busy} disabled={!horse} />
    </Screen>
  );
}

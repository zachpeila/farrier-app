import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, DateStepper, ErrorText, Field, Loading, MultiSelect, Screen, Segmented } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { fetchHorses } from '@/lib/queries';
import {
  addDays,
  atMinutes,
  formatDay,
  minutesLabel,
  startOfDay,
  WINDOW_LENGTHS,
  WINDOW_STARTS,
} from '@/lib/schedule';
import { errorMessage, supabase } from '@/lib/supabase';

const NONE = 'none';

/**
 * Farrier books a stop: one barn, a day, an arrival window, and the
 * horses to do there. Opened from the due list (barn + horses), a horse,
 * or an owner's visit request.
 */
export default function NewAppointment() {
  const params = useLocalSearchParams<{ barnId?: string; horseIds?: string; requestId?: string }>();
  const { session } = useAuth();
  const userId = session!.user.id;

  const { data, loading } = useQuery(async () => {
    const horses = (await fetchHorses()).filter((h) =>
      h.horse_providers.some((p) => p.user_id === userId && p.role === 'farrier' && p.status === 'active'),
    );
    const request = params.requestId
      ? (await supabase.from('visit_requests').select('*').eq('id', params.requestId).single()).data
      : null;
    return { horses, request };
  }, `${userId}:${params.requestId}`);

  const requestHorse = data?.request?.horse_id;
  const initialHorses = params.horseIds?.split(',').filter(Boolean) ?? [];
  const [picked, setPicked] = useState<string[] | null>(null);
  const horseIds = picked ?? (requestHorse ? [requestHorse] : initialHorses);

  const [barn, setBarn] = useState<string | null>(params.barnId || null);
  const firstHorse = data?.horses.find((h) => h.id === horseIds[0]);
  const barnId = barn ?? firstHorse?.location_id ?? NONE;

  const preferred = data?.request?.preferred_start;
  const [day, setDay] = useState<Date | null>(null);
  const today = startOfDay(new Date());
  const defaultDay = preferred && new Date(`${preferred}T00:00`) > today ? new Date(`${preferred}T00:00`) : addDays(today, 1);
  const date = day ?? defaultDay;

  const [start, setStart] = useState('480'); // 8:00 AM
  const [length, setLength] = useState('120');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  const horses = data?.horses ?? [];

  // Barns that have the farrier's horses in them.
  const barns = new Map<string, string>();
  for (const h of horses) if (h.locations) barns.set(h.locations.id, h.locations.name);

  const horseOptions = horses
    .filter((h) => barnId === NONE || h.location_id === barnId || horseIds.includes(h.id))
    .map((h) => ({ value: h.id, label: h.name }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const request = data?.request;
      if (request?.status === 'pending') {
        const { error } = await supabase.rpc('respond_to_visit_request', { p_request: request.id, p_accept: true });
        if (error) throw error;
      }
      const startAt = atMinutes(date, Number(start));
      const endAt = new Date(startAt.getTime() + Number(length) * 60_000);
      const { data: appt, error } = await supabase
        .from('appointments')
        .insert({
          provider_id: userId,
          location_id: barnId === NONE ? null : barnId,
          request_id: request?.id ?? null,
          scheduled_start: startAt.toISOString(),
          scheduled_end: endAt.toISOString(),
          notes: notes.trim() || null,
        })
        .select('id')
        .single();
      if (error) throw error;
      const { error: horsesError } = await supabase
        .from('appointment_horses')
        .insert(horseIds.map((horse_id) => ({ appointment_id: appt.id, horse_id })));
      if (horsesError) {
        // Don't leave an empty stop behind.
        await supabase.from('appointments').delete().eq('id', appt.id);
        throw horsesError;
      }
      router.replace({ pathname: '/appointment/[id]', params: { id: appt.id } });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      {data?.request ? (
        <Card>
          <ThemedText style={{ fontWeight: 600 }}>
            {data.request.urgency === 'urgent' ? 'Urgent request' : 'Visit request'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {data.request.preferred_start
              ? `Prefers ${formatDate(data.request.preferred_start)}${
                  data.request.preferred_end ? ` to ${formatDate(data.request.preferred_end)}` : ''
                }`
              : 'No preferred dates'}
          </ThemedText>
          {data.request.notes ? <ThemedText type="small">{data.request.notes}</ThemedText> : null}
        </Card>
      ) : null}

      <Segmented
        label="Barn"
        options={[{ value: NONE, label: 'Not set' }, ...[...barns].map(([value, label]) => ({ value, label }))]}
        value={barnId}
        onChange={setBarn}
      />
      <MultiSelect label="Horses" options={horseOptions} values={horseIds} onChange={setPicked} />
      {horseOptions.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No horses at this barn yet.
        </ThemedText>
      ) : null}

      <DateStepper label="Day" value={date} onChange={setDay} min={today} format={formatDay} />
      <Segmented
        label="Arrive between"
        options={WINDOW_STARTS.map((m) => ({ value: String(m), label: minutesLabel(m) }))}
        value={start}
        onChange={setStart}
      />
      <Segmented label="Window" options={WINDOW_LENGTHS} value={length} onChange={setLength} />
      <ThemedText themeColor="textSecondary">
        Owners will see: {formatDay(date)}, arriving {minutesLabel(Number(start))} –{' '}
        {minutesLabel(Number(start) + Number(length))}.
      </ThemedText>

      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Anything the owner should know" />
      <ErrorText>{error}</ErrorText>
      <Button title="Book visit" onPress={save} loading={busy} disabled={horseIds.length === 0} />
    </Screen>
  );
}

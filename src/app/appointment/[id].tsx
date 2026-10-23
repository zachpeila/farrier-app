import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, DateStepper, ErrorText, Loading, Screen, SectionTitle, Segmented } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { fetchAppointment } from '@/lib/queries';
import {
  atMinutes,
  formatDay,
  formatWindow,
  minutesLabel,
  minutesOf,
  startOfDay,
  WINDOW_LENGTHS,
  WINDOW_STARTS,
} from '@/lib/schedule';
import { errorMessage, supabase } from '@/lib/supabase';

export default function AppointmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const theme = useTheme();
  const { data: appt, error: loadError, loading, refetch } = useQuery(() => fetchAppointment(id), id);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading && !appt) return <Loading />;
  if (!appt) return <Screen><ErrorText>{loadError ?? 'Visit not found.'}</ErrorText></Screen>;

  const isFarrier = appt.provider_id === session!.user.id;
  const start = new Date(appt.scheduled_start);
  const farrierName = appt.profiles?.business_name || appt.profiles?.full_name || 'Your farrier';
  const cancelled = appt.status === 'cancelled';

  async function run(action: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError(null);
    const { error } = await action();
    setBusy(false);
    if (error) setError(errorMessage(error));
    else refetch();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: formatDay(start) }} />
      <Card>
        <ThemedText type="subtitle">{formatWindow(appt.scheduled_start, appt.scheduled_end)}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </ThemedText>
        <ThemedText
          type="smallBold"
          style={{ color: cancelled ? theme.danger : appt.status === 'completed' || appt.owner_confirmed_at ? theme.success : theme.warning }}>
          {cancelled
            ? 'Cancelled'
            : appt.status === 'completed'
              ? 'Done'
              : appt.owner_confirmed_at ? 'Confirmed by owner' : 'Waiting for owner to confirm'}
        </ThemedText>
      </Card>

      <SectionTitle>Where</SectionTitle>
      {appt.locations ? (
        <Card
          onPress={
            appt.locations.address
              ? () => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(appt.locations!.address!)}`)
              : undefined
          }>
          <ThemedText style={{ fontWeight: 600 }}>{appt.locations.name}</ThemedText>
          {appt.locations.address ? (
            <ThemedText type="small" themeColor="textSecondary">
              {appt.locations.address} · Directions
            </ThemedText>
          ) : null}
        </Card>
      ) : (
        <ThemedText themeColor="textSecondary">No barn set.</ThemedText>
      )}

      <SectionTitle>Horses</SectionTitle>
      <View style={{ gap: 8 }}>
        {appt.appointment_horses.map((ah) => (
          <Card key={ah.horse_id} onPress={() => router.push({ pathname: '/horse/[id]', params: { id: ah.horse_id } })}>
            <ThemedText style={{ fontWeight: 600 }}>{ah.horses?.name ?? 'Horse'}</ThemedText>
            {isFarrier && !cancelled ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/visit/new',
                    params: { horseId: ah.horse_id, horseName: ah.horses?.name ?? '', appointmentId: appt.id },
                  })
                }>
                <ThemedText type="smallBold" themeColor="accent">
                  Log visit
                </ThemedText>
              </Pressable>
            ) : null}
          </Card>
        ))}
      </View>

      {appt.notes ? (
        <>
          <SectionTitle>Notes</SectionTitle>
          <ThemedText>{appt.notes}</ThemedText>
        </>
      ) : null}

      {!isFarrier ? (
        <>
          <SectionTitle>Farrier</SectionTitle>
          <ThemedText>{farrierName}</ThemedText>
          {appt.profiles?.phone ? (
            <Button
              title={`Call or text ${appt.profiles.phone}`}
              variant="secondary"
              onPress={() => Linking.openURL(`tel:${appt.profiles!.phone}`)}
            />
          ) : null}
        </>
      ) : null}

      <ErrorText>{error}</ErrorText>

      {!isFarrier && !cancelled && !appt.owner_confirmed_at ? (
        <Button
          title="Confirm this time"
          loading={busy}
          onPress={() => run(() => supabase.rpc('confirm_appointment', { p_appointment: id }))}
        />
      ) : null}

      {isFarrier && appt.status === 'scheduled' && !editing ? (
        <>
          <Button
            title="Mark visit done"
            loading={busy}
            onPress={() => run(() => supabase.from('appointments').update({ status: 'completed' }).eq('id', id))}
          />
          <Button title="Change time" variant="secondary" onPress={() => setEditing(true)} />
          <Button
            title="Cancel visit"
            variant="danger"
            loading={busy}
            onPress={() => run(() => supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id))}
          />
        </>
      ) : null}

      {isFarrier && editing ? (
        <ChangeWindow
          start={start}
          end={appt.scheduled_end ? new Date(appt.scheduled_end) : null}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSave={(s, e) =>
            run(async () => {
              const res = await supabase
                .from('appointments')
                .update({ scheduled_start: s.toISOString(), scheduled_end: e.toISOString() })
                .eq('id', id);
              if (!res.error) setEditing(false);
              return res;
            })
          }
        />
      ) : null}
    </Screen>
  );
}

function ChangeWindow({
  start,
  end,
  busy,
  onSave,
  onCancel,
}: {
  start: Date;
  end: Date | null;
  busy: boolean;
  onSave: (start: Date, end: Date) => void;
  onCancel: () => void;
}) {
  const [day, setDay] = useState(startOfDay(start));
  const [startMin, setStartMin] = useState(String(minutesOf(start)));
  const initialLength = end ? Math.round((end.getTime() - start.getTime()) / 60_000) : 120;
  const [length, setLength] = useState(
    WINDOW_LENGTHS.some((l) => l.value === String(initialLength)) ? String(initialLength) : '120',
  );
  const starts = WINDOW_STARTS.includes(Number(startMin)) ? WINDOW_STARTS : [...WINDOW_STARTS, Number(startMin)].sort((a, b) => a - b);

  return (
    <>
      <SectionTitle>New time</SectionTitle>
      <DateStepper label="Day" value={day} onChange={setDay} min={startOfDay(new Date())} format={formatDay} />
      <Segmented
        label="Arrive between"
        options={starts.map((m) => ({ value: String(m), label: minutesLabel(m) }))}
        value={startMin}
        onChange={setStartMin}
      />
      <Segmented label="Window" options={WINDOW_LENGTHS} value={length} onChange={setLength} />
      <ThemedText type="small" themeColor="textSecondary">
        The owner will be asked to confirm the new time.
      </ThemedText>
      <Button
        title="Save new time"
        loading={busy}
        onPress={() => {
          const s = atMinutes(day, Number(startMin));
          onSave(s, new Date(s.getTime() + Number(length) * 60_000));
        }}
      />
      <Button title="Keep current time" variant="secondary" onPress={onCancel} />
    </>
  );
}

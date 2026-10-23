import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, ErrorText, Loading, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import {
  fetchOpenRequests,
  fetchUpcomingAppointments,
  type AppointmentItem,
  type RequestItem,
} from '@/lib/queries';
import { formatDay, formatWindow, toDateString } from '@/lib/schedule';
import { errorMessage, supabase } from '@/lib/supabase';

/**
 * Farrier: open visit requests, then upcoming stops by day.
 * Owner: upcoming visits for their horses (to confirm), and their requests.
 */
export default function Schedule() {
  const { session, mode } = useAuth();
  const userId = session!.user.id;
  const farrier = mode === 'farrier';
  const { data, error, loading, refetch } = useQuery(async () => {
    const [appointments, requests] = await Promise.all([fetchUpcomingAppointments(), fetchOpenRequests()]);
    return { appointments, requests };
  }, userId);

  if (loading && !data) return <Loading />;

  // A farrier's own appointments only; an owner sees their horses' visits.
  const appointments = (data?.appointments ?? []).filter((a) => (farrier ? a.provider_id === userId : true));
  const bookedRequests = new Set(appointments.map((a) => a.request_id).filter(Boolean));
  const requests = (data?.requests ?? []).filter((r) =>
    farrier ? r.requested_provider_id === userId : r.requested_by === userId,
  );
  const toHandle = farrier ? requests.filter((r) => !bookedRequests.has(r.id)) : requests;

  const byDay = new Map<string, AppointmentItem[]>();
  for (const a of appointments) {
    const day = formatDay(new Date(a.scheduled_start));
    byDay.set(day, [...(byDay.get(day) ?? []), a]);
  }

  return (
    <Screen>
      {farrier ? (
        <Button title="Book a visit" onPress={() => router.push('/appointment/new')} />
      ) : (
        <Button title="Request a visit" onPress={() => router.push('/request/new')} />
      )}
      <ErrorText>{error}</ErrorText>

      {toHandle.length > 0 ? (
        <View style={styles.group}>
          <SectionTitle>{farrier ? 'Requests' : 'Your requests'}</SectionTitle>
          {toHandle.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              farrier={farrier}
              booked={bookedRequests.has(r.id)}
              onChanged={refetch}
            />
          ))}
        </View>
      ) : null}

      {data && appointments.length === 0 && toHandle.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          body={
            farrier
              ? 'Book visits from here, from a horse, or from a barn on your due list.'
              : 'When your farrier books a visit, it shows up here for you to confirm.'
          }
        />
      ) : null}

      {[...byDay].map(([day, items]) => (
        <View key={day} style={styles.group}>
          <View style={styles.row}>
            <SectionTitle>{day}</SectionTitle>
            {farrier ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/route',
                    params: { date: toDateString(new Date(items[0].scheduled_start)) },
                  })
                }>
                <ThemedText type="smallBold" themeColor="accent">
                  Day route
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
          {items.map((a) => (
            <AppointmentCard key={a.id} appt={a} farrier={farrier} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

function AppointmentCard({ appt, farrier }: { appt: AppointmentItem; farrier: boolean }) {
  const theme = useTheme();
  const horses = appt.appointment_horses.map((ah) => ah.horses?.name).filter(Boolean);
  const who = farrier ? appt.locations?.name : appt.profiles?.business_name || appt.profiles?.full_name;
  return (
    <Card onPress={() => router.push({ pathname: '/appointment/[id]', params: { id: appt.id } })}>
      <View style={styles.row}>
        <ThemedText style={{ fontWeight: 600 }}>{formatWindow(appt.scheduled_start, appt.scheduled_end)}</ThemedText>
        <ThemedText type="smallBold" style={{ color: appt.owner_confirmed_at ? theme.success : theme.warning }}>
          {appt.owner_confirmed_at ? 'Confirmed' : farrier ? 'Unconfirmed' : 'Please confirm'}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {[who, horses.join(', ')].filter(Boolean).join(' · ')}
      </ThemedText>
    </Card>
  );
}

const STATUS_LABELS = { pending: 'Waiting for farrier', accepted: 'Accepted, not booked yet' } as const;

function RequestCard({
  request,
  farrier,
  booked,
  onChanged,
}: {
  request: RequestItem;
  farrier: boolean;
  booked: boolean;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dates = request.preferred_start
    ? `${formatDate(request.preferred_start)}${request.preferred_end ? ` – ${formatDate(request.preferred_end)}` : ''}`
    : 'Any time';
  const who = farrier
    ? request.requester?.full_name
    : request.provider?.business_name || request.provider?.full_name;

  async function run(action: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError(null);
    const { error } = await action();
    setBusy(false);
    if (error) setError(errorMessage(error));
    else onChanged();
  }

  return (
    <Card>
      <View style={styles.row}>
        <ThemedText style={{ fontWeight: 600, flexShrink: 1 }}>{request.horses?.name ?? 'Horse'}</ThemedText>
        {request.urgency === 'urgent' ? (
          <ThemedText type="smallBold" style={{ color: theme.danger }}>
            Urgent
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {[who, dates, request.horses?.locations?.name].filter(Boolean).join(' · ')}
      </ThemedText>
      {request.notes ? <ThemedText type="small">{request.notes}</ThemedText> : null}
      {!farrier ? (
        <ThemedText type="small" themeColor="textSecondary">
          {booked ? 'Booked' : STATUS_LABELS[request.status as keyof typeof STATUS_LABELS]}
        </ThemedText>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <View style={styles.actions}>
        {farrier ? (
          <>
            <Button
              title={request.status === 'pending' ? 'Accept and book' : 'Book'}
              onPress={() => router.push({ pathname: '/appointment/new', params: { requestId: request.id } })}
            />
            {request.status === 'pending' ? (
              <Button
                title="Decline"
                variant="secondary"
                loading={busy}
                onPress={() =>
                  run(() => supabase.rpc('respond_to_visit_request', { p_request: request.id, p_accept: false }))
                }
              />
            ) : null}
          </>
        ) : (
          <Button
            title="Cancel request"
            variant="secondary"
            loading={busy}
            onPress={() => run(() => supabase.rpc('cancel_visit_request', { p_request: request.id }))}
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
});

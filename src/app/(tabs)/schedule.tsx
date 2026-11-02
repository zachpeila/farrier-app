import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { OutboxBanner } from '@/components/outbox-banner';
import { ThemedText } from '@/components/themed-text';
import { WeekView } from '@/components/week-view';
import { Button, Card, EmptyState, ErrorText, Loading, Screen, SectionTitle, Segmented } from '@/components/ui';
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
import { confirmAction } from '@/lib/confirm';

/**
 * Farrier: open visit requests, then upcoming stops by day.
 * Owner: upcoming visits for their horses (to confirm), and their requests.
 */
export default function Schedule() {
  const { session, mode } = useAuth();
  const userId = session!.user.id;
  const farrier = mode === 'farrier';
  const [view, setView] = useState<'list' | 'week'>('list');
  const { data, error, loading, refetch } = useQuery(async () => {
    const [appointments, requests, newClients] = await Promise.all([
      fetchUpcomingAppointments(),
      fetchOpenRequests(),
      farrier ? supabase.rpc('incoming_client_requests') : Promise.resolve({ data: [] }),
    ]);
    return { appointments, requests, newClients: newClients.data ?? [] };
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
      <Segmented
        options={[
          { value: 'list', label: 'Coming up' },
          { value: 'week', label: 'Week' },
        ]}
        value={view}
        onChange={setView}
      />
      <ErrorText>{error}</ErrorText>
      <OutboxBanner />
      {view === 'week' ? <WeekView userId={userId} farrier={farrier} /> : null}

      {view === 'list' && (data?.newClients.length ?? 0) > 0 ? (
        <View style={styles.group}>
          <SectionTitle>New client requests</SectionTitle>
          {data!.newClients.map((r) => (
            <ClientRequestCard key={r.id} request={r} onChanged={refetch} />
          ))}
        </View>
      ) : null}

      {view === 'list' && toHandle.length > 0 ? (
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

      {view === 'list' && data && appointments.length === 0 && toHandle.length === 0 && data.newClients.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          body={
            farrier
              ? 'Book visits from here, from a horse, or from a barn on your due list.'
              : 'When your farrier books a visit, it shows up here for you to confirm.'
          }
        />
      ) : null}

      {(view === 'list' ? [...byDay] : []).map(([day, items]) => (
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
          {appt.owner_confirmed_at
            ? 'Confirmed'
            : appt.owner_change_request
              ? farrier
                ? 'Owner wants to change'
                : 'Change asked'
              : farrier
                ? 'Unconfirmed'
                : 'Please confirm'}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {[who, horses.join(', ')].filter(Boolean).join(' · ')}
      </ThemedText>
    </Card>
  );
}

type ClientRequest = {
  id: string;
  owner_name: string;
  owner_phone: string | null;
  horse_id: string;
  horse_name: string;
  barn_name: string | null;
  barn_address: string | null;
  message: string | null;
};

/** An owner who found the farrier in Find a farrier and asked to become a client. */
function ClientRequestCard({ request, onChanged }: { request: ClientRequest; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(accept: boolean) {
    if (!accept && !(await confirmAction({ title: `Decline ${request.owner_name}?`, confirmLabel: 'Decline' }))) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc('respond_client_request', { p_request: request.id, p_accept: accept });
    setBusy(false);
    if (error) setError(errorMessage(error));
    else if (accept) router.push({ pathname: '/horse/[id]', params: { id: data } });
    else onChanged();
  }

  return (
    <Card>
      <ThemedText style={{ fontWeight: 600 }}>
        {request.owner_name} · {request.horse_name}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {[request.barn_name, request.barn_address, request.owner_phone].filter(Boolean).join(' · ') || 'No barn set yet'}
      </ThemedText>
      {request.message ? <ThemedText type="small">{request.message}</ThemedText> : null}
      <ErrorText>{error}</ErrorText>
      <View style={styles.actions}>
        <Button title="Accept as a client" loading={busy} onPress={() => respond(true)} />
        <Button title="Decline" variant="secondary" onPress={() => respond(false)} />
      </View>
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
                onPress={async () => {
                  if (await confirmAction({ title: 'Decline this request?', confirmLabel: 'Decline' }))
                    run(() => supabase.rpc('respond_to_visit_request', { p_request: request.id, p_accept: false }));
                }}
              />
            ) : null}
          </>
        ) : (
          <Button
            title="Cancel request"
            variant="secondary"
            loading={busy}
            onPress={async () => {
              if (await confirmAction({ title: 'Cancel this request?', confirmLabel: 'Cancel request' }))
                run(() => supabase.rpc('cancel_visit_request', { p_request: request.id }));
            }}
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

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Loading, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { fetchAppointment } from '@/lib/queries';
import { addDays, toDateString } from '@/lib/schedule';
import { createStopInvoices, loadStop } from '@/lib/stop-invoices';
import { errorMessage, supabase } from '@/lib/supabase';
import { label, WORK_TYPES } from '@/lib/visit-options';

/**
 * Wraps up a barn stop in one place: log each horse, make every owner's
 * invoice at once, then book the next visit for the same horses.
 */
export default function FinishStop() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, error: loadError, loading, refetch } = useQuery(async () => {
    const [appt, stop, intervals] = await Promise.all([
      fetchAppointment(id),
      loadStop(id, userId),
      supabase.from('horse_providers').select('horse_id, interval_weeks').eq('user_id', userId),
    ]);
    return { appt, ...stop, intervals: intervals.data ?? [] };
  }, `${id}:${userId}`);

  if (loading && !data) return <Loading />;
  if (!data) return <Screen><ErrorText>{loadError ?? 'Visit not found.'}</ErrorText></Screen>;

  const { appt, horses, invoices } = data;
  const logged = horses.filter((h) => h.visit);
  const done = appt.status === 'completed';
  const ownersToBill = new Set(logged.map((h) => h.clientId).filter(Boolean));
  const missingInvoices = [...ownersToBill].filter((c) => !invoices.some((i) => i.client_id === c)).length;

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      if (!done) {
        const { error } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', id);
        if (error) throw error;
      }
      if (missingInvoices > 0) await createStopInvoices(id, userId, profile?.trip_fee_cents ?? 0);
      await refetch();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function bookNext() {
    // Next visit: the soonest interval among these horses, from today.
    const weeks = horses
      .map((h) => data!.intervals.find((i) => i.horse_id === h.id)?.interval_weeks)
      .filter((w): w is number => !!w);
    const next = addDays(new Date(), 7 * (weeks.length ? Math.min(...weeks) : 6));
    router.push({
      pathname: '/appointment/new',
      params: {
        barnId: appt.location_id ?? '',
        horseIds: horses.map((h) => h.id).join(','),
        day: toDateString(next),
      },
    });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: appt.locations?.name ? `Finish: ${appt.locations.name}` : 'Finish stop' }} />

      <SectionTitle>1. Log each horse</SectionTitle>
      {horses.map((h) => (
        <Card
          key={h.id}
          onPress={
            h.visit
              ? () => router.push({ pathname: '/visit/[id]', params: { id: h.visit!.id } })
              : () =>
                  router.push({
                    pathname: '/visit/new',
                    params: { horseId: h.id, horseName: h.name, appointmentId: id },
                  })
          }>
          <View style={styles.row}>
            <ThemedText style={{ fontWeight: 600, flexShrink: 1 }}>{h.name}</ThemedText>
            {h.visit ? (
              <ThemedText type="smallBold" style={{ color: theme.success }}>
                {label(WORK_TYPES, h.visit.workType) || 'Logged'}
                {h.visit.uploaded ? '' : ' · on phone'}
              </ThemedText>
            ) : (
              <ThemedText type="smallBold" themeColor="accent">
                Log visit
              </ThemedText>
            )}
          </View>
          {h.clientName ? (
            <ThemedText type="small" themeColor="textSecondary">
              {h.clientName}
            </ThemedText>
          ) : null}
        </Card>
      ))}

      <SectionTitle>2. Bill the owners</SectionTitle>
      {invoices.map((inv) => (
        <Pressable
          key={inv.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: inv.id } })}>
          <Card>
            <View style={styles.row}>
              <ThemedText style={{ fontWeight: 600, flexShrink: 1 }}>
                {horses.find((h) => h.clientId === inv.client_id)?.clientName ?? 'Invoice'} · #{inv.invoice_number}
              </ThemedText>
              <ThemedText type="smallBold" themeColor="accent">
                {inv.status === 'draft' ? 'Review and send' : inv.status === 'paid' ? 'Paid' : 'Sent'}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(inv.total_cents ?? 0, inv.currency)}
            </ThemedText>
          </Card>
        </Pressable>
      ))}
      {logged.length === 0 ? (
        <ThemedText themeColor="textSecondary">Log at least one horse to make invoices.</ThemedText>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {logged.length > 0 && (missingInvoices > 0 || !done) ? (
        <Button
          title={
            missingInvoices > 0
              ? `Finish stop and make ${missingInvoices} ${missingInvoices === 1 ? 'invoice' : 'invoices'}`
              : 'Mark stop done'
          }
          loading={busy}
          onPress={finish}
        />
      ) : null}
      {logged.length < horses.length && logged.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Horses not logged aren&apos;t billed.
        </ThemedText>
      ) : null}

      <SectionTitle>3. Book the next visit</SectionTitle>
      <Button title="Book next visit for these horses" variant={done ? 'primary' : 'secondary'} onPress={bookNext} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
});

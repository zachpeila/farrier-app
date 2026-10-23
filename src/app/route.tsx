import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, DateStepper, EmptyState, ErrorText, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { drivingKm, formatDistance, mapsRouteUrl } from '@/lib/geo';
import { fetchDayStops, type DayStop } from '@/lib/queries';
import { formatDay, formatWindow, startOfDay, toDateString } from '@/lib/schedule';
import { errorMessage, supabase } from '@/lib/supabase';

/**
 * A farrier's day: stops in driving order with estimated distances between
 * pinned barns. Reordering saves route_order and planned_km on each stop.
 */
export default function DayRoute() {
  const params = useLocalSearchParams<{ date?: string }>();
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const unit = profile?.distance_unit ?? 'mi';
  const theme = useTheme();

  const [day, setDay] = useState(() => (params.date ? new Date(`${params.date}T00:00`) : startOfDay(new Date())));
  const { data, error: loadError, loading, refetch } = useQuery(
    () => fetchDayStops(userId, day),
    `${userId}:${toDateString(day)}`,
  );
  // Local order while saving, so the list doesn't jump back.
  const [order, setOrder] = useState<{ key: string; ids: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayKey = toDateString(day);
  const stops = (() => {
    const all = data ?? [];
    if (order?.key !== dayKey) return all;
    return order.ids.map((id) => all.find((s) => s.id === id)).filter((s): s is DayStop => !!s);
  })();

  const legs = stops.map((s, i) => (i === 0 ? null : drivingKm(stops[i - 1].locations, s.locations)));
  const knownKm = legs.reduce<number>((sum, km) => sum + (km ?? 0), 0);
  const unpinned = stops.filter((s) => s.locations?.latitude == null).length;

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    const next = [...stops];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder({ key: dayKey, ids: next.map((s) => s.id) });
    setSaving(true);
    setError(null);
    try {
      const results = await Promise.all(
        next.map((s, i) =>
          supabase
            .from('appointments')
            .update({
              route_order: i + 1,
              planned_km: i === 0 ? null : drivingKm(next[i - 1].locations, s.locations),
            })
            .eq('id', s.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      await refetch();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const mapsUrl = mapsRouteUrl(
    stops
      .filter((s) => s.locations)
      .map((s) => ({
        name: s.locations!.name,
        address: s.locations!.address,
        latitude: s.locations!.latitude,
        longitude: s.locations!.longitude,
      })),
  );

  return (
    <Screen>
      <DateStepper label="Day" value={day} onChange={setDay} format={formatDay} />
      <ErrorText>{loadError ?? error}</ErrorText>

      {loading && !data ? <Loading /> : null}
      {data && stops.length === 0 ? (
        <EmptyState
          title="No stops this day"
          action={<Button title="Book a visit" variant="secondary" onPress={() => router.push('/appointment/new')} />}
        />
      ) : null}

      {stops.length > 0 ? (
        <Card>
          <ThemedText style={{ fontWeight: 600 }}>
            {stops.length} {stops.length === 1 ? 'stop' : 'stops'} ·{' '}
            {stops.reduce((n, s) => n + s.appointment_horses.length, 0)} horses
            {stops.length > 1 ? ` · about ${formatDistance(knownKm, unit)} between stops` : ''}
          </ThemedText>
          {unpinned > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {unpinned} {unpinned === 1 ? 'barn isn’t' : 'barns aren’t'} pinned on the map, so distances are partial.
            </ThemedText>
          ) : null}
        </Card>
      ) : null}

      {stops.map((s, i) => {
        const prev = stops[i - 1];
        const outOfOrder = prev && new Date(s.scheduled_start) < new Date(prev.scheduled_start);
        return (
          <View key={s.id} style={styles.stop}>
            {i > 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.leg}>
                ↓ {legs[i] != null ? `about ${formatDistance(legs[i]!, unit)}` : 'distance unknown'}
              </ThemedText>
            ) : null}
            <Card onPress={() => router.push({ pathname: '/appointment/[id]', params: { id: s.id } })}>
              <View style={styles.row}>
                <ThemedText style={{ fontWeight: 600, flexShrink: 1 }}>
                  {i + 1}. {s.locations?.name ?? 'No barn set'}
                </ThemedText>
                <ThemedText type="small">{formatWindow(s.scheduled_start, s.scheduled_end)}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {s.appointment_horses.map((ah) => ah.horses?.name).filter(Boolean).join(', ')}
              </ThemedText>
              {outOfOrder ? (
                <ThemedText type="small" style={{ color: theme.warning }}>
                  Arrival window starts before the previous stop&apos;s.
                </ThemedText>
              ) : null}
              <View style={styles.reorder}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Move stop earlier"
                  disabled={i === 0 || saving}
                  onPress={() => move(i, -1)}
                  style={[styles.reorderButton, (i === 0 || saving) && styles.disabled]}>
                  <ThemedText type="smallBold" themeColor="accent">
                    ↑ Earlier
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Move stop later"
                  disabled={i === stops.length - 1 || saving}
                  onPress={() => move(i, 1)}
                  style={[styles.reorderButton, (i === stops.length - 1 || saving) && styles.disabled]}>
                  <ThemedText type="smallBold" themeColor="accent">
                    ↓ Later
                  </ThemedText>
                </Pressable>
              </View>
            </Card>
          </View>
        );
      })}

      {mapsUrl ? <Button title="Open route in Google Maps" onPress={() => Linking.openURL(mapsUrl)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stop: { gap: Spacing.one },
  leg: { paddingLeft: Spacing.three },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  reorder: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.one },
  reorderButton: { minHeight: 32, justifyContent: 'center' },
  disabled: { opacity: 0.3 },
});

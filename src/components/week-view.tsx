import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, ErrorText, Loading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { fetchAppointmentsBetween } from '@/lib/queries';
import { addDays, formatWindow, startOfDay, toDateString } from '@/lib/schedule';

function mondayOf(d: Date) {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
}

/** A week at a glance: how busy each day is, and that day's visits (past ones too). */
export function WeekView({ userId, farrier }: { userId: string; farrier: boolean }) {
  const theme = useTheme();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [picked, setPicked] = useState(() => toDateString(new Date()));
  const end = addDays(weekStart, 7);
  const { data, error, loading } = useQuery(
    async () => (await fetchAppointmentsBetween(weekStart, end)).filter((a) => !farrier || a.provider_id === userId),
    `${userId}:${toDateString(weekStart)}`,
  );

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const onDay = (d: string) => (data ?? []).filter((a) => toDateString(new Date(a.scheduled_start)) === d);
  const selected = onDay(picked);
  const today = toDateString(new Date());

  function shift(weeks: number) {
    const next = addDays(weekStart, weeks * 7);
    setWeekStart(next);
    setPicked(toDateString(weeks === 0 ? new Date() : next));
  }

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous week" hitSlop={12} onPress={() => shift(-1)}>
          <ThemedText type="subtitle">‹</ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => {
          setWeekStart(mondayOf(new Date()));
          setPicked(today);
        }}>
          <ThemedText style={{ fontWeight: 600 }}>
            {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {addDays(weekStart, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Next week" hitSlop={12} onPress={() => shift(1)}>
          <ThemedText type="subtitle">›</ThemedText>
        </Pressable>
      </View>

      <View style={styles.days}>
        {days.map((d) => {
          const key = toDateString(d);
          const count = onDay(key).filter((a) => a.status !== 'cancelled').length;
          const isPicked = key === picked;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${d.toDateString()}, ${count} visits`}
              onPress={() => setPicked(key)}
              style={[
                styles.day,
                { backgroundColor: isPicked ? theme.accent : theme.backgroundElement },
                key === today && !isPicked && { borderColor: theme.accent, borderWidth: 1 },
              ]}>
              <ThemedText type="small" style={{ color: isPicked ? theme.accentText : theme.textSecondary }}>
                {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
              </ThemedText>
              <ThemedText style={{ fontWeight: 600, color: isPicked ? theme.accentText : theme.text }}>{d.getDate()}</ThemedText>
              <ThemedText type="small" style={{ color: isPicked ? theme.accentText : theme.accent }}>
                {count ? '•'.repeat(Math.min(count, 4)) : ' '}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ErrorText>{error}</ErrorText>
      {loading && !data ? <Loading /> : null}
      {data && selected.length === 0 ? <ThemedText themeColor="textSecondary">No visits this day.</ThemedText> : null}
      {selected.map((a) => (
        <Card key={a.id} onPress={() => router.push({ pathname: '/appointment/[id]', params: { id: a.id } })}>
          <View style={styles.row}>
            <ThemedText style={{ fontWeight: 600 }}>{formatWindow(a.scheduled_start, a.scheduled_end)}</ThemedText>
            <ThemedText
              type="smallBold"
              style={{
                color:
                  a.status === 'cancelled'
                    ? theme.danger
                    : a.status === 'completed' || a.owner_confirmed_at
                      ? theme.success
                      : theme.warning,
              }}>
              {a.status === 'cancelled' ? 'Cancelled' : a.status === 'completed' ? 'Done' : a.owner_confirmed_at ? 'Confirmed' : 'Unconfirmed'}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {[farrier ? a.locations?.name : a.profiles?.business_name || a.profiles?.full_name, a.appointment_horses.map((h) => h.horses?.name).filter(Boolean).join(', ')]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        </Card>
      ))}
      {farrier && selected.some((a) => a.status === 'scheduled') ? (
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/route', params: { date: picked } })}>
          <ThemedText type="smallBold" themeColor="accent">
            Day route for this day
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  days: { flexDirection: 'row', gap: Spacing.one },
  day: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: 10, gap: 2 },
});

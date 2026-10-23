import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, ErrorText, Loading, Screen, SectionTitle, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dueLabel, dueStatus, formatDate, type DueStatus } from '@/lib/dates';
import { fetchDueList, type DueItem } from '@/lib/queries';

type Filter = 'soon' | 'all';

const NO_BARN = 'No barn set';

/**
 * The farrier's home screen: horses coming due, grouped by barn so a day
 * can be planned around stops. Barns are ordered by their most urgent horse.
 */
export function DueList() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const { data, error, loading } = useQuery(() => fetchDueList(userId), userId);
  const [filter, setFilter] = useState<Filter>('soon');

  const groups = useMemo(() => {
    const items = (data ?? []).filter((d) => {
      if (filter === 'all') return true;
      const s = dueStatus(d.next_due);
      return s === 'overdue' || s === 'this_week' || s === 'soon';
    });
    // Unknown dates sort last.
    const key = (d: DueItem) => d.next_due ?? '9999-12-31';
    items.sort((a, b) => key(a).localeCompare(key(b)));

    const byBarn = new Map<string, DueItem[]>();
    for (const d of items) {
      const barn = d.barn?.name ?? NO_BARN;
      byBarn.set(barn, [...(byBarn.get(barn) ?? []), d]);
    }
    return [...byBarn.entries()];
  }, [data, filter]);

  const noDates = (data ?? []).filter((d) => !d.next_due).length;

  if (loading && !data) return <Loading />;

  return (
    <Screen>
      <Segmented
        options={[
          { value: 'soon', label: 'Next 3 weeks' },
          { value: 'all', label: 'All horses' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <ErrorText>{error}</ErrorText>

      {data && data.length === 0 ? (
        <EmptyState
          title="Your due list is empty"
          body="Add horses and set their shoeing interval. They'll show up here when they're coming due."
        />
      ) : null}
      {data && data.length > 0 && groups.length === 0 ? (
        <EmptyState title="Nothing due in the next 3 weeks" body="Switch to All horses to see everyone." />
      ) : null}

      {groups.map(([barn, items]) => (
        <View key={barn} style={styles.group}>
          <View style={styles.row}>
            <SectionTitle>
              {barn} · {items.length} {items.length === 1 ? 'horse' : 'horses'}
            </SectionTitle>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/appointment/new',
                  params: {
                    barnId: items[0].barn?.id ?? '',
                    horseIds: items.map((d) => d.horse_id).join(','),
                  },
                })
              }>
              <ThemedText type="smallBold" themeColor="accent">
                Book stop
              </ThemedText>
            </Pressable>
          </View>
          {items.map((d) => (
            <DueRow key={d.horse_id} item={d} />
          ))}
        </View>
      ))}

      {filter === 'all' && noDates > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {noDates} {noDates === 1 ? 'horse has' : 'horses have'} no due date. Set a shoeing interval on the horse to
          add one.
        </ThemedText>
      ) : null}
    </Screen>
  );
}

function DueRow({ item }: { item: DueItem }) {
  const theme = useTheme();
  const status = dueStatus(item.next_due);
  const colors: Record<DueStatus, string> = {
    overdue: theme.danger,
    this_week: theme.warning,
    soon: theme.text,
    later: theme.textSecondary,
    unknown: theme.textSecondary,
  };
  return (
    <Card onPress={() => router.push({ pathname: '/horse/[id]', params: { id: item.horse_id! } })}>
      <View style={styles.row}>
        <ThemedText style={{ fontWeight: 600, flexShrink: 1 }}>{item.horse_name}</ThemedText>
        <ThemedText type="smallBold" style={{ color: colors[status] }}>
          {dueLabel(item.next_due)}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {[item.owners.join(', '), `Last visit ${formatDate(item.last_visit)}`].filter(Boolean).join(' · ')}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
});

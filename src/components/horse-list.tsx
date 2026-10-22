import { router } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, ErrorText, Loading, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/lib/auth';
import { fetchHorses, type HorseListItem } from '@/lib/queries';

const SHOE_LABELS = {
  barefoot: 'Barefoot',
  shod_front: 'Shod front',
  shod_full: 'Shod all round',
  other: 'Other',
} as const;

function subtitle(h: HorseListItem, mode: 'farrier' | 'owner') {
  const parts: string[] = [];
  if (mode === 'farrier') {
    const owners = h.horse_owners.map((o) => o.clients?.full_name).filter(Boolean);
    if (owners.length) parts.push(owners.join(', '));
  } else {
    const hasFarrier = h.horse_providers.some((p) => p.role === 'farrier' && p.status === 'active');
    if (!hasFarrier) parts.push('No farrier yet');
  }
  if (h.locations?.name) parts.push(h.locations.name);
  if (h.shoe_status) parts.push(SHOE_LABELS[h.shoe_status]);
  return parts.join(' · ');
}

export function HorseList() {
  const { mode } = useAuth();
  const { data, error, loading } = useQuery(fetchHorses);

  if (loading && !data) return <Loading />;

  return (
    <Screen>
      <Button title="Add a horse" onPress={() => router.push('/horse/new')} />
      <ErrorText>{error}</ErrorText>
      {data && data.length === 0 ? (
        <EmptyState
          title="No horses yet"
          body={
            mode === 'farrier'
              ? 'Add the horses you shoe, or ask owners to invite you from their account.'
              : 'Add your horse, then invite your farrier so they can keep its records here.'
          }
        />
      ) : null}
      <View style={{ gap: 8 }}>
        {data?.map((h) => (
          <Card key={h.id} onPress={() => router.push({ pathname: '/horse/[id]', params: { id: h.id } })}>
            <ThemedText style={{ fontWeight: 600 }}>{h.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle(h, mode ?? 'owner')}
            </ThemedText>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

export { SHOE_LABELS };

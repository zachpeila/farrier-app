import { router } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, ErrorText, Loading, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/lib/auth';
import { fetchMyBarns } from '@/lib/queries';

export default function Barns() {
  const { session, mode } = useAuth();
  const userId = session!.user.id;
  const { data, error, loading } = useQuery(() => fetchMyBarns(userId), userId);

  if (loading && !data) return <Loading />;

  return (
    <Screen>
      <Button title="Add a barn" onPress={() => router.push({ pathname: '/barn/[id]', params: { id: 'new' } })} />
      <ErrorText>{error}</ErrorText>
      {data && data.length === 0 ? (
        <EmptyState
          title="No barns yet"
          body={
            mode === 'farrier'
              ? 'Barns group your due list into stops, so you can shoe every horse at a barn in one trip.'
              : 'Add where your horse lives so your farrier knows where to go.'
          }
        />
      ) : null}
      <View style={{ gap: 8 }}>
        {data?.map((b) => (
          <Card key={b.id} onPress={() => router.push({ pathname: '/barn/[id]', params: { id: b.id } })}>
            <ThemedText style={{ fontWeight: 600 }}>{b.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[b.address, `${b.horses.length} ${b.horses.length === 1 ? 'horse' : 'horses'}`]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

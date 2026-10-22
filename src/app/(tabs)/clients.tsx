import { router } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, ErrorText, Loading, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/lib/auth';
import { fetchClients } from '@/lib/queries';

export default function Clients() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const { data, error, loading } = useQuery(() => fetchClients(userId), userId);

  if (loading && !data) return <Loading />;

  return (
    <Screen>
      <Button title="Add a client" onPress={() => router.push({ pathname: '/client/[id]', params: { id: 'new' } })} />
      <ErrorText>{error}</ErrorText>
      {data && data.length === 0 ? (
        <EmptyState title="No clients yet" body="Clients are the owners you shoe for and send invoices to." />
      ) : null}
      <View style={{ gap: 8 }}>
        {data?.map((c) => (
          <Card key={c.id} onPress={() => router.push({ pathname: '/client/[id]', params: { id: c.id } })}>
            <ThemedText style={{ fontWeight: 600 }}>{c.full_name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                `${c.horse_owners.length} ${c.horse_owners.length === 1 ? 'horse' : 'horses'}`,
                c.linked_user_id ? 'On the app' : null,
                c.phone,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

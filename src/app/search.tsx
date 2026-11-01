import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, ErrorText, Field, Loading, Screen, SectionTitle } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/lib/auth';
import { fetchClients, fetchHorses, fetchMyBarns } from '@/lib/queries';

type Hit = { id: string; title: string; detail: string; go: () => void };

/** One box that finds horses, clients and barns by name, owner, phone or address. */
export default function Search() {
  const { session, mode } = useAuth();
  const userId = session!.user.id;
  const farrier = mode === 'farrier';
  const [text, setText] = useState('');

  const { data, error, loading } = useQuery(async () => {
    const [horses, clients, barns] = await Promise.all([
      fetchHorses(),
      farrier ? fetchClients(userId) : Promise.resolve([]),
      fetchMyBarns(userId),
    ]);
    return { horses, clients, barns };
  }, `${userId}:${mode}`);

  const groups = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q || !data) return [];
    const has = (...parts: (string | null | undefined)[]) => parts.some((p) => p?.toLowerCase().includes(q));
    const digits = q.replace(/\D/g, '');
    const phoneHas = (p: string | null | undefined) => digits.length >= 3 && !!p?.replace(/\D/g, '').includes(digits);

    const horses: Hit[] = data.horses
      .filter((h) => has(h.name, h.breed, h.color, h.locations?.name, ...h.horse_owners.map((o) => o.clients?.full_name)))
      .map((h) => ({
        id: h.id,
        title: h.name,
        detail: [h.horse_owners.map((o) => o.clients?.full_name).filter(Boolean).join(', '), h.locations?.name]
          .filter(Boolean)
          .join(' · '),
        go: () => router.push({ pathname: '/horse/[id]', params: { id: h.id } }),
      }));
    const clients: Hit[] = data.clients
      .filter((c) => has(c.full_name, c.email) || phoneHas(c.phone))
      .map((c) => ({
        id: c.id,
        title: c.full_name,
        detail: [c.phone, c.email].filter(Boolean).join(' · '),
        go: () => router.push({ pathname: '/client/[id]', params: { id: c.id } }),
      }));
    const barns: Hit[] = data.barns
      .filter((b) => has(b.name, b.address))
      .map((b) => ({
        id: b.id,
        title: b.name,
        detail: b.address ?? '',
        go: () => router.push({ pathname: '/barn/[id]', params: { id: b.id } }),
      }));
    return (
      [
        ['Horses', horses],
        ['Clients', clients],
        ['Barns', barns],
      ] as const
    ).filter(([, hits]) => hits.length > 0);
  }, [text, data]);

  if (loading && !data) return <Loading />;

  return (
    <Screen>
      <Field
        label={farrier ? 'Horse, client, barn or phone' : 'Horse or barn'}
        value={text}
        onChangeText={setText}
        autoFocus
        autoCorrect={false}
        placeholder="Start typing"
        returnKeyType="search"
      />
      <ErrorText>{error}</ErrorText>
      {text.trim() && groups.length === 0 ? <ThemedText themeColor="textSecondary">Nothing matches.</ThemedText> : null}
      {groups.map(([title, hits]) => (
        <View key={title} style={{ gap: 8 }}>
          <SectionTitle>{title}</SectionTitle>
          {hits.slice(0, 25).map((h) => (
            <Card key={h.id} onPress={h.go}>
              <ThemedText style={{ fontWeight: 600 }}>{h.title}</ThemedText>
              {h.detail ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {h.detail}
                </ThemedText>
              ) : null}
            </Card>
          ))}
        </View>
      ))}
    </Screen>
  );
}

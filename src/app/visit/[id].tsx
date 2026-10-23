import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, ErrorText, Loading, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/dates';
import { listPending } from '@/lib/outbox';
import { fetchVisit } from '@/lib/queries';
import { FEET, FLAG_TYPES, FOOT_WORK, GROUND, label, WORK_TYPES } from '@/lib/visit-options';

type FootRow = {
  foot: string;
  work: string;
  shoe_make?: string | null;
  shoe_size?: string | null;
  pads?: string | null;
  modifications?: string | null;
  findings?: string | null;
};

type VisitView = {
  date: string;
  workType: string | null;
  notes: string | null;
  nextDue: string | null;
  ground: string | null;
  shared: boolean;
  by: string | null;
  flags: string[];
  feet: FootRow[];
  photos: { id: string; url: string | null; label: string | null }[];
  pending: boolean;
};

/** Loads from the server, or from the phone if the visit hasn't uploaded yet. */
async function loadVisit(id: string): Promise<VisitView | null> {
  const pending = (await listPending()).find((p) => p.visit.id === id);
  if (pending) {
    return {
      date: pending.visit.visit_date,
      workType: pending.visit.work_type ?? null,
      notes: pending.visit.notes ?? null,
      nextDue: pending.visit.next_due_date ?? null,
      ground: pending.visit.ground_conditions ?? null,
      shared: !!pending.visit.shared_with_owner,
      by: null,
      flags: pending.flags.map((f) => f.flag_type),
      feet: pending.feet,
      photos: pending.photos.map((p) => ({ id: p.id, url: p.localUri, label: p.label })),
      pending: true,
    };
  }
  const v = await fetchVisit(id);
  if (!v) return null;
  return {
    date: v.visit_date,
    workType: v.work_type,
    notes: v.notes,
    nextDue: v.next_due_date,
    ground: v.ground_conditions,
    shared: v.shared_with_owner,
    by: v.profiles?.business_name || v.profiles?.full_name || null,
    flags: v.visit_flags.map((f) => f.flag_type),
    feet: v.visit_feet,
    photos: v.visit_photos.map((p) => ({ id: p.id, url: p.url, label: p.label })),
    pending: false,
  };
}

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { data: v, error, loading } = useQuery(() => loadVisit(id), id);

  if (loading && !v) return <Loading />;
  if (!v) return <Screen><ErrorText>{error ?? 'Visit not found.'}</ErrorText></Screen>;

  const feet = FEET.map((f) => ({ ...f, row: v.feet.find((r) => r.foot === f.value) })).filter((f) => f.row);

  return (
    <Screen>
      <Stack.Screen options={{ title: formatDate(v.date) }} />
      <Card>
        <ThemedText type="subtitle">{label(WORK_TYPES, v.workType) || 'Visit'}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {[formatDate(v.date), v.by, v.ground ? label(GROUND, v.ground) : null].filter(Boolean).join(' · ')}
        </ThemedText>
        {v.nextDue ? <ThemedText type="small">Next due {formatDate(v.nextDue)}</ThemedText> : null}
        {v.pending ? (
          <ThemedText type="smallBold" style={{ color: theme.warning }}>
            Saved on this phone, waiting to upload
          </ThemedText>
        ) : null}
      </Card>

      {v.flags.length ? (
        <ThemedText type="smallBold" style={{ color: theme.danger }}>
          Problems: {v.flags.map((f) => label(FLAG_TYPES, f)).join(', ')}
        </ThemedText>
      ) : null}

      {feet.length ? <SectionTitle>Feet</SectionTitle> : null}
      {feet.map(({ value, label: footLabel, row }) => {
        const details = [
          row!.shoe_make,
          row!.shoe_size ? `size ${row!.shoe_size}` : null,
          row!.pads ? `pads: ${row!.pads}` : null,
          row!.modifications,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <Card key={value}>
            <ThemedText style={{ fontWeight: 600 }}>
              {footLabel}: {label(FOOT_WORK, row!.work)}
            </ThemedText>
            {details ? (
              <ThemedText type="small" themeColor="textSecondary">
                {details}
              </ThemedText>
            ) : null}
            {row!.findings ? <ThemedText type="small">{row!.findings}</ThemedText> : null}
          </Card>
        );
      })}

      {v.notes ? (
        <>
          <SectionTitle>Notes</SectionTitle>
          <ThemedText>{v.notes}</ThemedText>
        </>
      ) : null}

      {v.photos.length ? (
        <>
          <SectionTitle>Photos</SectionTitle>
          <View style={styles.photos}>
            {v.photos.map((p) =>
              p.url ? (
                <View key={p.id} style={styles.photoWrap}>
                  <Image source={{ uri: p.url }} style={styles.photo} contentFit="cover" />
                  {p.label ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {p.label === 'before' ? 'Before' : 'After'}
                    </ThemedText>
                  ) : null}
                </View>
              ) : null,
            )}
          </View>
        </>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        {v.shared ? 'Shared with the owner.' : 'Private to you; the owner can’t see this visit.'}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  photoWrap: { gap: Spacing.one },
  photo: { width: 150, height: 150, borderRadius: 8 },
});

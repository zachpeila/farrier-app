import { router } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Field, Screen, SectionTitle, Segmented } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { INTERVAL_OPTIONS } from '@/lib/horse-options';
import { addClientWithHorses, barnsByName, parseRows } from '@/lib/quick-add';
import { errorMessage } from '@/lib/supabase';

/** Paste a client list from a spreadsheet and add everyone at once. */
export default function ImportClients() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const [text, setText] = useState('');
  const [interval, setIntervalWeeks] = useState('6');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rows = parseRows(text);
  const horseCount = rows.reduce((n, r) => n + r.horses.length, 0);

  async function run() {
    setBusy(true);
    setError(null);
    setDone(0);
    try {
      const barns = await barnsByName(userId);
      for (const r of rows) {
        await addClientWithHorses({ ...r, intervalWeeks: Number(interval) }, userId, barns);
        setDone((n) => n + 1);
      }
      router.replace('/clients');
    } catch (e) {
      setError(`Stopped at row ${done + 1}: ${errorMessage(e)}`);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ThemedText>
        Copy rows from a spreadsheet (or type them) with these columns in order. Only the name is needed.
      </ThemedText>
      <Card>
        <ThemedText type="small">Name · Phone · Email · Horses · Barn · Barn address</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Separate several horses with a semicolon, e.g. Dusty; Pepper
        </ThemedText>
      </Card>
      <Field
        label="Rows"
        value={text}
        onChangeText={setText}
        multiline
        autoCorrect={false}
        autoCapitalize="none"
        placeholder={'Jane Rider, 555-201-3344, jane@example.com, Dusty; Pepper, Willow Creek, 12 Ridge Rd'}
      />
      <Segmented label="Shoeing interval for these horses" options={INTERVAL_OPTIONS} value={interval} onChange={setIntervalWeeks} />

      {rows.length ? (
        <>
          <SectionTitle>
            {rows.length} {rows.length === 1 ? 'client' : 'clients'} · {horseCount} {horseCount === 1 ? 'horse' : 'horses'}
          </SectionTitle>
          {rows.slice(0, 5).map((r, i) => (
            <ThemedText key={i} type="small" themeColor="textSecondary">
              {[r.name, r.phone, r.horses.join(', '), r.barn?.name].filter(Boolean).join(' · ')}
            </ThemedText>
          ))}
          {rows.length > 5 ? (
            <ThemedText type="small" themeColor="textSecondary">
              and {rows.length - 5} more
            </ThemedText>
          ) : null}
        </>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button
        title={busy ? `Adding ${done + 1} of ${rows.length}…` : `Add ${rows.length || ''} ${rows.length === 1 ? 'client' : 'clients'}`}
        onPress={run}
        loading={busy}
        disabled={!rows.length}
      />
    </Screen>
  );
}

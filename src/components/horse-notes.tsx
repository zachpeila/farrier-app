import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage, supabase } from '@/lib/supabase';

/**
 * The farrier's private notes on a horse: handling, kicks, needs sedation,
 * who to call. Owners never see these.
 */
export function HorseNotes({ horseId, userId }: { horseId: string; userId: string }) {
  const theme = useTheme();
  const [saved, setSaved] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('horse_notes')
      .select('notes')
      .eq('horse_id', horseId)
      .eq('provider_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setSaved(data?.notes ?? '');
        setText(data?.notes ?? '');
      });
  }, [horseId, userId]);

  async function save() {
    setBusy(true);
    setError(null);
    const notes = text.trim();
    const { error } = notes
      ? await supabase
          .from('horse_notes')
          .upsert({ horse_id: horseId, provider_id: userId, notes }, { onConflict: 'horse_id,provider_id' })
      : await supabase.from('horse_notes').delete().eq('horse_id', horseId).eq('provider_id', userId);
    setBusy(false);
    if (error) setError(errorMessage(error));
    else {
      setSaved(notes);
      setEditing(false);
    }
  }

  if (saved === null) return null;

  if (!editing) {
    return (
      <Card onPress={() => setEditing(true)}>
        <ThemedText type="smallBold" style={{ color: saved ? theme.warning : theme.textSecondary }}>
          Your private notes
        </ThemedText>
        <ThemedText type={saved ? 'default' : 'small'} themeColor={saved ? 'text' : 'textSecondary'}>
          {saved || 'Handling, kicks, needs sedation, who to call. Only you see these. Tap to add.'}
        </ThemedText>
      </Card>
    );
  }

  return (
    <View style={{ gap: Spacing.two }}>
      <Field
        label="Your private notes"
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        placeholder="e.g. Kicks with right hind. Needs a twitch for fronts. Owner's vet: Dr. Lee 555-0102"
        hint="Only you see these. The owner does not."
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Save notes" onPress={save} loading={busy} />
      <Button
        title="Cancel"
        variant="secondary"
        onPress={() => {
          setText(saved);
          setEditing(false);
        }}
      />
    </View>
  );
}

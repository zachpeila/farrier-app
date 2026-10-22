import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Field, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { inviteMessage } from '@/lib/invites';
import { errorMessage, supabase } from '@/lib/supabase';

/**
 * Owner invites their farrier to a horse. The farrier accepts with the
 * code, which attaches them to the horse and adds the owner as their client.
 */
export default function InviteFarrier() {
  const { horseId } = useLocalSearchParams<{ horseId: string }>();
  const { session, profile } = useAuth();
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from('provider_invites')
      .insert({ horse_id: horseId, invited_by: session!.user.id, role: 'farrier', sent_to: sentTo.trim() })
      .select('token, horses(name)')
      .single();
    if (error) {
      setBusy(false);
      setError(errorMessage(error));
      return;
    }
    const from = profile?.full_name || 'A client';
    await Share.share({
      message: inviteMessage(
        data.token,
        `${from} invited you to keep ${data.horses?.name ?? 'their horse'}'s shoeing schedule and records in Farrier App.`,
      ),
    });
    setBusy(false);
    router.back();
  }

  return (
    <Screen>
      <ThemedText>
        We&apos;ll make an invite code you can text or email to your farrier. When they join and enter it, they&apos;ll
        see this horse on their due list.
      </ThemedText>
      <Field
        label="Farrier's mobile or email"
        value={sentTo}
        onChangeText={setSentTo}
        autoCapitalize="none"
        hint="So you can tell your invites apart. We don't message them for you yet."
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Create invite and share" onPress={send} loading={busy} disabled={!sentTo.trim()} />
    </Screen>
  );
}

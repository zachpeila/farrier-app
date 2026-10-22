import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Field, Screen } from '@/components/ui';
import { errorMessage, supabase } from '@/lib/supabase';

/**
 * Accepts either kind of invite code: an owner inviting their farrier
 * (provider_invites) or a farrier inviting a client (client_invites).
 * Both use the same 8-character format, so try one and then the other.
 */
export default function AcceptInvite() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const token = code.trim().toUpperCase();

    const asFarrier = await supabase.rpc('accept_provider_invite', { p_token: token });
    if (!asFarrier.error) {
      router.replace({ pathname: '/horse/[id]', params: { id: asFarrier.data } });
      return;
    }
    const asOwner = await supabase.rpc('accept_client_invite', { p_token: token });
    setBusy(false);
    if (!asOwner.error) {
      router.replace('/');
      return;
    }
    // Prefer the error that isn't "not found": it explains the real problem.
    const notFound = (m: string) => m.includes('not found');
    const messages = [asFarrier.error.message, asOwner.error.message];
    setError(messages.find((m) => !notFound(m)) ?? errorMessage(asOwner.error));
  }

  return (
    <Screen>
      <ThemedText>Enter the code from the text or email you were sent.</ThemedText>
      <Field
        label="Invite code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        placeholder="A1B2C3D4"
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Accept invite" onPress={accept} loading={busy} disabled={code.trim().length < 8} />
    </Screen>
  );
}

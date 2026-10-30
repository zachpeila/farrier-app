import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Field, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { errorMessage, supabase } from '@/lib/supabase';

/**
 * Passwordless sign in: we email a 6-digit code. Codes work on every
 * platform without deep links, which matters for farriers on spotty signal.
 */
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    // On web, a sign-in link in the email brings the person back to this site.
    const emailRedirectTo = Platform.OS === 'web' ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo } });
    setBusy(false);
    if (error) setError(errorMessage(error));
    else setSent(true);
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    // On success the auth listener swaps the screen; nothing else to do here.
    if (error) setError(errorMessage(error));
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Farrier App</ThemedText>
        <ThemedText themeColor="textSecondary">
          Shoeing schedules and records for farriers and the owners they work with.
        </ThemedText>
      </View>

      {!sent ? (
        <>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Email me a sign-in code" onPress={sendCode} loading={busy} disabled={!email.includes('@')} />
        </>
      ) : (
        <>
          <ThemedText>We sent a code to {email.trim()}.</ThemedText>
          {Platform.OS === 'web' ? (
            <ThemedText themeColor="textSecondary">If the email has a sign-in link instead, open it in this browser.</ThemedText>
          ) : null}
          <Field
            label="Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            placeholder="123456"
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Sign in" onPress={verify} loading={busy} disabled={code.trim().length < 6} />
          <Button title="Use a different email" variant="secondary" onPress={() => setSent(false)} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two, marginTop: Spacing.five, marginBottom: Spacing.three },
});

import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { appInviteLink, savePendingInvite } from '@/lib/invites';

/**
 * Where an invite link lands. Signed in: straight to accepting it.
 * Not yet: remember the code, sign in, and it's accepted after setup.
 */
export default function Join() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, mode } = useAuth();

  useEffect(() => {
    if (code && !(session && mode)) savePendingInvite(code.toUpperCase());
  }, [code, session, mode]);

  if (session && mode) return <Redirect href={{ pathname: '/invite', params: { code } }} />;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'You’re invited' }} />
      <Card>
        <ThemedText type="subtitle">Join Farrier App</ThemedText>
        <ThemedText>
          Shoeing schedules, records and invoices, shared between farriers and the owners they work with.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your invite code is {code?.toUpperCase()}.
        </ThemedText>
      </Card>
      <Button title={session ? 'Finish setting up' : 'Sign in or create an account'} onPress={() => router.replace('/')} />
      {Platform.OS === 'web' ? (
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="small" themeColor="textSecondary">
            Already have the app on this phone?
          </ThemedText>
          <Button title="Open in the app" variant="secondary" onPress={() => Linking.openURL(appInviteLink(code))} />
        </View>
      ) : null}
    </Screen>
  );
}

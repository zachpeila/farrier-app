import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';
import { takePendingInvite } from '@/lib/invites';
import { syncOutbox } from '@/lib/outbox';
import { registerForPush, useNotificationRouting } from '@/lib/push';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { loading, session, mode } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Upload any visits saved while offline as soon as someone is signed in.
  useEffect(() => {
    if (session) syncOutbox();
  }, [session]);

  // Register this phone for reminders once someone has finished setup.
  const userId = session?.user.id;
  useEffect(() => {
    if (userId && mode) registerForPush(userId).catch(() => {});
  }, [userId, mode]);
  useNotificationRouting();

  // An invite link opened before signing in is accepted once setup is done.
  useEffect(() => {
    if (!userId || !mode) return;
    takePendingInvite().then((code) => {
      if (code) setTimeout(() => router.push({ pathname: '/invite', params: { code } }), 0);
    });
  }, [userId, mode]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* Public, so the app stores and people not signed in can read them. */}
      <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
      <Stack.Screen name="l/[token]" options={{ title: '' }} />
      <Stack.Screen name="join/[code]" options={{ title: '' }} />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !mode}>
        <Stack.Screen name="setup" options={{ title: 'Welcome' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !!mode}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="horse/new" options={{ title: 'Add horse', presentation: 'modal' }} />
        <Stack.Screen name="horse/[id]" options={{ title: 'Horse' }} />
        <Stack.Screen name="horse/invite" options={{ title: 'Invite your farrier', presentation: 'modal' }} />
        <Stack.Screen name="barn/[id]" options={{ title: 'Barn' }} />
        <Stack.Screen name="client/[id]" options={{ title: 'Client' }} />
        <Stack.Screen name="client/quick" options={{ title: 'Add a client', presentation: 'modal' }} />
        <Stack.Screen name="client/import" options={{ title: 'Import clients', presentation: 'modal' }} />
        <Stack.Screen name="invite" options={{ title: 'Enter invite code', presentation: 'modal' }} />
        <Stack.Screen name="appointment/new" options={{ title: 'Book a visit', presentation: 'modal' }} />
        <Stack.Screen name="appointment/[id]" options={{ title: 'Visit' }} />
        <Stack.Screen name="appointment/finish" options={{ title: 'Finish stop' }} />
        <Stack.Screen name="visit/new" options={{ title: 'Log visit', presentation: 'modal' }} />
        <Stack.Screen name="visit/[id]" options={{ title: 'Visit' }} />
        <Stack.Screen name="invoice/new" options={{ title: 'New invoice', presentation: 'modal' }} />
        <Stack.Screen name="invoice/[id]" options={{ title: 'Invoice' }} />
        <Stack.Screen name="settings/billing" options={{ title: 'Prices and taxes' }} />
        <Stack.Screen name="route" options={{ title: 'Day route' }} />
        <Stack.Screen name="request/new" options={{ title: 'Request a visit', presentation: 'modal' }} />
        <Stack.Screen name="search" options={{ title: 'Search' }} />
        <Stack.Screen name="find" options={{ title: 'Find a farrier' }} />
        <Stack.Screen name="settings/listing" options={{ title: 'Your listing' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootStack />
      </ThemeProvider>
    </AuthProvider>
  );
}

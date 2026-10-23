import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';
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

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
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
        <Stack.Screen name="invite" options={{ title: 'Enter invite code', presentation: 'modal' }} />
        <Stack.Screen name="appointment/new" options={{ title: 'Book a visit', presentation: 'modal' }} />
        <Stack.Screen name="appointment/[id]" options={{ title: 'Visit' }} />
        <Stack.Screen name="visit/new" options={{ title: 'Log visit', presentation: 'modal' }} />
        <Stack.Screen name="visit/[id]" options={{ title: 'Visit' }} />
        <Stack.Screen name="invoice/new" options={{ title: 'New invoice', presentation: 'modal' }} />
        <Stack.Screen name="invoice/[id]" options={{ title: 'Invoice' }} />
        <Stack.Screen name="settings/billing" options={{ title: 'Prices and taxes' }} />
        <Stack.Screen name="route" options={{ title: 'Day route' }} />
        <Stack.Screen name="request/new" options={{ title: 'Request a visit', presentation: 'modal' }} />
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

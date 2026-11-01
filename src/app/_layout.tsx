import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Network from 'expo-network';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';
import { syncOutbox } from '@/lib/outbox';
import { registerForPush, useNotificationRouting } from '@/lib/push';
import { warmOfflineCache } from '@/lib/warm-up';

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

  const userId = session?.user.id;

  // A farrier's next visits and horses are saved on the phone while there's
  // signal, then refreshed on coming back to the app or getting signal back.
  useEffect(() => {
    if (!userId || mode !== 'farrier') return;
    const warm = () => warmOfflineCache(userId);
    warm();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') warm();
    });
    const net = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) warm();
    });
    return () => {
      app.remove();
      net.remove();
    };
  }, [userId, mode]);

  // Register this phone for reminders once someone has finished setup.
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

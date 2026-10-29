import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for notification permission and saves this phone's Expo push token,
 * so the daily reminder job can reach the person. Quietly does nothing on
 * web, simulators, or before the app has an EAS project id.
 */
export async function registerForPush(userId: string) {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      // Re-exported through a wildcard the import linter can't follow.
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform: Platform.OS === 'ios' ? 'ios' : 'android', last_seen_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
}

/** Opens the screen a reminder points at (its data.url, e.g. "/horse/<id>"). */
export function useNotificationRouting() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
  }, [response]);
}

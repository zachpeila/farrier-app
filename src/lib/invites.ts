import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

import { PUBLIC_SITE } from './client-messages';

const PENDING_KEY = 'invite.pending';

/**
 * Web link for an invite. It works for everyone: on the website it walks
 * the person through signing in and accepting, and it offers to open the
 * app if they have it.
 */
export function inviteLink(token: string) {
  return `${PUBLIC_SITE}/join/${token}`;
}

/** Opens the invite in the installed app. */
export function appInviteLink(token: string) {
  return Linking.createURL('/invite', { queryParams: { code: token } });
}

export function inviteMessage(token: string, intro: string) {
  return `${intro}\n\nOpen this link to join: ${inviteLink(token)}\n\nOr in the app, go to Account > Enter an invite code and type ${token}.`;
}

/** Remembers an invite opened before signing in, to accept right after setup. */
export async function savePendingInvite(code: string) {
  try {
    await AsyncStorage.setItem(PENDING_KEY, code);
  } catch {
    // The code is also in the message; worst case they type it.
  }
}

export async function takePendingInvite(): Promise<string | null> {
  try {
    const code = await AsyncStorage.getItem(PENDING_KEY);
    if (code) await AsyncStorage.removeItem(PENDING_KEY);
    return code;
  } catch {
    return null;
  }
}

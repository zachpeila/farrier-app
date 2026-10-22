import * as Linking from 'expo-linking';

/** Deep link that opens the invite screen with the code filled in. */
export function inviteLink(token: string) {
  return Linking.createURL('/invite', { queryParams: { code: token } });
}

export function inviteMessage(token: string, intro: string) {
  return `${intro}\n\nGet the app, then enter code ${token} under Account > Enter an invite code, or open:\n${inviteLink(token)}`;
}

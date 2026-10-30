// Web has no push notifications in expo-notifications, and calling into it
// crashes the page, so the web build gets these no-ops instead of push.ts.

export async function registerForPush(_userId: string) {}

export function useNotificationRouting() {}

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Last good copy of what each screen showed, kept on the phone so the
 * farrier can still look up horses and today's visits at a barn with no
 * signal. Cleared on sign out so the next person never sees it.
 */

const PREFIX = 'query-cache.v1:';

function storageKey(name: string, key: string) {
  return `${PREFIX}${name}:${key}`;
}

export async function readCache<T>(name: string, key: string): Promise<{ data: T; savedAt: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(name, key));
    return raw ? (JSON.parse(raw) as { data: T; savedAt: string }) : null;
  } catch {
    return null;
  }
}

export async function writeCache(name: string, key: string, data: unknown) {
  try {
    await AsyncStorage.setItem(storageKey(name, key), JSON.stringify({ data, savedAt: new Date().toISOString() }));
  } catch {
    // A full or unavailable store only means less works offline; never break the screen over it.
  }
}

export async function clearCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
  } catch {
    // Nothing useful to do; the next sign-in overwrites what it loads.
  }
}

/** Drops saved copies older than `days`, so old days and horses don't fill the phone. */
export async function pruneCache(days: number) {
  try {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    const stale: string[] = [];
    for (const [k, raw] of await AsyncStorage.multiGet(keys)) {
      const savedAt = raw ? Date.parse((JSON.parse(raw) as { savedAt: string }).savedAt) : 0;
      if (!(savedAt > cutoff)) stale.push(k);
    }
    if (stale.length) await AsyncStorage.multiRemove(stale);
  } catch {
    // Best effort.
  }
}

import * as Network from 'expo-network';
import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { readCache, writeCache } from '@/lib/offline-cache';
import { errorMessage } from '@/lib/supabase';

type Options = {
  /**
   * Name to keep the last good result under on the phone. With it, the
   * screen still opens with no signal (showing the saved copy), and opens
   * instantly while fresh data loads.
   */
  cache?: string;
};

function savedLabel(savedAt: string) {
  const d = new Date(savedAt);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `today at ${time}` : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`;
}

async function isOffline() {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === false || state.isInternetReachable === false;
  } catch {
    return false;
  }
}

/**
 * Loads data when the screen gains focus, so lists are fresh after
 * coming back from an edit screen, and again whenever `key` changes.
 */
export function useQuery<T>(load: () => Promise<T>, key = '', options: Options = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });
  const cacheName = options.cache;
  // Which key the data on screen belongs to, so a saved copy only fills an empty or outdated screen.
  const shownKey = useRef<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    let saved: { data: T; savedAt: string } | null = null;
    if (cacheName) {
      saved = await readCache<T>(cacheName, key);
      if (saved && shownKey.current !== key) {
        setData(saved.data);
        shownKey.current = key;
      }
    }
    try {
      // With no signal at all, show the saved copy now instead of waiting on the
      // network to time out. Screen shows the no-signal bar, so no error here.
      if (saved && (await isOffline())) {
        setError(null);
        return;
      }
      const next = await loadRef.current();
      setData(next);
      shownKey.current = key;
      setError(null);
      if (cacheName) writeCache(cacheName, key, next);
    } catch (e) {
      setError(
        saved ? `No connection. Showing what was saved ${savedLabel(saved.savedAt)}.` : errorMessage(e),
      );
    } finally {
      setLoading(false);
    }
  }, [cacheName, key]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return { data, error, loading, refetch };
}

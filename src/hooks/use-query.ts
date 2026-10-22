import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { errorMessage } from '@/lib/supabase';

/**
 * Loads data when the screen gains focus, so lists are fresh after
 * coming back from an edit screen, and again whenever `key` changes.
 * Small on purpose; swap for a cache library once offline visits need one.
 */
export function useQuery<T>(load: () => Promise<T>, key = '') {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refetch();
      // `key` is listed on purpose: a new key means new data to load.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetch, key]),
  );

  return { data, error, loading, refetch };
}

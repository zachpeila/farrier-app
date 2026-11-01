import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { clearCache, readCache, writeCache } from './offline-cache';
import { AUTH_STORAGE_KEY, supabase } from './supabase';
import type { AppMode, Profile } from './types';

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** null until the person has picked farrier or owner during setup */
  mode: AppMode | null;
  refreshProfile: () => Promise<void>;
  setMode: (mode: AppMode) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
      // No signal: use the copy saved last time, so units and names still show.
      setProfile((await readCache<Profile>('profile', userId))?.data ?? null);
      return;
    }
    setProfile(data);
    if (data) writeCache('profile', userId, data);
  }, []);

  useEffect(() => {
    let settled = false;
    const finish = async (current: Session | null) => {
      if (settled) return;
      settled = true;
      setSession(current);
      // Open straight away with the saved profile, and refresh it in the background.
      const saved = current ? await readCache<Profile>('profile', current.user.id) : null;
      if (saved) {
        setProfile(saved.data);
        setLoading(false);
        loadProfile(current?.user.id);
        return;
      }
      await loadProfile(current?.user.id);
      setLoading(false);
    };
    // Opening the app with no signal after the login token has expired: the
    // token can't be renewed yet (supabase-js keeps retrying for up to 30
    // seconds), but the person is still signed in. Open the app with the
    // saved session after a few seconds; it renews once there's signal.
    const slow = setTimeout(() => storedSession().then(finish), 3000);
    supabase.auth.getSession().then(async ({ data, error }) => {
      clearTimeout(slow);
      if (!data.session && error && isAuthRetryableFetchError(error)) return finish(await storedSession());
      if (settled) {
        // Opened with the saved session; this is the renewed or ended one.
        if (data.session) setSession(data.session);
        return;
      }
      finish(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // The first event repeats what getSession said above, minus the offline fallback.
      if (event === 'INITIAL_SESSION') return;
      // Only an actual sign-out ends the session; a failed renewal with no signal doesn't.
      if (!next && event !== 'SIGNED_OUT') return;
      setSession(next);
      // Don't await inside the callback: supabase-js holds a lock while it runs.
      setTimeout(() => loadProfile(next?.user.id), 0);
    });
    return () => {
      clearTimeout(slow);
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value: AuthState = {
    loading,
    session,
    profile,
    mode: (session?.user.user_metadata?.mode as AppMode | undefined) ?? null,
    refreshProfile: () => loadProfile(session?.user.id),
    setMode: async (mode) => {
      const { data, error } = await supabase.auth.updateUser({ data: { mode } });
      if (error) throw error;
      if (data.user && session) setSession({ ...session, user: data.user });
    },
    signOut: async () => {
      await supabase.auth.signOut();
      await clearCache();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** The session supabase-js keeps on the phone, read directly when it can't be renewed offline. */
async function storedSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Session) : null;
    return stored?.user && stored.refresh_token ? stored : null;
  } catch {
    return null;
  }
}

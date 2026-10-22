import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';
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
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Don't await inside the callback: supabase-js holds a lock while it runs.
      setTimeout(() => loadProfile(next?.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
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
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  ACCESS_TOKEN_STORAGE_KEY,
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function syncStoredToken(session: Session | null) {
  if (typeof window === 'undefined') return;

  if (session?.access_token) {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, session.access_token);
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Failed to read session:', error);
        }

        setSession(data.session ?? null);
        setAccessToken(data.session?.access_token ?? null);
        syncStoredToken(data.session ?? null);
        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Unexpected session error:', error);
        setSession(null);
        setAccessToken(null);
        syncStoredToken(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAccessToken(nextSession?.access_token ?? null);
      syncStoredToken(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured: isSupabaseConfigured,
      accessToken,
      login: async (email: string, password: string) => {
        if (!supabase) {
          throw new Error('Supabase is not configured.');
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setSession(data.session ?? null);
        setAccessToken(data.session?.access_token ?? null);
        syncStoredToken(data.session ?? null);
      },
      logout: async () => {
        if (!supabase) {
          setSession(null);
          setAccessToken(null);
          syncStoredToken(null);
          return;
        }

        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }

        setSession(null);
        setAccessToken(null);
        syncStoredToken(null);
      },
    }),
    [accessToken, loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

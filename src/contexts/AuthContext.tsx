import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type UserRole = 'admin' | 'responsible';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const hasSessionRef = useRef(false);

  const loadProfile = async (userId: string) => {
    console.log('[Auth] LOAD PROFILE START', { userId });
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erreur chargement du profil:', error);
      setRole(null);
      return;
    }

    console.log('[Auth] LOAD PROFILE COMPLETE', { role: data?.role ?? null });
    setRole((data?.role as UserRole) ?? null);
  };

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      console.log('[Auth] GET SESSION START');
      const { data } = await supabase.auth.getSession();
      console.log('[Auth] GET SESSION RESULT', { hasSession: Boolean(data.session) });

      if (!active) return;

      setSession(data.session);
      hasSessionRef.current = Boolean(data.session);

      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      } else {
        setRole(null);
      }

      if (active) {
        console.log('[Auth] SET LOADING FALSE (SESSION)');
        setLoading(false);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      if (event === 'INITIAL_SESSION') {
        return;
      }

      setSession(nextSession);

      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        hasSessionRef.current = false;
        setRole(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        const wasAlreadyAuthenticated = hasSessionRef.current;

        hasSessionRef.current = true;

        if (!wasAlreadyAuthenticated) {
          setLoading(true);
        }

        setTimeout(() => {
          if (!active) return;
          void loadProfile(nextSession.user.id).finally(() => {
            if (active && !wasAlreadyAuthenticated) {
              setLoading(false);
            }
          });
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

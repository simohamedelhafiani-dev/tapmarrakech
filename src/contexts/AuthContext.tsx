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

  const loadProfile = async (userId: string, user?: User) => {
    let { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erreur chargement du profil:', error);
      setRole(null);
      return;
    }

    // Email confirmation can leave a newly registered account without a
    // profile because the registration page has no authenticated session yet.
    // Recover only accounts carrying the name metadata collected at signup;
    // never infer or elevate a role from user-editable metadata.
    const metadataName = user?.user_metadata?.name;
    if (!data && typeof metadataName === 'string' && metadataName.trim()) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: userId,
        email: user?.email ?? '',
        name: metadataName.trim(),
      });

      // Another auth event/tab may have created the same profile concurrently.
      if (insertError && insertError.code !== '23505') {
        console.error('Erreur création du profil manquant:', insertError);
        setRole(null);
        return;
      }

      const refreshed = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      data = refreshed.data;
      error = refreshed.error;

      if (error) {
        console.error('Erreur rechargement du profil:', error);
        setRole(null);
        return;
      }
    }

    setRole((data?.role as UserRole) ?? null);
  };

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!active) return;

        if (error) {
          console.error('Erreur récupération de la session:', error);
          setSession(null);
          hasSessionRef.current = false;
          setRole(null);
          return;
        }

        setSession(data.session);
        hasSessionRef.current = Boolean(data.session);

        if (data.session?.user) {
          await loadProfile(data.session.user.id, data.session.user);
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error('Erreur inattendue lors de la récupération de la session:', error);
        if (active) {
          setSession(null);
          hasSessionRef.current = false;
          setRole(null);
        }
      } finally {
        if (active) setLoading(false);
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
          void loadProfile(nextSession.user.id, nextSession.user).finally(() => {
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

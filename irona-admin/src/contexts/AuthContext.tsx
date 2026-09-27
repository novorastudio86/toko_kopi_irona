import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

type AuthStatus = 'loading' | 'guest' | 'admin';

const AuthContext = createContext<{ status: AuthStatus }>({ status: 'loading' });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const resolvedUserId = useRef<string | null>(null);

  useEffect(() => {
    async function resolve(session: Session | null) {
      if (!session) {
        resolvedUserId.current = null;
        setStatus('guest');
        return;
      }

      const { data } = await supabase
        .from('employees')
        .select('is_active, roles(type)')
        .eq('id', session.user.id)
        .single();

      const role = (data?.roles as any)?.type;
      if (data?.is_active && role === 'admin') {
        resolvedUserId.current = session.user.id;
        setStatus('admin');
      } else {
        resolvedUserId.current = null;
        setStatus('guest');
        await supabase.auth.signOut();
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;

      // User yang sama sudah terverifikasi (mis. event SIGNED_IN saat tab difokuskan lagi) — abaikan
      if (session && session.user.id === resolvedUserId.current) return;

      if (session) setStatus('loading');
      // Ditunda supaya query Supabase tidak dijalankan di dalam callback auth (bisa deadlock)
      setTimeout(() => resolve(session), 0);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ status }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
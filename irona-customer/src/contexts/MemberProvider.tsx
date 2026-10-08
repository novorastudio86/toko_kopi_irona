import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MemberContext, type ProfileInput } from '@/hooks/useMember';
import LoginDialog from '@/screens/membership/LoginDialog';
import { fetchCurrentMember, signOutMember, updateMemberProfile } from '@/services/membership';
import { supabase } from '@/services/supabase';
import type { Member } from '@/types/membership';

/** Sesi Supabase Auth disimpan supabase-js di localStorage, jadi refresh tetap login */
export default function MemberProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [loginMode, setLoginMode] = useState<'login' | 'register' | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setMember(null);
      // Sesi tersimpan dari kunjungan sebelumnya. Masuk lewat pop-up sudah di-set LoginDialog.
      // Query Supabase jangan di-await di dalam callback ini (bisa macet), jadi ditunda.
      if (event === 'INITIAL_SESSION' && session)
        setTimeout(() => {
          fetchCurrentMember()
            .then(setMember)
            .catch((err) => console.error('Gagal memuat sesi member', err));
        });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const openLogin = useCallback((mode: 'login' | 'register' = 'login') => setLoginMode(mode), []);
  const logout = useCallback(() => {
    setMember(null);
    signOutMember().catch((err) => console.error('Gagal keluar', err));
  }, []);
  const spendPoints = useCallback(
    (points: number) =>
      setMember((m) => m && { ...m, pointsBalance: Math.max(0, m.pointsBalance - points) }),
    []
  );
  const updateProfile = useCallback(async (data: ProfileInput) => {
    await updateMemberProfile(data);
    setMember((m) => m && { ...m, ...data });
  }, []);

  const value = useMemo(
    () => ({ member, openLogin, logout, spendPoints, updateProfile }),
    [member, openLogin, logout, spendPoints, updateProfile]
  );
  return (
    <MemberContext value={value}>
      {children}
      {loginMode && (
        <LoginDialog
          initialStep={loginMode}
          onClose={() => setLoginMode(null)}
          onSignedIn={setMember}
        />
      )}
    </MemberContext>
  );
}

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { MemberContext, type ProfileInput } from '@/hooks/useMember';
import LoginDialog from '@/screens/membership/LoginDialog';
import { updateMemberProfile } from '@/services/membership';
import type { Member } from '@/types/membership';

// ponytail: sesi hanya di memori (refresh = kembali jadi pengunjung umum); ganti dengan sesi Supabase Auth
export default function MemberProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  // TODO(backend): supabase.auth.signOut()
  const logout = useCallback(() => setMember(null), []);
  const spendPoints = useCallback(
    (points: number) =>
      setMember((m) => m && { ...m, pointsBalance: Math.max(0, m.pointsBalance - points) }),
    []
  );
  const memberId = member?.id;
  const updateProfile = useCallback(
    async (data: ProfileInput) => {
      if (!memberId) return;
      await updateMemberProfile(memberId, data);
      setMember((m) => m && { ...m, ...data });
    },
    [memberId]
  );

  const value = useMemo(
    () => ({ member, openLogin, logout, spendPoints, updateProfile }),
    [member, openLogin, logout, spendPoints, updateProfile]
  );
  return (
    <MemberContext value={value}>
      {children}
      {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} onSignedIn={setMember} />}
    </MemberContext>
  );
}

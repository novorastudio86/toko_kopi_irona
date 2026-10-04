import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { MemberContext } from '@/hooks/useMember';
import { signInMember } from '@/services/membership';
import type { Member } from '@/types/membership';

// ponytail: sesi hanya di memori (refresh = kembali jadi pengunjung umum); ganti dengan sesi Supabase Auth
export default function MemberProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);

  const login = useCallback(async () => setMember(await signInMember()), []);
  // TODO(backend): supabase.auth.signOut()
  const logout = useCallback(() => setMember(null), []);
  const spendPoints = useCallback(
    (points: number) =>
      setMember((m) => m && { ...m, pointsBalance: Math.max(0, m.pointsBalance - points) }),
    []
  );

  const value = useMemo(
    () => ({ member, login, logout, spendPoints }),
    [member, login, logout, spendPoints]
  );
  return <MemberContext value={value}>{children}</MemberContext>;
}

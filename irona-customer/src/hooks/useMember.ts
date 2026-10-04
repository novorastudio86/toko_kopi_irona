import { createContext, useContext } from 'react';
import type { Member } from '@/types/membership';

export type ProfileInput = Pick<Member, 'name' | 'phoneNumber'>;

export interface MemberState {
  /** null = pengunjung umum (belum login) */
  member: Member | null;
  /** Buka pop-up masuk/daftar; halaman di belakangnya tetap (isian checkout aman) */
  openLogin: () => void;
  logout: () => void;
  /** Kurangi saldo lokal setelah tukar reward */
  spendPoints: (points: number) => void;
  updateProfile: (data: ProfileInput) => Promise<void>;
}

export const MemberContext = createContext<MemberState | null>(null);

export function useMember(): MemberState {
  const state = useContext(MemberContext);
  if (!state) throw new Error('useMember harus dipakai di dalam <MemberProvider>');
  return state;
}

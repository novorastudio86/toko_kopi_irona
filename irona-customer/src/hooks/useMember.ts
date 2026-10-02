import { createContext, useContext } from 'react';
import type { Member } from '@/types/membership';

export interface MemberState {
  /** null = pengunjung umum (belum login) */
  member: Member | null;
  login: () => Promise<void>;
  /** Kurangi saldo lokal setelah tukar reward */
  spendPoints: (points: number) => void;
}

export const MemberContext = createContext<MemberState | null>(null);

export function useMember(): MemberState {
  const state = useContext(MemberContext);
  if (!state) throw new Error('useMember harus dipakai di dalam <MemberProvider>');
  return state;
}

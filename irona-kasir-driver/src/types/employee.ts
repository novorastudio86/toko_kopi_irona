import type {AppRole} from './role';

export interface AppEmployee{
    id: string;
    fullName: string;
    roleName: string;
    hasPin: boolean;
}

export interface ActiveEmployee{
    id: string;
    fullName: string;
    role: AppRole;
}
export type PinCheckResult =
  | { ok: true; employee: ActiveEmployee }
  | { ok: false; attemptsLeft: number; lockedUntil: string | null };
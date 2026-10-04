import type { Reward } from '../../types/membership.ts';

// Import relatif + ekstensi .ts supaya bisa diuji langsung dengan node (scripts/membership.check.ts)

export function canClaim(reward: Reward, balance: number): boolean {
  return reward.availableStock > 0 && balance >= reward.pointsRequired;
}

/** Yang bisa ditukar dulu, sisanya urut poin termurah */
export function sortRewards(rewards: Reward[], balance: number): Reward[] {
  return [...rewards].sort(
    (a, b) =>
      Number(canClaim(b, balance)) - Number(canClaim(a, balance)) ||
      a.pointsRequired - b.pointsRequired
  );
}

/** Reward terdekat yang poinnya belum cukup (abaikan yang stoknya habis); null = semua terjangkau */
export function nextTarget(rewards: Reward[], balance: number) {
  const reward = rewards
    .filter((r) => r.availableStock > 0 && r.pointsRequired > balance)
    .sort((a, b) => a.pointsRequired - b.pointsRequired)[0];
  if (!reward) return null;
  return {
    reward,
    missing: reward.pointsRequired - balance,
    progress: Math.max(0, balance) / reward.pointsRequired,
  };
}

/** "21 jam lagi", "45 menit lagi", null = sudah hangus */
export function timeLeftLabel(expiresAt: string, now: number): string | null {
  const minutes = Math.floor((new Date(expiresAt).getTime() - now) / 60000);
  if (minutes < 0) return null;
  if (minutes < 60) return `${Math.max(minutes, 1)} menit lagi`;
  return `${Math.floor(minutes / 60)} jam lagi`;
}

/** 081234567890 → 0812-****-7890 */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 4)}-****-${phone.slice(-4)}`;
}

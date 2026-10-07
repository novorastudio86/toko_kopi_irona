import type { PointTier } from '../../types/reward';

export interface PointBreakdown {
  minAmount: number;
  points: number;
  count: number;
}

/**
 * Salinan logika SQL `calc_points` — dipakai untuk simulasi di form (sebelum aturan disimpan).
 * Pecah dari tingkat terbesar yang muat; sisa di bawah tingkat terkecil dibuang (tanpa pembulatan).
 */
export function calcPoints(amount: number, tiers: PointTier[]) {
  const sorted = [...tiers]
    .filter((t) => t.minAmount > 0 && t.points > 0)
    .sort((a, b) => b.minAmount - a.minAmount);
  let remaining = Math.max(0, amount);
  let points = 0;
  const breakdown: PointBreakdown[] = [];

  for (const tier of sorted) {
    const count = Math.floor(remaining / tier.minAmount);
    if (count > 0) {
      points += count * tier.points;
      remaining -= count * tier.minAmount;
      breakdown.push({ minAmount: tier.minAmount, points: tier.points, count });
    }
  }

  return { points, breakdown, leftover: remaining };
}

/** 10000 → "10rb", 1500000 → "1,5jt" */
export function shortRupiah(value: number): string {
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt`;
  if (value >= 1000)
    return `${(value / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}rb`;
  return String(value);
}

/** "30rb + 10rb×2 + sisa 6rb dibuang" */
export function describeBreakdown(breakdown: PointBreakdown[], leftover: number): string {
  const parts = breakdown.map(
    (b) => `${shortRupiah(b.minAmount)}${b.count > 1 ? `×${b.count}` : ''}`
  );
  if (leftover > 0) parts.push(`sisa ${shortRupiah(leftover)} dibuang`);
  return parts.length ? parts.join(' + ') : 'belum mencapai tingkat terkecil';
}

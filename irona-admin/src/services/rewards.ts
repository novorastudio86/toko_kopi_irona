import { supabase } from './supabase';
import { toTs } from './salesReports';
import type {
  PointRules,
  PointTier,
  RedeemReportRow,
  Reward,
  RewardClaim,
  RewardInput,
} from '../types/reward';

export async function fetchPointRules(): Promise<PointRules> {
  const [settings, tiers] = await Promise.all([
    supabase
      .from('point_earning_settings')
      .select('updated_at, employees(full_name)')
      .maybeSingle(),
    supabase.from('point_earning_tiers').select('min_amount, points').order('min_amount'),
  ]);
  if (settings.error) throw settings.error;
  if (tiers.error) throw tiers.error;

  const s: any = settings.data;
  return {
    tiers: (tiers.data ?? []).map((t: any) => ({
      minAmount: Number(t.min_amount),
      points: t.points,
    })),
    updatedAt: s?.updated_at ?? null,
    updatedByName: s?.employees?.full_name ?? null,
  };
}

/** Simpan semua tingkat sekaligus (tercatat di riwayat aturan). Tanpa pembulatan sisa. */
export async function savePointRules(tiers: PointTier[]): Promise<void> {
  const { error } = await supabase.rpc('save_point_rules', {
    p_tiers: tiers.map((t) => ({ min_amount: t.minAmount, points: t.points })),
    p_rounding_threshold: 0,
  });
  if (error) throw error;
}

export async function fetchRewards(): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('reward_overview')
    .select(
      'id, name, product_id, points_required, stock, available_stock, notes, is_active, claim_count, redeemed_count, pending_count'
    )
    .order('points_required');
  if (error) throw error;

  const productIds = [...new Set((data ?? []).map((r: any) => r.product_id))];
  const names = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);
    if (pErr) throw pErr;
    (products ?? []).forEach((p: any) => names.set(p.id, p.name));
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    productId: row.product_id,
    productName: names.get(row.product_id) ?? '—',
    pointsRequired: row.points_required,
    stock: row.stock,
    availableStock: Number(row.available_stock ?? 0),
    notes: row.notes,
    isActive: row.is_active,
    claimCount: Number(row.claim_count ?? 0),
    redeemedCount: Number(row.redeemed_count ?? 0),
    pendingCount: Number(row.pending_count ?? 0),
  }));
}

export async function saveReward(input: RewardInput, id: string | null): Promise<void> {
  const { error } = await supabase.rpc('save_reward', {
    p_id: id,
    p_name: input.name,
    p_product_id: input.productId,
    p_points_required: input.pointsRequired,
    p_stock: input.stock,
    p_notes: input.notes,
  });
  if (error) throw error;
}

/** Kode yang sudah diklaim tetap berlaku sampai ditukar / hangus */
export async function setRewardActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_reward_active', { p_id: id, p_active: active });
  if (error) throw error;
}

/** Hanya kalau belum pernah diklaim */
export async function deleteReward(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_reward', { p_id: id });
  if (error) throw error;
}

export async function fetchRewardClaims(rewardId: string): Promise<RewardClaim[]> {
  const [claims, customers] = await Promise.all([
    supabase
      .from('reward_claim_overview')
      .select(
        'id, customer_id, code, points_used, claimed_at, expires_at, redeemed_at, cancelled_at, cancel_reason, status'
      )
      .eq('reward_id', rewardId)
      .order('claimed_at', { ascending: false }),
    supabase.from('customers').select('id, name, phone_number'),
  ]);
  if (claims.error) throw claims.error;
  if (customers.error) throw customers.error;

  const byId = new Map((customers.data ?? []).map((c: any) => [c.id, c]));
  return (claims.data ?? []).map((row: any) => {
    const c: any = byId.get(row.customer_id);
    return {
      id: row.id,
      customerName: c?.name ?? '—',
      phoneNumber: c?.phone_number ?? '',
      code: row.code,
      pointsUsed: row.points_used,
      claimedAt: row.claimed_at,
      expiresAt: row.expires_at,
      redeemedAt: row.redeemed_at,
      cancelledAt: row.cancelled_at,
      cancelReason: row.cancel_reason,
      status: row.status,
    };
  });
}

/** Semua klaim reward yang diklaim di rentang tanggal lokal (inklusif), terbaru dulu */
export async function fetchRedeemReport(start: string, end: string): Promise<RedeemReportRow[]> {
  const ts = toTs(start, end);
  const [claims, customers, rewards] = await Promise.all([
    supabase
      .from('reward_claim_overview')
      .select(
        'id, reward_id, customer_id, code, points_used, claimed_at, expires_at, redeemed_at, cancelled_at, cancel_reason, status'
      )
      .gte('claimed_at', ts.start)
      .lt('claimed_at', ts.end)
      .order('claimed_at', { ascending: false }),
    supabase.from('customers').select('id, name, phone_number'),
    supabase.from('rewards').select('id, name'),
  ]);
  if (claims.error) throw claims.error;
  if (customers.error) throw customers.error;
  if (rewards.error) throw rewards.error;

  const customerById = new Map((customers.data ?? []).map((c: any) => [c.id, c]));
  const rewardById = new Map((rewards.data ?? []).map((r: any) => [r.id, r.name]));
  return (claims.data ?? []).map((row: any) => {
    const c: any = customerById.get(row.customer_id);
    return {
      id: row.id,
      rewardName: rewardById.get(row.reward_id) ?? '—',
      customerName: c?.name ?? '—',
      phoneNumber: c?.phone_number ?? '',
      code: row.code,
      pointsUsed: row.points_used,
      claimedAt: row.claimed_at,
      expiresAt: row.expires_at,
      redeemedAt: row.redeemed_at,
      cancelledAt: row.cancelled_at,
      cancelReason: row.cancel_reason,
      status: row.status,
    };
  });
}

/** Member tidak jadi pesan: batalkan klaim yang masih Menunggu Ditukar, poin dikembalikan. Mengembalikan saldo baru. */
export async function cancelRewardClaim(claimId: string, reason: string): Promise<number> {
  const { data, error } = await supabase.rpc('cancel_reward_claim', {
    p_claim_id: claimId,
    p_reason: reason,
  });
  if (error) throw error;
  return Number(data);
}

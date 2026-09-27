import { supabase } from './supabase';
import type {
  ProductOption,
  Promotion,
  PromotionClaim,
  PromotionHistoryEntry,
  PromotionInput,
} from '../types/promotion';

export async function fetchPromotions(): Promise<Promotion[]> {
  const [overview, links] = await Promise.all([
    supabase.from('promotion_overview').select('*').order('start_date', { ascending: false }),
    supabase.from('promotion_products').select('promotion_id, product_id, products(name)'),
  ]);
  if (overview.error) throw overview.error;
  if (links.error) throw links.error;

  const productsByPromo = new Map<string, { id: string; name: string }[]>();
  (links.data ?? []).forEach((l: any) => {
    const list = productsByPromo.get(l.promotion_id) ?? [];
    list.push({ id: l.product_id, name: l.products?.name ?? '—' });
    productsByPromo.set(l.promotion_id, list);
  });

  return (overview.data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    channel: row.channel,
    discountTarget: row.discount_target,
    discountKind: row.discount_kind,
    discountValue: Number(row.discount_value ?? 0),
    maxDistanceKm: row.max_distance_km === null ? null : Number(row.max_distance_km),
    appliesToAllProducts: row.applies_to_all_products,
    productIds: (productsByPromo.get(row.id) ?? []).map((p) => p.id),
    productNames: (productsByPromo.get(row.id) ?? []).map((p) => p.name).sort(),
    promoType: row.promo_type,
    targetCustomer: row.target_customer,
    minPurchaseType: row.min_purchase_type,
    minPurchaseValue: Number(row.min_purchase_value ?? 0),
    isRepeatable: row.is_repeatable,
    maxOneClaimPerCustomer: row.max_one_claim_per_customer,
    appliesToTakeAway: row.applies_to_take_away,
    startDate: row.start_date,
    endDate: row.end_date,
    validDays: row.valid_days ?? [],
    validStartTime: row.valid_start_time,
    validEndTime: row.valid_end_time,
    isActive: row.is_active,
    status: row.status,
    isUpcoming: row.is_upcoming,
    usedCount: Number(row.used_count ?? 0),
    claimCount: Number(row.claim_count ?? 0),
  }));
}

/** Produk untuk dipilih di form diskon */
export async function fetchProductOptions(): Promise<ProductOption[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, selling_price, is_active, categories(name)')
    .order('name');
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    categoryName: row.categories?.name ?? 'Tanpa Kategori',
    sellingPrice: Number(row.selling_price ?? 0),
    isActive: row.is_active,
  }));
}

export async function savePromotion(input: PromotionInput, id: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('save_promotion', {
    p_id: id,
    p_data: {
      name: input.name,
      description: input.description,
      channel: input.channel,
      discount_target: input.discountTarget,
      discount_kind: input.discountKind,
      discount_value: input.discountValue,
      max_distance_km: input.maxDistanceKm,
      applies_to_all_products: input.appliesToAllProducts,
      promo_type: input.promoType,
      target_customer: input.targetCustomer,
      min_purchase_type: input.minPurchaseType,
      min_purchase_value: input.minPurchaseValue,
      is_repeatable: input.isRepeatable,
      max_one_claim_per_customer: input.maxOneClaimPerCustomer,
      applies_to_take_away: input.appliesToTakeAway,
      start_date: input.startDate,
      end_date: input.endDate,
      valid_days: input.validDays,
      valid_start_time: input.validStartTime,
      valid_end_time: input.validEndTime,
    },
    p_product_ids:
      input.discountTarget === 'ongkir' || input.appliesToAllProducts ? [] : input.productIds,
  });
  if (error) throw error;
  return data as string;
}

export async function setPromotionActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_promotion_active', { p_id: id, p_active: active });
  if (error) throw error;
}

/** Hanya kalau belum pernah dipakai transaksi / diklaim */
export async function deletePromotion(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_promotion', { p_id: id });
  if (error) throw error;
}

export async function fetchPromotionHistory(id: string): Promise<PromotionHistoryEntry[]> {
  const { data, error } = await supabase
    .from('promotion_history')
    .select('id, action, before_data, after_data, created_at, employees(full_name)')
    .eq('promotion_id', id)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    action: row.action,
    before: row.before_data,
    after: row.after_data,
    changedByName: row.employees?.full_name ?? null,
    createdAt: row.created_at,
  }));
}

export async function fetchPromotionClaims(id: string): Promise<PromotionClaim[]> {
  const { data, error } = await supabase
    .from('promotion_claims')
    .select('id, claimed_at, used_at, customers(name, phone_number)')
    .eq('promotion_id', id)
    .order('claimed_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    customerName: row.customers?.name ?? '—',
    phoneNumber: row.customers?.phone_number ?? '',
    claimedAt: row.claimed_at,
    usedAt: row.used_at,
  }));
}

import { supabase } from './supabase';
import type {
  DeliverySettings,
  OnlineOrderHistoryEntry,
  OnlineOrderSettings,
  OnlineProductOption,
  PausedProduct,
} from '../types/onlineOrder';

export async function fetchOnlineOrderSettings(): Promise<OnlineOrderSettings> {
  const { data, error } = await supabase.from('online_order_settings').select('*').single();
  if (error) throw error;
  return {
    feePerStep: Number(data.fee_per_step),
    stepKm: Number(data.step_km),
    feePer100m: Number(data.fee_per_100m),
    maxDistanceKm: Number(data.max_distance_km),
    serviceFee: Number(data.service_fee),
    mdrPercent: Number(data.mdr_percent),
    ppnPercent: Number(data.ppn_percent),
  };
}

export async function fetchPausedProducts(): Promise<PausedProduct[]> {
  const { data, error } = await supabase
    .from('online_product_pauses')
    .select('product_id, paused_at, products(name)')
    .order('paused_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    productId: row.product_id,
    productName: row.products?.name ?? '—',
    pausedAt: row.paused_at,
  }));
}

/** Produk yang tampil di Web Customer (aktif + tersedia online) — kandidat untuk dijeda */
export async function fetchOnlineProducts(): Promise<OnlineProductOption[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, categories(name)')
    .eq('is_active', true)
    .eq('available_online', true)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    categoryName: row.categories?.name ?? '',
  }));
}

export async function pauseProductOnline(productId: string): Promise<void> {
  const { error } = await supabase.rpc('pause_product_online', { p_product_id: productId });
  if (error) throw error;
}

export async function resumeProductOnline(productId: string): Promise<void> {
  const { error } = await supabase.rpc('resume_product_online', { p_product_id: productId });
  if (error) throw error;
}

export async function saveDeliverySettings(s: DeliverySettings): Promise<void> {
  const { error } = await supabase.rpc('save_delivery_settings', {
    p_fee_per_step: s.feePerStep,
    p_step_km: s.stepKm,
    p_fee_per_100m: s.feePer100m,
    p_max_distance_km: s.maxDistanceKm,
  });
  if (error) throw error;
}

export async function saveServiceFee(fee: number): Promise<void> {
  const { error } = await supabase.rpc('save_service_fee', { p_service_fee: fee });
  if (error) throw error;
}

export async function fetchOnlineOrderHistory(): Promise<OnlineOrderHistoryEntry[]> {
  const { data, error } = await supabase
    .from('online_order_history')
    .select('id, section, description, before_data, after_data, created_at, employees(full_name)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    section: row.section,
    description: row.description,
    before: row.before_data,
    after: row.after_data,
    changedByName: row.employees?.full_name ?? null,
    createdAt: row.created_at,
  }));
}

/**
 * Salinan logika SQL `calc_delivery_fee` — untuk simulasi langsung di form (sebelum disimpan).
 * Dihitung dalam meter supaya tidak ada selisih desimal.
 */
export function calcDeliveryFee(distanceKm: number, s: DeliverySettings) {
  if (distanceKm > s.maxDistanceKm) return { deliverable: false as const };
  const distanceM = Math.round(distanceKm * 1000);
  const stepM = Math.round(s.stepKm * 1000);
  const steps = Math.floor(distanceM / stepM);
  const remainderM = distanceM - steps * stepM;
  const units = Math.ceil(remainderM / 100);
  const stepFee = steps * s.feePerStep;
  const remainderFee = units * s.feePer100m;
  return {
    deliverable: true as const,
    fee: stepFee + remainderFee,
    steps,
    stepFee,
    remainderM,
    remainderFee,
  };
}

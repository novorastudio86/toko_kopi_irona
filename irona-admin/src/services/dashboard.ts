import { supabase } from './supabase';
import type { BreakdownRow, DashboardData, PeriodStats } from '../types/dashboard';

const num = (v: unknown) => Number(v ?? 0);

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'Dine-In',
  take_away: 'Takeaway',
  online: 'Online',
};
const PAYMENT_LABELS: Record<string, string> = { qris: 'QRIS', tunai: 'Cash' };

function mapStats(s: any): PeriodStats {
  return {
    sales: num(s?.sales),
    paidSales: num(s?.paid_sales),
    promoCost: num(s?.promo_cost),
    transactions: num(s?.transactions),
    transactionsOffline: num(s?.transactions_offline),
    transactionsOnline: num(s?.transactions_online),
    productsSold: num(s?.products_sold),
    productsOffline: num(s?.products_offline),
    productsOnline: num(s?.products_online),
  };
}

function mapRows(
  rows: any[],
  label: (r: any) => string,
  count: (r: any) => number
): BreakdownRow[] {
  return (rows ?? []).map((r) => ({
    key: String(r.key ?? r.name),
    label: label(r),
    amount: num(r.amount),
    count: count(r),
  }));
}

export async function fetchDashboard(input: {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  granularity: 'hour' | 'day';
}): Promise<DashboardData> {
  const { data, error } = await supabase.rpc('dashboard_summary', {
    p_start: input.start,
    p_end: input.end,
    p_prev_start: input.prevStart,
    p_prev_end: input.prevEnd,
    p_granularity: input.granularity,
  });
  if (error) throw error;
  const d: any = data;
  return {
    current: mapStats(d.current),
    previous: mapStats(d.previous),
    series: (d.series ?? []).map((p: any) => ({ bucket: num(p.bucket), amount: num(p.amount) })),
    previousSeries: (d.previous_series ?? []).map((p: any) => ({
      bucket: num(p.bucket),
      amount: num(p.amount),
    })),
    byCashier: mapRows(
      d.by_cashier,
      (r) => r.name,
      (r) => num(r.transactions)
    ),
    byOrderType: mapRows(
      d.by_order_type,
      (r) => ORDER_TYPE_LABELS[r.key] ?? r.key,
      (r) => num(r.transactions)
    ),
    byPayment: mapRows(
      d.by_payment,
      (r) => PAYMENT_LABELS[r.key] ?? r.key,
      (r) => num(r.transactions)
    ),
    byCategory: mapRows(
      d.by_category,
      (r) => r.name,
      (r) => num(r.qty)
    ),
    topProducts: mapRows(
      d.top_products,
      (r) => r.name,
      (r) => num(r.qty)
    ),
    lowStock: (d.low_stock ?? []).map((r: any) => ({
      name: r.name,
      stock: num(r.stock),
      minStock: num(r.min_stock),
      unit: r.unit ?? '',
      ratio: num(r.ratio),
    })),
    targets: { daily: num(d.targets?.daily), monthly: num(d.targets?.monthly) },
    generatedAt: d.generated_at,
  };
}

/** Jam buka–tutup toko (offline) untuk hari tertentu, dipakai sumbu X grafik harian */
export async function fetchStoreHoursForDay(
  dayOfWeek: number
): Promise<{ open: string; close: string } | null> {
  const { data, error } = await supabase
    .from('store_hours')
    .select('is_open, open_time, close_time')
    .eq('channel', 'offline')
    .eq('day_of_week', dayOfWeek)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_open) return null;
  return { open: data.open_time, close: data.close_time };
}

export async function saveSalesTargets(daily: number, monthly: number): Promise<void> {
  const { error } = await supabase.rpc('save_sales_targets', {
    p_daily: daily,
    p_monthly: monthly,
  });
  if (error) throw error;
}

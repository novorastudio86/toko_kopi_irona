import { supabase } from './supabase';
import { toTs } from './salesReports';
import type { PeakCell, StockCycleRow } from '../types/trendReport';

const num = (v: unknown) => Number(v ?? 0);
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function fetchPeakProducts(f: {
  start: string;
  end: string;
  productId?: string | null;
  categoryId?: string | null;
}): Promise<PeakCell[]> {
  const ts = toTs(f.start, f.end);
  const { data, error } = await supabase.rpc('report_peak_products', {
    p_start: ts.start,
    p_end: ts.end,
    p_product_id: f.productId ?? null,
    p_category_id: f.categoryId ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    dow: num(r.dow),
    hour: num(r.hour),
    quantity: num(r.quantity),
    transactions: 0,
    sales: 0,
  }));
}

export async function fetchPeakTransactions(f: {
  start: string;
  end: string;
  channel?: 'offline' | 'online' | null;
  orderType?: 'dine_in' | 'take_away' | 'online' | null;
}): Promise<PeakCell[]> {
  const ts = toTs(f.start, f.end);
  const { data, error } = await supabase.rpc('report_peak_transactions', {
    p_start: ts.start,
    p_end: ts.end,
    p_channel: f.channel ?? null,
    p_order_type: f.orderType ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    dow: num(r.dow),
    hour: num(r.hour),
    quantity: 0,
    transactions: num(r.transactions),
    sales: num(r.sales),
  }));
}

export async function fetchStockCycle(start: string, end: string): Promise<StockCycleRow[]> {
  const { data, error } = await supabase.rpc('report_stock_cycle', {
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    rawMaterialId: r.raw_material_id,
    name: r.name,
    materialType: r.material_type,
    unitName: r.unit_name,
    isActive: Boolean(r.is_active),
    openingStock: num(r.opening_stock),
    closingStock: num(r.closing_stock),
    used: num(r.used),
    avgStock: num(r.avg_stock),
    turnover: numOrNull(r.turnover),
    daysCover: numOrNull(r.days_cover),
  }));
}

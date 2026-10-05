import { supabase } from './supabase';
import type {
  StockAdjustmentRow,
  StockPurchaseRow,
  StockSummaryRow,
} from '../types/inventoryReport';

const num = (v: unknown) => Number(v ?? 0);
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Persediaan per akhir tanggal lokal "YYYY-MM-DD" */
export async function fetchStockSummary(date: string): Promise<StockSummaryRow[]> {
  const { data, error } = await supabase.rpc('report_stock_summary', { p_date: date });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    itemType: r.item_type,
    itemId: r.item_id,
    name: r.name,
    materialType: r.material_type,
    unitName: r.unit_name,
    quantity: num(r.quantity),
    unitPrice: num(r.unit_price),
    totalValue: num(r.total_value),
    isActive: Boolean(r.is_active),
  }));
}

export async function fetchStockPurchases(start: string, end: string): Promise<StockPurchaseRow[]> {
  const { data, error } = await supabase.rpc('report_stock_purchases', {
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    movementId: r.movement_id,
    movementDate: r.movement_date,
    rawMaterialId: r.raw_material_id,
    name: r.name,
    quantity: num(r.quantity),
    baseUnit: r.base_unit,
    purchaseQty: numOrNull(r.purchase_qty),
    purchaseUnit: r.purchase_unit,
    qtyPerPackage: numOrNull(r.qty_per_package),
    totalPrice: num(r.total_price),
    unitPrice: numOrNull(r.unit_price),
    notes: r.notes,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  }));
}

export async function fetchStockAdjustments(
  start: string,
  end: string
): Promise<StockAdjustmentRow[]> {
  const { data, error } = await supabase.rpc('report_stock_adjustments', {
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    movementId: r.movement_id,
    movementDate: r.movement_date,
    itemType: r.item_type,
    itemId: r.item_id,
    name: r.name,
    reason: r.reason,
    quantity: num(r.quantity),
    unitName: r.unit_name,
    unitPrice: num(r.unit_price),
    value: num(r.value),
    notes: r.notes,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  }));
}

import { supabase } from './supabase';
import type { StockCardRow, StockMovementRow } from '../types/stock';
import { fetchRawMaterials } from './rawMaterials';

export async function fetchStockCard(start: string, end: string): Promise<StockCardRow[]> {
  const { data, error } = await supabase.rpc('stock_card', { p_start: start, p_end: end });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    itemType: row.item_type,
    itemId: row.item_id,
    itemName: row.item_name,
    unitName: row.unit_name,
    opening: Number(row.opening),
    incoming: Number(row.incoming),
    sold: Number(row.sold),
    adjustment: Number(row.adjustment),
    production: Number(row.production),
    closing: Number(row.closing),
    minStock: Number(row.min_stock),
  }));
}

/** Riwayat mutasi satu item dalam periode, untuk baris expand */
export async function fetchItemMovements(
  itemType: 'bahan_baku' | 'racikan',
  itemId: string,
  start: string,
  end: string
): Promise<StockMovementRow[]> {
  const column = itemType === 'bahan_baku' ? 'raw_material_id' : 'racikan_id';

  const [movementRes, unitRes] = await Promise.all([
    supabase
      .from('stock_movements')
      .select('id, movement_type, quantity, unit_id, purchase_qty, total_price, adjustment_reason, notes, movement_date')
      .eq(column, itemId)
      .gte('movement_date', start)
      .lte('movement_date', end)
      .order('movement_date', { ascending: false }),
    supabase.from('units').select('id, name'),
  ]);

  if (movementRes.error) throw movementRes.error;
  if (unitRes.error) throw unitRes.error;

  const unitNames = new Map((unitRes.data ?? []).map((u: any) => [u.id, u.name as string]));

  return (movementRes.data ?? []).map((row: any) => ({
    id: row.id,
    movementType: row.movement_type,
    quantity: Number(row.quantity),
    unitName: unitNames.get(row.unit_id) ?? '',
    purchaseQty: row.purchase_qty === null ? null : Number(row.purchase_qty),
    totalPrice: row.total_price === null ? null : Number(row.total_price),
    adjustmentReason: row.adjustment_reason,
    notes: row.notes,
    movementDate: row.movement_date,
  }));
}

export type BatchRacikanOption = { id: string; name: string; unitName: string; currentStock: number };

/** Racikan Batch aktif (yang punya stok produksi) */
export async function fetchBatchRacikan(): Promise<BatchRacikanOption[]> {
  const [racikanRes, unitRes] = await Promise.all([
    supabase
      .from('racikan')
      .select('id, name, unit_id, current_stock')
      .eq('is_active', true)
      .eq('production_mode', 'batch')
      .order('name'),
    supabase.from('units').select('id, name'),
  ]);
  if (racikanRes.error) throw racikanRes.error;
  if (unitRes.error) throw unitRes.error;

  const unitNames = new Map((unitRes.data ?? []).map((u: any) => [u.id, u.name as string]));
  return (racikanRes.data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    unitName: unitNames.get(r.unit_id) ?? '',
    currentStock: Number(r.current_stock ?? 0),
  }));
}

export async function recordStockIn(input: {
  rawMaterialId: string;
  purchaseUnitId: string | null;
  purchaseQty: number;
  qtyPerPackage: number;
  totalPrice: number;
  movementDate: string;
  notes: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('record_stock_in', {
    p_raw_material_id: input.rawMaterialId,
    p_purchase_unit_id: input.purchaseUnitId,
    p_purchase_qty: input.purchaseQty,
    p_qty_per_package: input.qtyPerPackage,
    p_total_price: input.totalPrice,
    p_movement_date: input.movementDate,
    p_notes: input.notes,
  });
  if (error) throw error;
}

export async function recordStockAdjustment(input: {
  itemType: 'bahan_baku' | 'racikan';
  itemId: string;
  physicalQty: number;
  reason: string;
  notes: string | null;
  movementDate: string;
}): Promise<void> {
  const { error } = await supabase.rpc('record_stock_adjustment', {
    p_item_type: input.itemType,
    p_item_id: input.itemId,
    p_physical_qty: input.physicalQty,
    p_reason: input.reason,
    p_notes: input.notes,
    p_movement_date: input.movementDate,
  });
  if (error) throw error;
}

export async function recordRacikanProduction(input: {
  racikanId: string;
  batchQty: number;
  movementDate: string;
  notes: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('record_racikan_production', {
    p_racikan_id: input.racikanId,
    p_batch_qty: input.batchQty,
    p_movement_date: input.movementDate,
    p_notes: input.notes,
  });
  if (error) throw error;
}

/** Stok semua bahan baku, untuk pratinjau kebutuhan produksi */
export async function fetchMaterialStockMap(): Promise<Map<string, { name: string; unitName: string; stock: number }>> {
  const materials = await fetchRawMaterials();
  return new Map(
    materials.map((m) => [m.id, { name: m.name, unitName: m.unitName, stock: m.currentStock }])
  );
}
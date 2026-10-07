import { supabase } from './supabase';
import type { RawMaterialListItem } from '../types/rawMaterial';
import type { RawMaterialDetail, RawMaterialInput } from '../types/rawMaterial';
import type { HistoryEntry } from '../types/history';
import { historySince } from '../utils/date';

export async function fetchRawMaterials(): Promise<RawMaterialListItem[]> {
  const [materialRes, unitRes] = await Promise.all([
    supabase
      .from('raw_materials')
      .select('id, name, material_type, base_unit_id, unit_price, current_stock, min_stock_alert, is_active')
      .order('name'),
    supabase.from('units').select('id, name'),
  ]);

  if (materialRes.error) throw materialRes.error;
  if (unitRes.error) throw unitRes.error;

  const unitNames = new Map((unitRes.data ?? []).map((u: any) => [u.id, u.name as string]));

  return (materialRes.data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    materialType: row.material_type,
    unitName: unitNames.get(row.base_unit_id) ?? '-',
    unitPrice: row.unit_price === null ? null : Number(row.unit_price),
    currentStock: Number(row.current_stock ?? 0),
    minStockAlert: Number(row.min_stock_alert ?? 0),
    isActive: row.is_active,
  }));
}

export async function setRawMaterialActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('raw_materials').update({ is_active: active }).eq('id', id);
  if (error) throw error;
}

export async function deleteRawMaterial(id: string): Promise<void> {
  const { error } = await supabase.from('raw_materials').delete().eq('id', id);
  if (error) throw error;
}


function toRow(input: RawMaterialInput) {
  return {
    name: input.name,
    material_type: input.materialType,
    base_unit_id: input.baseUnitId,
    default_purchase_unit_id: input.defaultPurchaseUnitId,
    default_qty_per_package: input.defaultQtyPerPackage,
    min_stock_alert: input.minStockAlert,
  };
}

export async function fetchRawMaterialDetail(id: string): Promise<RawMaterialDetail | null> {
  const { data, error } = await supabase
    .from('raw_materials')
    .select(
      'id, name, material_type, base_unit_id, default_purchase_unit_id, default_qty_per_package, unit_price, current_stock, min_stock_alert, is_active'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row: any = data;
  return {
    id: row.id,
    name: row.name,
    materialType: row.material_type,
    baseUnitId: row.base_unit_id,
    defaultPurchaseUnitId: row.default_purchase_unit_id,
    defaultQtyPerPackage: row.default_qty_per_package === null ? null : Number(row.default_qty_per_package),
    minStockAlert: Number(row.min_stock_alert ?? 0),
    unitPrice: row.unit_price === null ? null : Number(row.unit_price),
    currentStock: Number(row.current_stock ?? 0),
    isActive: row.is_active,
  };
}

/** Cek nama bahan sudah dipakai (tidak peka huruf besar/kecil) */
export async function isRawMaterialNameTaken(name: string, excludeId?: string): Promise<boolean> {
  const escaped = name.replace(/[%_\\]/g, (m) => `\\${m}`);
  let query = supabase.from('raw_materials').select('id', { count: 'exact', head: true }).ilike('name', escaped);
  if (excludeId) query = query.neq('id', excludeId);
  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function createRawMaterial(input: RawMaterialInput): Promise<string> {
  const { data, error } = await supabase
    .from('raw_materials')
    .insert({ ...toRow(input), current_stock: 0, is_active: true })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateRawMaterial(id: string, input: RawMaterialInput): Promise<void> {
  const { error } = await supabase.from('raw_materials').update(toRow(input)).eq('id', id);
  if (error) throw error;
}

/** Satuan baru dari tombol "+ Tambah Satuan Baru" */
export async function createUnit(name: string): Promise<string> {
  const { data, error } = await supabase.from('units').insert({ name }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

import type { RawMaterialUsage } from '../types/rawMaterial';

export async function fetchRawMaterialUsage(materialId: string): Promise<RawMaterialUsage[]> {
  const { data, error } = await supabase
    .from('raw_material_usage')
    .select('*')
    .eq('raw_material_id', materialId);
  if (error) throw error;

  return (data ?? [])
    .map((row: any) => ({
      usageType: row.usage_type,
      itemId: row.item_id,
      itemName: row.item_name,
      categoryName: row.category_name,
      viaName: row.via_name,
      quantity: Number(row.quantity),
      unitName: row.unit_name ?? '',
    }))
    // Racikan ditaruh di atas, sisanya urut nama
    .sort((a, b) =>
      a.usageType === b.usageType
        ? a.itemName.localeCompare(b.itemName, 'id')
        : a.usageType === 'racikan'
          ? -1
          : 1
    );
}
const UNIT_FIELDS = ['base_unit_id', 'default_purchase_unit_id'];

/** Riwayat dari trigger `log_raw_material_history`; id satuan langsung diganti nama satuannya */
export async function fetchRawMaterialHistory(): Promise<HistoryEntry[]> {
  const [historyRes, unitRes] = await Promise.all([
    supabase
      .from('raw_material_history')
      .select('id, raw_material_name, action, changes, changed_at')
      .gte('changed_at', historySince())
      .order('changed_at', { ascending: false }),
    supabase.from('units').select('id, name'),
  ]);
  if (historyRes.error) throw historyRes.error;
  if (unitRes.error) throw unitRes.error;

  const unitNames = new Map((unitRes.data ?? []).map((u: any) => [u.id, u.name as string]));
  const unitName = (v: unknown) => (v ? unitNames.get(v as string) ?? '—' : null);

  return (historyRes.data ?? []).map((row: any) => {
    const changes = row.changes as HistoryEntry['changes'];
    for (const k of UNIT_FIELDS) {
      if (changes?.[k]) changes[k] = { from: unitName(changes[k].from), to: unitName(changes[k].to) };
    }
    return {
      id: row.id,
      subject: row.raw_material_name,
      action: row.action,
      changes,
      changedAt: row.changed_at,
    };
  });
}

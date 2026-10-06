import { supabase } from './supabase';
import type { LowStockItem } from '../types/product';
import type { RecipeListItem, RecipeType } from '../types/recipe';
import { fetchProductDetail, saveProduct } from './products';
import type { RacikanDetail, RacikanSaveInput, UnitOption } from '../types/recipe';
import type { HistoryEntry } from '../types/history';
import { historySince } from '../utils/date';

function toNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export async function fetchRecipeList(): Promise<RecipeListItem[]> {
  const { data, error } = await supabase.from('recipe_list').select('*').order('name');
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    recipeType: row.recipe_type,
    name: row.name,
    categoryName: row.category_name,
    componentCount: Number(row.component_count ?? 0),
    cost: Number(row.cost ?? 0),
    addCostPercentage: Number(row.add_cost_percentage ?? 0),
    totalCost: Number(row.total_cost ?? 0),
    recipeStatus: row.recipe_status,
    isActive: row.is_active,
    unit: row.unit,
    desiredCostPercentage: toNumber(row.desired_cost_percentage),
    sellingPrice: toNumber(row.selling_price),
    productionMode: row.production_mode,
    yieldQty: toNumber(row.yield_qty),
    totalOutputQty: toNumber(row.total_output_qty),
    currentStock: toNumber(row.current_stock),
    minStockAlert: toNumber(row.min_stock_alert),
  }));
}

/** Komponen mentah satu resep: { type, id, quantity } */
export async function fetchRecipeComponents(
  recipeType: RecipeType,
  id: string
): Promise<{ type: 'bahan_baku' | 'racikan'; id: string; quantity: number }[]> {
  if (recipeType === 'produk') {
    const { data, error } = await supabase
      .from('product_recipe_components')
      .select('component_type, raw_material_id, racikan_id, quantity')
      .eq('product_id', id);
    if (error) throw error;
    return (data ?? []).map((c: any) => ({
      type: c.component_type,
      id: c.component_type === 'bahan_baku' ? c.raw_material_id : c.racikan_id,
      quantity: Number(c.quantity),
    }));
  }

  const { data, error } = await supabase
    .from('racikan_components')
    .select('component_type, raw_material_id, component_racikan_id, quantity')
    .eq('racikan_id', id);
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    type: c.component_type,
    id: c.component_type === 'bahan_baku' ? c.raw_material_id : c.component_racikan_id,
    quantity: Number(c.quantity),
  }));
}

/** Bahan menipis per racikan: Map<racikanId, LowStockItem[]> */
export async function fetchRacikanLowStockMap(): Promise<Map<string, LowStockItem[]>> {
  const { data, error } = await supabase.from('racikan_low_stock').select('*');
  if (error) throw error;

  const map = new Map<string, LowStockItem[]>();
  (data ?? []).forEach((row: any) => {
    const list = map.get(row.racikan_id) ?? [];
    list.push({
      itemType: row.item_type,
      itemId: row.item_id,
      name: row.item_name,
      unitName: row.unit_name ?? '',
      currentStock: Number(row.current_stock),
      minStock: Number(row.min_stock_alert),
      qtyPerPortion: Number(row.qty_per_batch),
    });
    map.set(row.racikan_id, list);
  });
  return map;
}

export async function deleteRacikan(id: string): Promise<void> {
  const { error } = await supabase.from('racikan').delete().eq('id', id);
  if (error) throw error;
}




export async function fetchUnits(): Promise<UnitOption[]> {
  const { data, error } = await supabase.from('units').select('id, name').order('name');
  if (error) throw error;
  return (data ?? []) as UnitOption[];
}

export async function fetchRacikanDetail(id: string): Promise<RacikanDetail | null> {
  const [racikanRes, componentRes] = await Promise.all([
    supabase
      .from('racikan')
      .select('id, name, unit_id, production_mode, yield_qty, total_output_qty, add_cost_percentage, min_stock_alert')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('racikan_components')
      .select('component_type, raw_material_id, component_racikan_id, quantity')
      .eq('racikan_id', id),
  ]);

  if (racikanRes.error) throw racikanRes.error;
  if (componentRes.error) throw componentRes.error;
  const row: any = racikanRes.data;
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    unitId: row.unit_id,
    productionMode: row.production_mode,
    yieldQty: Number(row.yield_qty),
    totalOutputQty: Number(row.total_output_qty),
    addCostPercentage: Number(row.add_cost_percentage ?? 0),
    minStockAlert: row.min_stock_alert === null ? null : Number(row.min_stock_alert),
    components: (componentRes.data ?? []).map((c: any) => ({
      type: c.component_type,
      id: c.component_type === 'bahan_baku' ? c.raw_material_id : c.component_racikan_id,
      quantity: Number(c.quantity),
    })),
  };
}

/** Simpan racikan + komponennya lewat fungsi database save_racikan */
export async function saveRacikan(input: RacikanSaveInput, racikanId: string | null = null): Promise<string> {
  const { data, error } = await supabase.rpc('save_racikan', {
    p_racikan_id: racikanId,
    p_data: {
      name: input.name,
      unit_id: input.unitId,
      production_mode: input.productionMode,
      yield_qty: input.yieldQty,
      total_output_qty: input.totalOutputQty,
      add_cost_percentage: input.addCostPercentage,
      min_stock_alert: input.minStockAlert,
      is_active: true,
    },
    p_components: input.components.map((c) => ({
      component_type: c.type,
      raw_material_id: c.type === 'bahan_baku' ? c.id : null,
      racikan_id: c.type === 'racikan' ? c.id : null,
      quantity: c.quantity,
      unit_id: c.unitId,
    })),
  });
  if (error) throw error;
  return data as string;
}

/** Simpan resep + harga untuk produk yang sudah ada (data produk lain dipertahankan) */
export async function saveProductRecipe(
  productId: string,
  payload: {
    addCostPercentage: number;
    desiredCostPercentage: number;
    sellingPrice: number;
    recipe: { type: 'bahan_baku' | 'racikan'; id: string; quantity: number; unitId: string }[];
  }
): Promise<void> {
  const detail = await fetchProductDetail(productId);
  if (!detail) throw new Error('Produk tidak ditemukan.');

  await saveProduct(
    {
      name: detail.name,
      description: detail.description,
      photoUrl: detail.photoUrl,
      categoryId: detail.categoryId,
      unit: detail.unit,
      sku: detail.sku ?? '',
      availableOffline: detail.availableOffline,
      availableOnline: detail.availableOnline,
      recipeStatus: 'lengkap',
      // Produk yang tadinya belum lengkap (resep "Isi Nanti" / harga kosong) otomatis aktif setelah dilengkapi
      isActive:
        detail.recipeStatus === 'belum_lengkap' || !(Number(detail.sellingPrice) > 0) ? true : detail.isActive,
      baseCost: null,
      addCostPercentage: payload.addCostPercentage,
      desiredCostPercentage: payload.desiredCostPercentage,
      sellingPrice: payload.sellingPrice,
      recipe: payload.recipe.map((r) => ({
        type: r.type,
        rawMaterialId: r.type === 'bahan_baku' ? r.id : null,
        racikanId: r.type === 'racikan' ? r.id : null,
        quantity: r.quantity,
        unitId: r.unitId,
      })),
    },
    productId
  );
}

/** Riwayat perubahan resep produk & racikan 14 hari terakhir (trigger `log_recipe_history`) */
export async function fetchRecipeHistory(): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from('recipe_history')
    .select('id, recipe_type, recipe_name, action, changes, changed_at')
    .gte('changed_at', historySince())
    .order('seq', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    subject: row.recipe_name,
    tag: row.recipe_type === 'produk' ? 'Produk' : 'Racikan',
    action: row.action,
    changes: row.changes,
    changedAt: row.changed_at,
  }));
}

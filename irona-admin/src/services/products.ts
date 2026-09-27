import { supabase } from './supabase';
import type {
  LowStockItem,
  ProductDetail,
  ProductListItem,
  ProductSaveInput,
  RecipeSource,
} from '../types/product';

function toNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export async function fetchProductList(): Promise<ProductListItem[]> {
  const { data, error } = await supabase
    .from('products_with_cost')
    .select(
      'id, name, category_id, unit, recipe_status, is_active, available_online, available_offline, selling_price, live_total_cost'
    )
    .order('name');

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    unit: row.unit,
    recipeStatus: row.recipe_status,
    isActive: row.is_active,
    availableOnline: row.available_online,
    availableOffline: row.available_offline,
    sellingPrice: toNumber(row.selling_price),
    totalCost: toNumber(row.live_total_cost),
  }));
}

/** Bahan menipis per produk: Map<productId, LowStockItem[]> */
export async function fetchLowStockMap(): Promise<Map<string, LowStockItem[]>> {
  const { data, error } = await supabase.from('product_low_stock').select('*');
  if (error) throw error;

  const map = new Map<string, LowStockItem[]>();
  (data ?? []).forEach((row: any) => {
    const list = map.get(row.product_id) ?? [];
    list.push({
      itemType: row.item_type,
      itemId: row.item_id,
      name: row.item_name,
      unitName: row.unit_name ?? '',
      currentStock: Number(row.current_stock),
      minStock: Number(row.min_stock_alert),
      qtyPerPortion: Number(row.qty_per_portion),
    });
    map.set(row.product_id, list);
  });
  return map;
}

export async function fetchProductDetail(id: string): Promise<ProductDetail | null> {
  const [productRes, recipeRes] = await Promise.all([
    supabase
      .from('products_with_cost')
      .select(
        'id, name, description, photo_url, category_id, unit, sku, available_offline, available_online, recipe_status, is_active, base_cost, add_cost_percentage, desired_cost_percentage, selling_price, live_cost, live_total_cost'
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('product_recipe_components')
      .select('component_type, raw_material_id, racikan_id, quantity')
      .eq('product_id', id),
  ]);

  if (productRes.error) throw productRes.error;
  if (recipeRes.error) throw recipeRes.error;
  const row: any = productRes.data;
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    photoUrl: row.photo_url,
    categoryId: row.category_id,
    unit: row.unit,
    sku: row.sku,
    availableOffline: row.available_offline,
    availableOnline: row.available_online,
    recipeStatus: row.recipe_status,
    isActive: row.is_active,
    baseCost: toNumber(row.base_cost),
    addCostPercentage: Number(row.add_cost_percentage ?? 0),
    desiredCostPercentage: toNumber(row.desired_cost_percentage),
    sellingPrice: toNumber(row.selling_price),
    liveCost: toNumber(row.live_cost),
    totalCost: toNumber(row.live_total_cost),
    recipe: (recipeRes.data ?? []).map((c: any) => ({
      type: c.component_type,
      id: c.component_type === 'bahan_baku' ? c.raw_material_id : c.racikan_id,
      quantity: Number(c.quantity),
    })),
  };
}

/** Nonaktif manual ditandai supaya nanti tidak diaktifkan ulang otomatis oleh logika stok */
export async function setProductActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ is_active: active, deactivated_manually: !active })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

/** Bahan baku + racikan aktif untuk dropdown resep */
export async function fetchRecipeSources(): Promise<RecipeSource[]> {
  const [rawRes, racikanRes, unitRes] = await Promise.all([
    supabase.from('raw_materials').select('id, name, base_unit_id, unit_price').eq('is_active', true).order('name'),
    supabase.from('racikan').select('id, name, unit_id, price_per_unit').eq('is_active', true).order('name'),
    supabase.from('units').select('id, name'),
  ]);

  if (rawRes.error) throw rawRes.error;
  if (racikanRes.error) throw racikanRes.error;
  if (unitRes.error) throw unitRes.error;

  const unitNames = new Map((unitRes.data ?? []).map((u: any) => [u.id, u.name as string]));

  const rawSources: RecipeSource[] = (rawRes.data ?? []).map((r: any) => ({
    key: `bahan_baku:${r.id}`,
    type: 'bahan_baku',
    id: r.id,
    name: r.name,
    unitId: r.base_unit_id,
    unitName: unitNames.get(r.base_unit_id) ?? '-',
    unitPrice: Number(r.unit_price ?? 0),
  }));

  const racikanSources: RecipeSource[] = (racikanRes.data ?? []).map((r: any) => ({
    key: `racikan:${r.id}`,
    type: 'racikan',
    id: r.id,
    name: r.name,
    unitId: r.unit_id,
    unitName: unitNames.get(r.unit_id) ?? '-',
    unitPrice: Number(r.price_per_unit ?? 0),
  }));

  return [...rawSources, ...racikanSources];
}

/** Cek nama produk sudah dipakai (tidak peka huruf besar/kecil). excludeId = produk yang sedang diubah */
export async function isProductNameTaken(name: string, excludeId?: string): Promise<boolean> {
  const escaped = name.replace(/[%_\\]/g, (m) => `\\${m}`);
  let query = supabase.from('products').select('id', { count: 'exact', head: true }).ilike('name', escaped);
  if (excludeId) query = query.neq('id', excludeId);
  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Saran SKU otomatis: IRN-<3 huruf kategori>-<nomor urut>, mis. IRN-ICE-03 */
export async function suggestSku(categoryName: string): Promise<string> {
  const letters = categoryName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'PRD';
  const prefix = `IRN-${letters}`;

  const { data, error } = await supabase.from('products').select('sku').ilike('sku', `${prefix}-%`);
  if (error) throw error;

  const maxNumber = (data ?? []).reduce((max: number, row: any) => {
    const n = Number(String(row.sku).split('-').pop());
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  return `${prefix}-${String(maxNumber + 1).padStart(2, '0')}`;
}

/** Unggah foto ke bucket product-photos, kembalikan URL publiknya */
export async function uploadProductPhoto(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `products/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('product-photos')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  return supabase.storage.from('product-photos').getPublicUrl(path).data.publicUrl;
}

/** Simpan produk (baru atau ubah) + resepnya dalam satu transaksi (fungsi database save_product) */
export async function saveProduct(input: ProductSaveInput, productId: string | null = null): Promise<string> {
  const { data, error } = await supabase.rpc('save_product', {
    p_product_id: productId,
    p_data: {
      name: input.name,
      description: input.description,
      photo_url: input.photoUrl,
      category_id: input.categoryId,
      unit: input.unit,
      sku: input.sku,
      available_offline: input.availableOffline,
      available_online: input.availableOnline,
      recipe_status: input.recipeStatus,
      base_cost: input.baseCost,
      add_cost_percentage: input.addCostPercentage,
      desired_cost_percentage: input.desiredCostPercentage,
      selling_price: input.sellingPrice,
      is_active: input.isActive,
    },
    p_recipe: input.recipe.map((r) => ({
      component_type: r.type,
      raw_material_id: r.rawMaterialId,
      racikan_id: r.racikanId,
      quantity: r.quantity,
      unit_id: r.unitId,
    })),
  });

  if (error) throw error;
  return data as string;
}
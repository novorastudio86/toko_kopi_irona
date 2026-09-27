import { supabase } from './supabase';
import type {
  OrderTypeRule,
  ProductPrices,
  RawMaterialOption,
  RuleHistoryEntry,
  RuleInput,
} from '../types/orderType';

export async function fetchOrderTypeRules(): Promise<OrderTypeRule[]> {
  const [rules, links, items] = await Promise.all([
    supabase
      .from('order_type_rule_overview')
      .select('id, scope, applies_to_all_products, total_cost')
      .order('created_at'),
    supabase.from('order_type_rule_products').select('rule_id, product_id, products(name)'),
    supabase
      .from('order_type_rule_item_costs')
      .select(
        'rule_id, raw_material_id, raw_material_name, unit_name, quantity, unit_price, custom_cost, cost'
      )
      .order('sort_order'),
  ]);
  if (rules.error) throw rules.error;
  if (links.error) throw links.error;
  if (items.error) throw items.error;

  return (rules.data ?? []).map((r: any) => {
    const products = (links.data ?? []).filter((l: any) => l.rule_id === r.id);
    return {
      id: r.id,
      scope: r.scope,
      appliesToAllProducts: r.applies_to_all_products,
      productIds: products.map((p: any) => p.product_id),
      productNames: products.map((p: any) => p.products?.name ?? '—').sort(),
      items: (items.data ?? [])
        .filter((i: any) => i.rule_id === r.id)
        .map((i: any) => ({
          rawMaterialId: i.raw_material_id,
          rawMaterialName: i.raw_material_name,
          unitName: i.unit_name,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unit_price ?? 0),
          customCost: i.custom_cost === null ? null : Number(i.custom_cost),
          cost: Number(i.cost ?? 0),
        })),
      totalCost: Number(r.total_cost ?? 0),
    };
  });
}

export async function fetchRawMaterialOptions(): Promise<RawMaterialOption[]> {
  const { data, error } = await supabase
    .from('raw_materials')
    .select('id, name, unit_price, is_active, units!raw_materials_base_unit_id_fkey(name)')
    .order('name');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    unitName: r.units?.name ?? '',
    unitPrice: Number(r.unit_price ?? 0),
    isActive: r.is_active,
  }));
}

export async function saveOrderTypeRule(input: RuleInput, id: string | null): Promise<void> {
  const { error } = await supabase.rpc('save_order_type_rule', {
    p_id: id,
    p_scope: input.scope,
    p_applies_to_all: input.appliesToAllProducts,
    p_product_ids: input.appliesToAllProducts ? [] : input.productIds,
    p_items: input.items.map((i) => ({
      raw_material_id: i.rawMaterialId,
      quantity: i.quantity,
      custom_cost: i.customCost,
    })),
  });
  if (error) throw error;
}

export async function deleteOrderTypeRule(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_order_type_rule', { p_id: id });
  if (error) throw error;
}

/** Rincian harga 1 produk: Dine In, Take Away, Online (+ aturan yang kena) */
export async function fetchProductPrices(productId: string): Promise<ProductPrices> {
  const { data, error } = await supabase.rpc('product_order_type_prices', {
    p_product_id: productId,
  });
  if (error) throw error;
  const row: any = Array.isArray(data) ? data[0] : data;
  return {
    productName: row?.product_name ?? '—',
    dineInPrice: Number(row?.dine_in_price ?? 0),
    takeAwayPrice: Number(row?.take_away_price ?? 0),
    onlinePrice: Number(row?.online_price ?? 0),
    takeAwayRuleIds: (row?.take_away_rules ?? []).map((r: any) => r.rule_id),
    onlineRuleIds: (row?.online_rules ?? []).map((r: any) => r.rule_id),
  };
}

export async function fetchOrderTypeHistory(): Promise<RuleHistoryEntry[]> {
  const { data, error } = await supabase
    .from('order_type_rule_history')
    .select('id, action, before_data, after_data, created_at, employees(full_name)')
    .order('created_at', { ascending: false })
    .limit(50);
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

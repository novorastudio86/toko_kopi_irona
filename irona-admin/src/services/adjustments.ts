import { supabase } from './supabase';
import type {
  Adjustment,
  ProductStatus,
  RecipeOption,
  RefundableTransaction,
  TneInput,
  TneUsageLine,
  TryErrorDetail,
} from '../types/adjustment';

export async function fetchAdjustments(): Promise<Adjustment[]> {
  const { data, error } = await supabase
    .from('transaction_adjustment_overview')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    adjustmentType: row.adjustment_type,
    createdAt: row.created_at,
    reference: row.reference ?? '—',
    channel: row.channel,
    productStatus: row.product_status,
    notes: row.notes,
    amount: Number(row.amount ?? 0),
    transactionId: row.transaction_id,
    tneType: row.tne_type,
    customerId: row.customer_id,
    customerName: row.customer_name,
    recordedByName: row.recorded_by_name,
  }));
}

/** Cari 1 transaksi berdasarkan nomor (persis, tanpa beda huruf besar/kecil) */
export async function findTransaction(number: string): Promise<RefundableTransaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, transaction_number, order_type, payment_method, status, transaction_date, customer_id, customer_name, subtotal, discount_amount, total_amount, transaction_items(quantity, unit_price, line_total, products(name)), point_transactions(points_change, point_type)'
    )
    .ilike('transaction_number', number.trim())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row: any = data;
  return {
    id: row.id,
    transactionNumber: row.transaction_number,
    channel: row.order_type === 'online' ? 'online' : 'offline',
    orderType: row.order_type,
    paymentMethod: row.payment_method,
    status: row.status,
    transactionDate: row.transaction_date,
    customerId: row.customer_id,
    customerName: row.customer_name,
    isMember: !!row.customer_id,
    subtotal: Number(row.subtotal ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    pointsEarned: (row.point_transactions ?? [])
      .filter((p: any) => p.point_type === 'earn')
      .reduce((sum: number, p: any) => sum + Number(p.points_change), 0),
    items: (row.transaction_items ?? []).map((i: any) => ({
      name: i.products?.name ?? '—',
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
    })),
  };
}

export async function createRefund(
  transactionId: string,
  productStatus: ProductStatus,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('create_refund', {
    p_transaction_id: transactionId,
    p_product_status: productStatus,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function fetchRecipeOptions(): Promise<RecipeOption[]> {
  const { data, error } = await supabase.from('try_error_recipe_options').select('*').order('name');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    tneType: row.tne_type,
    id: row.id,
    name: row.name,
    groupName: row.group_name ?? 'Lainnya',
    costPerPorsi: Number(row.cost_per_porsi ?? 0),
    addCostPercentage: Number(row.add_cost_percentage ?? 0),
  }));
}

/** Bahan baku aktif untuk racikan baru */
export async function fetchMaterialOptions(): Promise<
  { id: string; name: string; unitName: string; unitPrice: number; stock: number }[]
> {
  const [materials, units] = await Promise.all([
    supabase
      .from('raw_materials')
      .select('id, name, base_unit_id, unit_price, current_stock')
      .eq('is_active', true)
      .order('name'),
    supabase.from('units').select('id, name'),
  ]);
  if (materials.error) throw materials.error;
  if (units.error) throw units.error;
  const unitNames = new Map((units.data ?? []).map((u: any) => [u.id, u.name as string]));
  return (materials.data ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    unitName: unitNames.get(m.base_unit_id) ?? '-',
    unitPrice: Number(m.unit_price ?? 0),
    stock: Number(m.current_stock ?? 0),
  }));
}

const mapUsage = (row: any): TneUsageLine => ({
  itemType: row.item_type,
  itemName: row.item_name,
  unitName: row.unit_name ?? '-',
  quantity: Number(row.quantity),
  currentStock: Number(row.current_stock ?? 0),
  unitPrice: Number(row.unit_price ?? 0),
  subtotal: Number(row.subtotal ?? 0),
});

/** Pratinjau bahan yang akan terpotong (resep existing) */
export async function previewTryErrorUsage(
  input: Pick<TneInput, 'type' | 'productId' | 'racikanId' | 'quantity'>
): Promise<TneUsageLine[]> {
  const { data, error } = await supabase.rpc('try_error_usage', {
    p_type: input.type,
    p_product_id: input.productId,
    p_racikan_id: input.racikanId,
    p_quantity: input.quantity,
    p_items: [],
  });
  if (error) throw error;
  return (data ?? []).map(mapUsage);
}

export async function createTryError(input: TneInput): Promise<void> {
  const { error } = await supabase.rpc('create_try_error', {
    p_type: input.type,
    p_product_id: input.productId,
    p_racikan_id: input.racikanId,
    p_quantity: input.quantity,
    p_items: input.items,
    p_notes: input.notes,
  });
  if (error) throw error;
}

export async function fetchTryErrorDetail(id: string): Promise<TryErrorDetail> {
  const [record, items, units] = await Promise.all([
    supabase
      .from('try_error_records')
      .select('tne_type, quantity, cost, add_cost_percentage, total_cost')
      .eq('id', id)
      .single(),
    supabase
      .from('try_error_items')
      .select(
        'item_type, quantity, unit_id, unit_price, subtotal, raw_materials(name), racikan(name)'
      )
      .eq('try_error_id', id),
    supabase.from('units').select('id, name'),
  ]);
  if (record.error) throw record.error;
  if (items.error) throw items.error;
  if (units.error) throw units.error;
  const unitNames = new Map((units.data ?? []).map((u: any) => [u.id, u.name as string]));

  return {
    tneType: record.data.tne_type,
    quantity: Number(record.data.quantity),
    cost: Number(record.data.cost),
    addCostPercentage: Number(record.data.add_cost_percentage),
    totalCost: Number(record.data.total_cost),
    lines: (items.data ?? [])
      .map((i: any) => ({
        itemType: i.item_type,
        itemName: i.raw_materials?.name ?? i.racikan?.name ?? '—',
        unitName: unitNames.get(i.unit_id) ?? '-',
        quantity: Number(i.quantity),
        currentStock: 0,
        unitPrice: Number(i.unit_price),
        subtotal: Number(i.subtotal),
      }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName, 'id')),
  };
}

/** Rincian refund: transaksi asli + penarikan poin */
export async function fetchRefundDetail(transactionId: string): Promise<{
  transaction: RefundableTransaction | null;
  pointsReversed: number;
}> {
  const { data: tx, error } = await supabase
    .from('transactions')
    .select('transaction_number')
    .eq('id', transactionId)
    .single();
  if (error) throw error;
  const [transaction, points] = await Promise.all([
    findTransaction(tx.transaction_number),
    supabase
      .from('point_transactions')
      .select('points_change')
      .eq('transaction_id', transactionId)
      .eq('point_type', 'refund_reversal'),
  ]);
  if (points.error) throw points.error;
  return {
    transaction,
    pointsReversed: -(points.data ?? []).reduce((s: number, p: any) => s + p.points_change, 0),
  };
}

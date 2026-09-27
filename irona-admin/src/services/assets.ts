import { supabase } from './supabase';
import type { Asset, AssetInput, AssetStatus } from '../types/asset';

export async function fetchAssets(): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('id, name, purchase_price, quantity, purchase_date, status, notes')
    .order('purchase_date', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const price = Number(row.purchase_price);
    const qty = Number(row.quantity);
    return {
      id: row.id,
      name: row.name,
      purchasePrice: price,
      quantity: qty,
      purchaseDate: row.purchase_date,
      status: row.status,
      notes: row.notes,
      totalValue: price * qty,
    };
  });
}

export async function saveAsset(input: AssetInput, assetId: string | null = null): Promise<string> {
  const { data, error } = await supabase.rpc('save_asset', {
    p_asset_id: assetId,
    p_data: {
      name: input.name,
      purchase_price: input.purchasePrice,
      quantity: input.quantity,
      purchase_date: input.purchaseDate,
      notes: input.notes,
    },
  });
  if (error) throw error;
  return data as string;
}

export async function updateAssetStatus(assetId: string, status: AssetStatus, note: string): Promise<void> {
  const { error } = await supabase.rpc('update_asset_status', {
    p_asset_id: assetId,
    p_status: status,
    p_note: note,
  });
  if (error) throw error;
}

export async function deleteAsset(id: string): Promise<void> {
  const { error } = await supabase.from('assets').delete().eq('id', id);
  if (error) throw error;
}
import type { Product } from '@/types/product';
import { supabase } from './supabase';

interface MenuRow {
  id: string;
  name: string;
  photo_url: string | null;
  category_id: string;
  /** Harga online = harga jual + biaya aturan Tipe Order online */
  price: number;
}

/** Produk aktif yang dijual online (RPC online_menu_products: sudah difilter jeda & kategori online) */
export async function fetchAllOnlineProducts(): Promise<Product[]> {
  const { data, error } = await supabase.rpc('online_menu_products');
  if (error) throw error;
  return (data as MenuRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    sellingPrice: Number(row.price),
    photoUrl: row.photo_url,
    // TODO(backend): belum ada kolom is_recommended; sementara semua menu tampil di "Pilihan Kora".
    isRecommended: true,
    availableOnline: true,
    // TODO(backend): belum ada sumber stok habis di tabel products.
    isSoldOut: false,
    isActive: true,
  }));
}

/** Produk online untuk satu kategori */
export async function fetchOnlineProducts(categoryId: string): Promise<Product[]> {
  return (await fetchAllOnlineProducts()).filter((p) => p.categoryId === categoryId);
}

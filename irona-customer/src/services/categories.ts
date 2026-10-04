import type { Category } from '@/types/category';
import { supabase } from './supabase';

export type MenuKind = 'minuman' | 'makanan';

// TODO(backend): tabel categories belum punya kolom jenis (minuman/makanan); sementara pakai id seed
// APPETIZER & MAIN COURSE (irona-backend/supabase/seed.sql).
const FOOD_CATEGORY_IDS = new Set([
  'f0f8c12f-f47b-534b-b755-cb296e69eb57',
  '6140f072-c035-5927-a848-9f651bc1d9ac',
]);

/** Jenis menu untuk filter Minuman / Makanan di halaman /menu */
export function categoryKind(categoryId: string): MenuKind {
  return FOOD_CATEGORY_IDS.has(categoryId) ? 'makanan' : 'minuman';
}

// Tab buatan client (bukan baris tabel categories), selalu di depan & jadi default.
// Home pakai "Pilihan Kora", /menu pakai "All Product" (rekomendasi di /menu lewat Urutkan → Rekomendasi).
export const RECOMMENDED_CATEGORY: Category = {
  id: 'recommended',
  name: 'Pilihan Kora',
  onlineName: null,
  displayOrder: 0,
  showOnline: true,
};

export const ALL_CATEGORY: Category = {
  id: 'all',
  name: 'All Product',
  onlineName: null,
  displayOrder: 0,
  showOnline: true,
};

/** Kategori yang tampil di Web Customer, urut display_order */
export async function fetchOnlineCategories(): Promise<Category[]> {
  const { data, error } = await supabase.rpc('online_menu_categories');
  if (error) throw error;
  return (
    data as { id: string; name: string; online_name: string | null; display_order: number }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    onlineName: row.online_name,
    displayOrder: row.display_order,
    showOnline: true,
  }));
}

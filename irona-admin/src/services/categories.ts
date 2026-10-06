import { supabase } from './supabase';
import type { Category, CategoryInput } from '../types/category';
import type { HistoryEntry } from '../types/history';
import { historySince } from '../utils/date';

const CATEGORY_SELECT =
  'id, code, name, icon, display_order, show_in_menu, show_online, products(count)';

function mapCategory(row: any): Category {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    icon: row.icon,
    displayOrder: row.display_order,
    showInMenu: row.show_in_menu,
    showOnline: row.show_online,
    productCount: row.products?.[0]?.count ?? 0,
  };
}

function toRow(input: CategoryInput) {
  return {
    name: input.name,
    icon: input.icon,
    display_order: input.displayOrder,
    show_in_menu: input.showInMenu,
    show_online: input.showOnline,
  };
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_SELECT)
    .order('display_order');
  if (error) throw error;
  return (data ?? []).map(mapCategory);
}

export async function fetchCategoryById(id: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCategory(data) : null;
}

/** Urutan tampil berikutnya = urutan terbesar + 1 */
export async function fetchNextDisplayOrder(): Promise<number> {
  const { data, error } = await supabase
    .from('categories')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.display_order ?? 0) + 1;
}

export async function createCategory(input: CategoryInput): Promise<string> {
  const { data, error } = await supabase
    .from('categories')
    .insert(toRow(input))
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateCategory(id: string, input: CategoryInput): Promise<void> {
  const { error } = await supabase.from('categories').update(toRow(input)).eq('id', id);
  if (error) throw error;
}

/** Ditolak DB (23503) bila masih ada produk di kategori ini — FK products.category_id */
export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

/** Riwayat perubahan kategori 14 hari terakhir (diisi otomatis oleh trigger `log_category_history`) */
export async function fetchCategoryHistory(): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from('category_history')
    .select('id, category_name, action, changes, changed_at')
    .gte('changed_at', historySince())
    .order('changed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    subject: row.category_name,
    action: row.action,
    changes: row.changes,
    changedAt: row.changed_at,
  }));
}

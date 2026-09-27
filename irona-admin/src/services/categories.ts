import { supabase } from './supabase';
import type { Category, CategoryInput } from '../types/category';

const CATEGORY_SELECT =
  'id, code, name, online_name, icon, display_order, show_in_menu, show_online, products(count)';

function mapCategory(row: any): Category {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    onlineName: row.online_name,
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
    online_name: input.onlineName,
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
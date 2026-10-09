import { supabase } from '@/services/supabase';
import type { MenuCategory, MenuProduct } from '@/kasir/types/catalog';

interface CategoryRow {
  id: string;
  name: string;
  icon: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  selling_price: number | string | null;
  category_id: string;
  categories: { name: string; show_in_menu: boolean } | null;
}

/**
 * Katalog kasir: kategori "Tampil di Menu (POS Kasir)" + produk aktif yang dijual offline
 * dan sudah punya harga jual. Urutan kategori mengikuti Web Admin.
 */
export async function fetchMenuCatalog(): Promise<{
  categories: MenuCategory[];
  products: MenuProduct[];
}> {
  const [categoryRes, productRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, icon')
      .eq('show_in_menu', true)
      .order('display_order'),
    supabase
      .from('products')
      .select(
        'id, name, description, photo_url, selling_price, category_id, categories!inner(name, show_in_menu)'
      )
      .eq('is_active', true)
      .eq('available_offline', true)
      .eq('categories.show_in_menu', true)
      .not('selling_price', 'is', null)
      .order('name'),
  ]);
  if (categoryRes.error) throw new Error(categoryRes.error.message);
  if (productRes.error) throw new Error(productRes.error.message);

  const products = ((productRes.data ?? []) as unknown as ProductRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    photoUrl: row.photo_url,
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? '',
    price: Number(row.selling_price),
    // ponytail: contoh tampilan badge stok (aman 15 / menipis 5 / habis = nonaktif),
    // ganti dengan hitungan bahan baku saat backend stok siap
    stockAvailable: /rum/i.test(row.name) ? 0 : /hazelnut/i.test(row.name) ? 5 : 15,
    stockLow: /hazelnut/i.test(row.name),
  }));

  // Kategori tanpa produk yang bisa dijual tidak perlu tampil
  const usedCategoryIds = new Set(products.map((p) => p.categoryId));
  const categories = ((categoryRes.data ?? []) as CategoryRow[])
    .filter((c) => usedCategoryIds.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon }));

  return { categories, products };
}
import { supabase } from '@/services/supabase';
import type { MenuCategory, MenuProduct, Promotion } from '@/kasir/types/catalog';
import { localDate } from '@/kasir/utils/promotions';

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

interface PromotionRow {
  id: string;
  name: string;
  promo_type: Promotion['promoType'];
  discount_kind: Promotion['discountKind'];
  discount_value: number | string | null;
  applies_to_all_products: boolean;
  target_customer: 'semua' | 'member';
  min_purchase_type: Promotion['minPurchaseType'];
  min_purchase_value: number | string | null;
  is_repeatable: boolean;
  applies_to_take_away: boolean;
  start_date: string;
  end_date: string;
  valid_days: number[] | null;
  valid_start_time: string | null;
  valid_end_time: string | null;
  promotion_products: { product_id: string }[];
}

/** Diskon Offline potong harga produk yang aktif & belum berakhir (syarat lain dicek di tablet) */
export async function fetchOfflinePromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select(
      'id, name, promo_type, discount_kind, discount_value, applies_to_all_products, target_customer, min_purchase_type, min_purchase_value, is_repeatable, applies_to_take_away, start_date, end_date, valid_days, valid_start_time, valid_end_time, promotion_products(product_id)'
    )
    .eq('channel', 'offline')
    .eq('discount_target', 'produk')
    .eq('is_active', true)
    .gte('end_date', localDate(new Date()))
    .order('name');
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as PromotionRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    promoType: row.promo_type,
    discountKind: row.discount_kind,
    discountValue: Number(row.discount_value ?? 0),
    appliesToAllProducts: row.applies_to_all_products,
    productIds: row.promotion_products.map((p) => p.product_id),
    memberOnly: row.target_customer === 'member',
    minPurchaseType: row.min_purchase_type,
    minPurchaseValue: Number(row.min_purchase_value ?? 0),
    isRepeatable: row.is_repeatable,
    appliesToTakeAway: row.applies_to_take_away,
    startDate: row.start_date,
    endDate: row.end_date,
    validDays: row.valid_days ?? [],
    validStartTime: row.valid_start_time,
    validEndTime: row.valid_end_time,
  }));
}

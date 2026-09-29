import type { Product } from '../../types/product';

// Import relatif (bukan '@/') + hanya import type, supaya bisa diuji langsung dengan node (scripts/filterMenu.check.ts)

export type KindFilter = '' | 'minuman' | 'makanan';
export type PriceFilter = '' | 'lt15' | '15to25' | 'gt25';
export type SortKey = '' | 'recommended' | 'price-asc' | 'price-desc' | 'name';

/** '' = tanpa filter / urutan bawaan (urutan menu dari admin) */
export interface MenuFilters {
  kind: KindFilter;
  price: PriceFilter;
  sort: SortKey;
}

export const EMPTY_FILTERS: MenuFilters = { kind: '', price: '', sort: '' };

/** Opsi pertama = label placeholder dari desain, berarti "semua" / urutan bawaan */
export const KIND_OPTIONS: [KindFilter, string][] = [
  ['', 'Minuman / Makanan'],
  ['minuman', 'Minuman'],
  ['makanan', 'Makanan'],
];

export const PRICE_OPTIONS: [PriceFilter, string][] = [
  ['', 'Rentang harga'],
  ['lt15', '< Rp15.000'],
  ['15to25', 'Rp15.000–25.000'],
  ['gt25', '> Rp25.000'],
];

export const SORT_OPTIONS: [SortKey, string][] = [
  ['', 'Urutkan'],
  ['recommended', 'Rekomendasi'],
  ['price-asc', 'Harga terendah'],
  ['price-desc', 'Harga tertinggi'],
  ['name', 'Nama A–Z'],
];

const PRICE_TEST: Record<Exclude<PriceFilter, ''>, (price: number) => boolean> = {
  lt15: (price) => price < 15000,
  '15to25': (price) => price >= 15000 && price <= 25000,
  gt25: (price) => price > 25000,
};

/** Produk tanpa harga selalu di akhir, apa pun arah urutannya */
const byPrice = (dir: 1 | -1) => (a: Product, b: Product) =>
  a.sellingPrice === null || b.sellingPrice === null
    ? Number(a.sellingPrice === null) - Number(b.sellingPrice === null)
    : dir * (a.sellingPrice - b.sellingPrice);

const COMPARE: Record<Exclude<SortKey, ''>, (a: Product, b: Product) => number> = {
  recommended: (a, b) => Number(b.isRecommended) - Number(a.isRecommended),
  'price-asc': byPrice(1),
  'price-desc': byPrice(-1),
  name: (a, b) => a.name.localeCompare(b.name, 'id'),
};

/**
 * Search (nama, tanpa beda huruf besar/kecil) + filter jenis & harga + urutan.
 * `kindOf` memetakan kategori → jenis (lihat categoryKind di services/categories).
 */
export function applyMenuFilters(
  products: Product[],
  { kind, price, sort }: MenuFilters,
  kindOf: (categoryId: string) => string,
  query = ''
): Product[] {
  const q = query.trim().toLocaleLowerCase('id');
  const rows = products.filter(
    (p) =>
      (!q || p.name.toLocaleLowerCase('id').includes(q)) &&
      (!kind || kindOf(p.categoryId) === kind) &&
      (!price || (p.sellingPrice !== null && PRICE_TEST[price](p.sellingPrice)))
  );
  // sort stabil: urutan bawaan dipertahankan untuk nilai yang sama
  return sort ? rows.toSorted(COMPARE[sort]) : rows;
}

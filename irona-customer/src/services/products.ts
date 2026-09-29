import type { Product } from '@/types/product';
import icedLattePhoto from '@/assets/home/product-iced-latte.webp';
import { mockDelay } from './mockDelay';

/** [nama, harga, rekomendasi] per kategori — data dummy */
const MOCK_MENU: Record<string, [string, number, boolean][]> = {
  'cat-basic-coffee': [
    ['Es Kopi Susu Irona', 18000, true],
    ['Espresso', 12000, false],
    ['Cappuccino', 20000, true],
    ['Caffe Latte', 20000, false],
    ['Kopi Susu Gula Aren', 18000, true],
    ['Flat White', 22000, false],
    ['Piccolo', 18000, false],
    ['Kopi Tubruk', 10000, false],
  ],
  'cat-americano': [
    ['Americano', 15000, true],
    ['Lemon Americano', 18000, false],
    ['Orange Americano', 18000, false],
    ['Honey Americano', 18000, false],
  ],
  'cat-milk': [
    ['Chocolate', 18000, true],
    ['Red Velvet', 18000, false],
    ['Taro', 18000, false],
  ],
  'cat-tea': [
    ['Lychee Tea', 15000, true],
    ['Lemon Tea', 12000, false],
    ['Thai Tea', 16000, false],
  ],
  'cat-pop': [
    ['Strawberry Pop', 18000, false],
    ['Blue Ocean Pop', 18000, true],
  ],
  'cat-ice-coffee': [
    ['Es Kopi Hitam', 12000, false],
    ['Es Kopi Butterscotch', 20000, true],
    ['Es Kopi Hazelnut', 20000, false],
  ],
  'cat-matcha': [
    ['Matcha Latte', 22000, true],
    ['Matcha Espresso', 25000, false],
  ],
  'cat-appetizer': [
    ['Kentang Goreng', 15000, true],
    ['Cireng Rujak', 12000, false],
    ['Pisang Goreng Keju', 15000, false],
  ],
  'cat-main-course': [
    ['Nasi Goreng Irona', 25000, true],
    ['Mie Goreng Jawa', 22000, false],
    ['Nasi Ayam Sambal Matah', 27000, false],
  ],
};

/** Contoh menu habis; sengaja bukan di kategori pertama supaya tampilan awal Home tetap sama */
const MOCK_SOLD_OUT = new Set(['cat-americano-4', 'cat-main-course-2']);

// TODO(backend): ganti dengan query tabel products, map snake_case → camelCase di sini.
const MOCK_PRODUCTS: Product[] = Object.entries(MOCK_MENU).flatMap(([categoryId, items]) =>
  items.map(([name, sellingPrice, isRecommended], index) => ({
    id: `${categoryId}-${index + 1}`,
    name,
    categoryId,
    sellingPrice,
    // Baru 1 foto asli dari desain; sisanya placeholder
    photoUrl: categoryId === 'cat-basic-coffee' && index === 0 ? icedLattePhoto : null,
    isRecommended,
    availableOnline: true,
    isActive: true,
    isSoldOut: MOCK_SOLD_OUT.has(`${categoryId}-${index + 1}`),
  }))
);

const isOnline = (p: Product) => p.isActive && p.availableOnline;

/** Produk aktif yang dijual online untuk satu kategori */
export async function fetchOnlineProducts(categoryId: string): Promise<Product[]> {
  return mockDelay(MOCK_PRODUCTS.filter((p) => p.categoryId === categoryId && isOnline(p)));
}

/** Semua produk aktif yang dijual online (katalog /menu: search & filter di client) */
export async function fetchAllOnlineProducts(): Promise<Product[]> {
  return mockDelay(MOCK_PRODUCTS.filter(isOnline));
}

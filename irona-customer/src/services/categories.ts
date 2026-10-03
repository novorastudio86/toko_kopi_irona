import type { Category } from '@/types/category';
import { mockDelay } from './mockDelay';

export type MenuKind = 'minuman' | 'makanan';

// TODO(backend): tabel categories belum punya kolom jenis (minuman/makanan); sementara dipetakan dari id mock.
const FOOD_CATEGORY_IDS = new Set(['cat-appetizer', 'cat-main-course']);

/** Jenis menu untuk filter Minuman / Makanan di halaman /menu */
export function categoryKind(categoryId: string): MenuKind {
  return FOOD_CATEGORY_IDS.has(categoryId) ? 'makanan' : 'minuman';
}

// TODO(backend): ganti dengan query tabel categories, map snake_case → camelCase di sini.
const MOCK_CATEGORIES: Category[] = [
  { id: 'cat-add-on', name: 'ADD ON', onlineName: null, displayOrder: 1, showOnline: false },
  {
    id: 'cat-basic-coffee',
    name: 'BASIC COFFEE',
    onlineName: 'Basic Coffee',
    displayOrder: 2,
    showOnline: true,
  },
  {
    id: 'cat-americano',
    name: 'AMERICANO BASED',
    onlineName: 'Americano Series',
    displayOrder: 3,
    showOnline: true,
  },
  {
    id: 'cat-milk',
    name: 'MILK BASED',
    onlineName: 'Milk Based',
    displayOrder: 4,
    showOnline: true,
  },
  { id: 'cat-tea', name: 'TEA BASED', onlineName: 'Tea Based', displayOrder: 5, showOnline: true },
  {
    id: 'cat-pop',
    name: 'POP SERIES',
    onlineName: 'Pop Series',
    displayOrder: 6,
    showOnline: true,
  },
  {
    id: 'cat-ice-coffee',
    name: 'ICE COFFEE',
    onlineName: 'Ice Coffee',
    displayOrder: 7,
    showOnline: true,
  },
  {
    id: 'cat-matcha',
    name: 'MATCHA BASED',
    onlineName: 'Matcha Series',
    displayOrder: 8,
    showOnline: true,
  },
  {
    id: 'cat-appetizer',
    name: 'APPETIZER',
    onlineName: 'Appetizer',
    displayOrder: 9,
    showOnline: true,
  },
  {
    id: 'cat-main-course',
    name: 'MAIN COURSE',
    onlineName: 'Main Course',
    displayOrder: 10,
    showOnline: true,
  },
];

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
  const rows = MOCK_CATEGORIES.filter((c) => c.showOnline).sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
  return mockDelay(rows);
}

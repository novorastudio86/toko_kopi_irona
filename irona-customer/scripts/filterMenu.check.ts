// Jalankan: npm run check
import assert from 'node:assert/strict';
import type { Product } from '../src/types/product.ts';
import { applyMenuFilters, EMPTY_FILTERS } from '../src/screens/menu/filterMenu.ts';

const product = (
  id: string,
  name: string,
  categoryId: string,
  sellingPrice: number | null,
  isRecommended = false
): Product => ({
  id,
  name,
  categoryId,
  sellingPrice,
  photoUrl: null,
  isRecommended,
  availableOnline: true,
  isActive: true,
  isSoldOut: false,
});

const products = [
  product('1', 'Es Kopi Susu', 'coffee', 18000),
  product('2', 'Espresso', 'coffee', 12000, true),
  product('3', 'Nasi Goreng', 'food', 25000),
  product('4', 'Americano', 'coffee', null),
  product('5', 'Mie Goreng', 'food', 27000, true),
];
const kindOf = (categoryId: string) => (categoryId === 'food' ? 'makanan' : 'minuman');
const ids = (rows: Product[]) => rows.map((p) => p.id).join(',');
const run = (filters: Partial<typeof EMPTY_FILTERS>, query?: string) =>
  ids(applyMenuFilters(products, { ...EMPTY_FILTERS, ...filters }, kindOf, query));

// Tanpa filter: urutan asli
assert.equal(run({}), '1,2,3,4,5');
// Search tanpa beda huruf besar/kecil, spasi di tepi diabaikan
assert.equal(run({}, '  GORENG '), '3,5');
assert.equal(run({}, 'kopi'), '1');
// Jenis
assert.equal(run({ kind: 'makanan' }), '3,5');
assert.equal(run({ kind: 'minuman' }), '1,2,4');
// Harga: batas 15.000 & 25.000 masuk rentang tengah, produk tanpa harga tidak ikut
assert.equal(run({ price: 'lt15' }), '2');
assert.equal(run({ price: '15to25' }), '1,3');
assert.equal(run({ price: 'gt25' }), '5');
// Urutan: tanpa harga selalu terakhir; rekomendasi stabil
assert.equal(run({ sort: 'price-asc' }), '2,1,3,5,4');
assert.equal(run({ sort: 'price-desc' }), '5,3,1,2,4');
assert.equal(run({ sort: 'recommended' }), '2,5,1,3,4');
assert.equal(run({ sort: 'name' }), '4,1,2,5,3');
// Kombinasi
assert.equal(run({ kind: 'minuman', sort: 'price-desc' }, 'e'), '1,2,4');

console.log('filterMenu: semua cek lolos');

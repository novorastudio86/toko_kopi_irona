// Jalankan: npm run check
import assert from 'node:assert/strict';
import {
  countdownLabel,
  type EventItem,
  formatDays,
  formatHours,
  type PromoItem,
  promoTerms,
  visibleItems,
} from '../src/screens/tentang/eventFormat.ts';

const promo: PromoItem = {
  kind: 'promo',
  id: 'p',
  name: 'P',
  description: '',
  image: '',
  channel: 'offline',
  discountTarget: 'produk',
  discountKind: 'nominal',
  discountValue: 4000,
  maxDistanceKm: null,
  productNames: [],
  promoType: 'otomatis',
  targetCustomer: 'semua',
  minPurchaseType: 'nominal',
  minPurchaseValue: 50000,
  isRepeatable: true,
  maxOneClaimPerCustomer: true,
  appliesToTakeAway: false,
  isActive: true,
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  validDays: [],
  validStartTime: null,
  validEndTime: null,
};
const event: EventItem = {
  kind: 'event',
  id: 'e',
  title: 'E',
  description: '',
  image: '',
  date: '2020-01-01',
  time: '',
  location: '',
  mapsUrl: '',
  price: 0,
};

// Promo hanya tampil saat aktif & dalam periode (batas tanggal inklusif); event selalu tampil
const ids = (today: string, p = promo) => visibleItems([p, event], today).map((i) => i.id);
assert.deepEqual(ids('2026-10-01'), ['p', 'e']);
assert.deepEqual(ids('2026-10-31'), ['p', 'e']);
assert.deepEqual(ids('2026-09-30'), ['e']);
assert.deepEqual(ids('2026-11-01'), ['e']);
assert.deepEqual(ids('2026-10-15', { ...promo, isActive: false }), ['e']);

assert.equal(formatDays([]), 'Setiap hari');
assert.equal(formatDays([0, 5, 1]), 'Senin, Jumat, Minggu');
assert.equal(formatHours('14:00:00', '17:00:00'), '14.00 – 17.00 WIB');
assert.equal(formatHours(null, null), 'Sepanjang jam buka');

assert.equal(countdownLabel('2026-10-12', '2026-10-12'), 'Hari ini');
assert.equal(countdownLabel('2026-10-12', '2026-10-11'), 'Besok');
assert.equal(countdownLabel('2026-10-12', '2026-10-04'), '8 hari lagi');

const offline = promoTerms(promo);
assert.ok(offline[0].startsWith('Min. belanja Rp 50.000, berlaku kelipatan'));
assert.ok(offline.includes('Hanya untuk makan di tempat, tidak untuk take away.'));
// Klaim 1× hanya relevan untuk online
assert.ok(!offline.some((t) => t.includes('klaim')));
const online = promoTerms({
  ...promo,
  channel: 'online',
  promoType: 'manual',
  discountTarget: 'ongkir',
  maxDistanceKm: 5,
});
assert.ok(online.includes('Potongan ongkir untuk jarak antar maks. 5 km.'));
assert.ok(online.includes('Maks. 1× klaim per pelanggan.'));
assert.ok(!online.some((t) => t.includes('take away')));

console.log('events.check OK');

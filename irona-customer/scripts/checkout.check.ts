// Jalankan: npm run check
import assert from 'node:assert/strict';
import {
  bestVoucher,
  checkVoucher,
  deliveryFee,
  routeKm,
} from '../src/screens/checkout/checkoutLogic.ts';
import type { DeliverySettings, Voucher } from '../src/types/onlineOrder.ts';

const s: DeliverySettings = {
  feePerStep: 5000,
  stepKm: 2,
  feePer100m: 500,
  maxDistanceKm: 11,
  serviceFee: 1000,
  storeLat: -8.2692841,
  storeLng: 113.5402096,
};

// Ongkir: kelipatan penuh + sisa per 100 m, tolak di atas jarak maksimal
assert.equal(deliveryFee(0, s), 0);
assert.equal(deliveryFee(2, s), 5000);
assert.equal(deliveryFee(3.4, s), 5000 + 14 * 500);
assert.equal(deliveryFee(11, s), 25000 + 10 * 500);
assert.equal(deliveryFee(11.1, s), null);

// Jarak rute dibulatkan ke atas per 100 m
assert.equal(routeKm(0), 0);
assert.equal(routeKm(5127.9), 5.2);
assert.equal(routeKm(3400), 3.4);

const v = (o: Partial<Voucher>): Voucher => ({
  id: 'v',
  code: 'V',
  name: 'v',
  target: 'produk',
  kind: 'nominal',
  value: 5000,
  minPurchase: 0,
  memberOnly: false,
  maxDistanceKm: null,
  ...o,
});
const ctx = { subtotal: 50000, shippingFee: 8000, km: 3.2, isMember: false };

assert.deepEqual(checkVoucher(v({ kind: 'persen', value: 10 }), ctx), { discount: 5000 });
// Gratis ongkir 100% = sebesar ongkir; potongan tidak melebihi dasar
assert.deepEqual(checkVoucher(v({ target: 'ongkir', kind: 'persen', value: 100 }), ctx), {
  discount: 8000,
});
assert.deepEqual(checkVoucher(v({ target: 'ongkir', value: 20000 }), ctx), { discount: 8000 });
assert.ok('reason' in checkVoucher(v({ memberOnly: true }), ctx));
assert.ok('reason' in checkVoucher(v({ minPurchase: 60000 }), ctx));
assert.ok('reason' in checkVoucher(v({ target: 'ongkir', maxDistanceKm: 3 }), ctx));
assert.ok('reason' in checkVoucher(v({ target: 'ongkir' }), { ...ctx, shippingFee: null }));

// 1 diskon per transaksi: ambil potongan terbesar yang memenuhi syarat
const list = [
  v({ id: 'kecil', value: 3000 }),
  v({ id: 'besar', value: 7000 }),
  v({ id: 'member', value: 20000, memberOnly: true }),
];
assert.equal(bestVoucher(list, ctx)?.id, 'besar');
assert.equal(bestVoucher(list, { ...ctx, isMember: true })?.id, 'member');
assert.equal(bestVoucher(list, { ...ctx, subtotal: 0 }), null);

console.log('checkout.check: ok');

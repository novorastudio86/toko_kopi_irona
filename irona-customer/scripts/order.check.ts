// Jalankan: npm run check
import assert from 'node:assert/strict';
import {
  formatCountdown,
  isActive,
  isPaid,
  pruneRecent,
  trackIndex,
} from '../src/screens/order/orderLogic.ts';

// Countdown dibulatkan ke atas, tidak negatif
assert.equal(formatCountdown(15 * 60_000), '15:00');
assert.equal(formatCountdown(61_001), '01:02');
assert.equal(formatCountdown(-5000), '00:00');

assert.ok(isPaid('diantar') && !isPaid('menunggu_pembayaran') && !isPaid('kedaluwarsa'));
assert.ok(isActive('menunggu_pembayaran') && !isActive('selesai') && !isActive('dibatalkan'));
assert.equal(trackIndex('diproses'), 0);
assert.equal(trackIndex('selesai'), 2);
assert.equal(trackIndex('kedaluwarsa'), -1);

// Pesanan barusan: buang yang > 24 jam & data rusak, terbaru dulu, maks. 5
const now = Date.parse('2026-10-04T12:00:00Z');
const at = (h: number) => new Date(now - h * 3_600_000).toISOString();
assert.deepEqual(
  pruneRecent(
    [
      { id: 'lama', createdAt: at(25) },
      { id: 'a', createdAt: at(2) },
      { id: 'b', createdAt: at(1) },
      { id: 1 },
      null,
    ],
    now
  ).map((o) => o.id),
  ['b', 'a']
);
assert.deepEqual(pruneRecent('rusak', now), []);
assert.equal(
  pruneRecent(
    Array.from({ length: 8 }, (_, i) => ({ id: `${i}`, createdAt: at(i) })),
    now
  ).length,
  5
);

console.log('order.check: ok');

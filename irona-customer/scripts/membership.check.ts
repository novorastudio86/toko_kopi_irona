// Jalankan: npm run check
import assert from 'node:assert/strict';
import {
  maskPhone,
  nextTarget,
  sortRewards,
  timeLeftLabel,
} from '../src/screens/membership/membershipLogic.ts';
import type { Reward } from '../src/types/membership.ts';

const reward = (id: string, pointsRequired: number, availableStock = 5): Reward => ({
  id,
  name: id,
  productName: id,
  pointsRequired,
  availableStock,
  photoUrl: null,
});
const rewards = [
  reward('mahal', 40),
  reward('habis', 10, 0),
  reward('murah', 8),
  reward('pas', 18),
];

// Bisa ditukar dulu, lalu poin termurah (stok habis tidak dianggap bisa ditukar)
assert.deepEqual(
  sortRewards(rewards, 18).map((r) => r.id),
  ['murah', 'pas', 'habis', 'mahal']
);

// Target terdekat: lewati yang stoknya habis & yang sudah terjangkau
const t = nextTarget(rewards, 5);
assert.equal(t?.reward.id, 'murah');
assert.equal(t?.missing, 3);
assert.equal(nextTarget(rewards, 18)?.reward.id, 'mahal');
assert.equal(nextTarget(rewards, 40), null);

const now = Date.UTC(2026, 9, 4, 12);
const later = (min: number) => new Date(now + min * 60000).toISOString();
assert.equal(timeLeftLabel(later(21 * 60 + 30), now), '21 jam lagi');
assert.equal(timeLeftLabel(later(45), now), '45 menit lagi');
assert.equal(timeLeftLabel(later(0.5), now), '1 menit lagi');
assert.equal(timeLeftLabel(later(-1), now), null);

assert.equal(maskPhone('081234567890'), '0812-****-7890');

console.log('membership.check: ok');

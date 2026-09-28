// Jalankan: npm run check
import assert from 'node:assert/strict';
import type { StoreHours } from '../src/types/storeHours.ts';
import { getOpeningSummary, isStoreOpen } from '../src/utils/storeHours.ts';

function week(openDays: number[]): StoreHours[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
    const isOpen = openDays.includes(dayOfWeek);
    return {
      channel: 'offline',
      dayOfWeek,
      isOpen,
      openTime: isOpen ? '08:00' : null,
      closeTime: isOpen ? '23:00' : null,
    };
  });
}

const days = (openDays: number[]) => getOpeningSummary(week(openDays), 'offline')?.days;
assert.equal(days([0, 1, 2, 3, 4, 5, 6]), 'Setiap Hari');
assert.equal(days([0, 2, 3, 4, 5, 6]), 'Selasa - Minggu');
assert.equal(days([1, 2, 3, 4, 5]), 'Senin - Jumat');
assert.equal(days([6, 0, 1]), 'Sabtu - Senin');
assert.equal(days([3]), 'Rabu');
assert.equal(days([1, 3]), 'Senin, Rabu');
assert.equal(days([]), undefined);
assert.equal(getOpeningSummary(week([0]), 'online'), null);

const hours = week([0, 2, 3, 4, 5, 6]);
const at = (iso: string) => isStoreOpen(hours, 'offline', new Date(iso));
assert.equal(at('2026-09-29T08:00:00'), true); // Selasa, tepat buka
assert.equal(at('2026-09-29T22:59:00'), true);
assert.equal(at('2026-09-29T23:00:00'), false); // tepat tutup
assert.equal(at('2026-09-29T07:59:00'), false);
assert.equal(at('2026-09-28T12:00:00'), false); // Senin libur
assert.equal(isStoreOpen(hours, 'online', new Date('2026-09-29T12:00:00')), false); // tanpa data

console.log('storeHours: semua cek lolos');

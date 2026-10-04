import type { StoreHours } from '@/types/storeHours';
import { mockDelay } from './mockDelay';

function week(
  channel: StoreHours['channel'],
  openTime: string,
  closeTime: string,
  closedDays: number[]
): StoreHours[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
    const isOpen = !closedDays.includes(dayOfWeek);
    return {
      channel,
      dayOfWeek,
      isOpen,
      openTime: isOpen ? openTime : null,
      closeTime: isOpen ? closeTime : null,
    };
  });
}

// TODO(backend): ganti dengan query tabel store_hours (open_time "08:00:00" → slice(0, 5)).
const MOCK_STORE_HOURS: StoreHours[] = [
  ...week('offline', '08:00', '23:00', [1]),
  ...week('online', '10:00', '24:00', [1]),
];

export async function fetchStoreHours(): Promise<StoreHours[]> {
  return mockDelay(MOCK_STORE_HOURS);
}

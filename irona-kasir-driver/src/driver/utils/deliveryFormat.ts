import type { DeliveryItem, DeliveryStatus } from '@/driver/types/delivery';
import { colors } from '@/constants/colors';

/** Perkiraan waktu tempuh kasar sebelum ada GPS/rute: ±3 menit per km, minimal 5 menit */
const MINUTES_PER_KM = 3;

export function estimateMinutes(distanceKm: number): number {
  return Math.max(5, Math.round(distanceKm * MINUTES_PER_KM));
}

/** "ONL-261005-0001" → "#0001" (cukup untuk dicocokkan dengan stiker pesanan) */
export function shortOrderNumber(number: string): string {
  return `#${number.split('-').pop() ?? number}`;
}

/** "2x Caramel Macchiato, 1x Butter Croissant" */
export function summarizeItems(items: DeliveryItem[]): string {
  return items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
}

export const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; color: string }> = {
  dibuat: { label: 'Sedang Dibuat', color: colors.textSubtle },
  siap_diantar: { label: 'Siap Diantar', color: '#d97706' },
  diantar: { label: 'Sedang Diantar', color: colors.info },
  selesai: { label: 'Selesai', color: colors.success },
  dibatalkan: { label: 'Dibatalkan', color: colors.danger },
};

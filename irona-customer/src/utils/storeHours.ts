import type { HoursChannel, StoreHours } from '../types/storeHours';

export const HOURS_CHANNELS: { channel: HoursChannel; label: string }[] = [
  { channel: 'offline', label: 'Store' },
  { channel: 'online', label: 'Online' },
];

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
/** Minggu toko dimulai Senin */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface OpeningSummary {
  /** "Setiap Hari" | "Selasa - Minggu" | "Senin, Rabu" */
  days: string;
  openTime: string;
  closeTime: string;
}

function toHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Toko/layanan sedang buka pada waktu `now` (jam lokal perangkat) */
export function isStoreOpen(
  hours: StoreHours[],
  channel: HoursChannel,
  now: Date = new Date()
): boolean {
  const today = hours.find((h) => h.channel === channel && h.dayOfWeek === now.getDay());
  if (!today?.isOpen || !today.openTime || !today.closeTime) return false;
  const time = toHHMM(now);
  // DB menjamin close_time > open_time, jadi tidak ada jam lewat tengah malam
  return time >= today.openTime && time < today.closeTime;
}

/** Ringkasan hari & jam buka untuk ditampilkan, mis. "Selasa - Minggu" 08:00–23:00 */
export function getOpeningSummary(
  hours: StoreHours[],
  channel: HoursChannel
): OpeningSummary | null {
  const byDay = new Map(hours.filter((h) => h.channel === channel).map((h) => [h.dayOfWeek, h]));
  const open = WEEK_ORDER.map((d) => byDay.get(d)?.isOpen === true);
  const openDays = WEEK_ORDER.filter((_, i) => open[i]);
  const first = byDay.get(openDays[0]);
  if (!first?.openTime || !first.closeTime) return null;

  // Hari buka membentuk satu rentang berurutan (boleh melingkar Minggu → Senin)?
  const runStarts = WEEK_ORDER.map((_, i) => i).filter((i) => open[i] && !open[(i + 6) % 7]);
  let days: string;
  if (openDays.length === 7) days = 'Setiap Hari';
  else if (openDays.length === 1) days = DAY_NAMES[openDays[0]];
  else if (runStarts.length === 1) {
    const start = runStarts[0];
    const end = (start + openDays.length - 1) % 7;
    days = `${DAY_NAMES[WEEK_ORDER[start]]} - ${DAY_NAMES[WEEK_ORDER[end]]}`;
  } else days = openDays.map((d) => DAY_NAMES[d]).join(', ');

  // ponytail: jam diambil dari hari buka pertama; kalau jam per hari beda, tampilkan per hari
  return { days, openTime: first.openTime, closeTime: first.closeTime };
}

/** "08:00" → "08.00" */
export function formatClock(time: string): string {
  return time.replace(':', '.');
}

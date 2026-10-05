import type { PeakCell } from '../../types/trendReport';

/** Urutan baris heatmap: Senin → Minggu (dow 0 = Minggu) */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const HOURS = Array.from({ length: 24 }, (_, h) => h);

export const hourLabel = (h: number) =>
  `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`;

export type ValueOf = (c: PeakCell) => number;

/** Total per jam (00–23) dan per hari dari sel heatmap */
export function aggregatePeak(cells: PeakCell[], valueOf: ValueOf) {
  const byHour = HOURS.map(() => 0);
  const byDay = DAY_NAMES.map(() => 0);
  cells.forEach((c) => {
    byHour[c.hour] += valueOf(c);
    byDay[c.dow] += valueOf(c);
  });
  const total = byHour.reduce((s, v) => s + v, 0);
  const peakHour = total ? byHour.indexOf(Math.max(...byHour)) : null;
  const peakDow = total ? byDay.indexOf(Math.max(...byDay)) : null;
  return { byHour, byDay, total, peakHour, peakDow };
}

import { parseLocalDate, toLocalISO } from '../../utils/date';
import type { DateRange } from './reportRange';

export type TrendGroup = 'day' | 'month';

/** Warna garis grafik tren (urut sesuai peringkat) */
export const SERIES_COLORS = [
  '#0f172a',
  '#05e298',
  '#de9a35',
  '#6d28d9',
  '#0ea5e9',
  '#e11d48',
  '#84cc16',
  '#64748b',
];

/** Rentang > 62 hari: grafik per bulan supaya tetap terbaca */
export function trendGroup(range: DateRange): TrendGroup {
  const days = Math.round(
    (parseLocalDate(range.end).getTime() - parseLocalDate(range.start).getTime()) / 86400000
  );
  return days > 62 ? 'month' : 'day';
}

/** Awal periode (hari / tanggal 1 bulan) untuk tanggal "YYYY-MM-DD" */
export function periodKey(iso: string, group: TrendGroup): string {
  return group === 'month' ? `${iso.slice(0, 7)}-01` : iso;
}

/**
 * Data grafik: satu baris per periode dalam rentang (periode tanpa penjualan = 0),
 * kolom per seri (id produk / kategori).
 */
export function buildTrendData(
  points: { period: string; key: string; value: number }[],
  keys: string[],
  range: DateRange,
  group: TrendGroup
): Record<string, number | string>[] {
  const rows = new Map<string, Record<string, number | string>>();
  const cursor = parseLocalDate(periodKey(range.start, group));
  const last = parseLocalDate(range.end);
  while (cursor <= last) {
    const iso = toLocalISO(cursor);
    const row: Record<string, number | string> = {
      period: iso,
      label:
        group === 'month'
          ? cursor.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
          : cursor.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    };
    keys.forEach((k) => (row[k] = 0));
    rows.set(iso, row);
    if (group === 'month') cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  points.forEach((p) => {
    const row = rows.get(periodKey(p.period, group));
    if (row && p.key in row) row[p.key] = (row[p.key] as number) + p.value;
  });
  return [...rows.values()];
}

export const compactRupiah = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
    : Math.abs(n) >= 1_000
      ? `${(n / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`
      : String(Math.round(n));

export const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

export const pctText = (a: number, b: number) =>
  `${pct(a, b).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

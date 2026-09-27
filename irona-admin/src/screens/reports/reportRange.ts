import { parseLocalDate, toLocalISO } from '../../utils/date';

export type DatePreset = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'custom';

export const PRESET_LABELS: Record<DatePreset, string> = {
  this_month: 'Bulan Ini',
  last_month: 'Bulan Lalu',
  last_3_months: '3 Bulan Terakhir',
  this_year: 'Tahun Ini',
  custom: 'Pilih Tanggal',
};

export type DateRange = { start: string; end: string };

/** Rentang tanggal untuk pilihan cepat, dihitung dari "hari ini" */
export function presetRange(preset: Exclude<DatePreset, 'custom'>, today: string): DateRange {
  const t = parseLocalDate(today);
  const y = t.getFullYear();
  const m = t.getMonth();
  switch (preset) {
    case 'this_month':
      return { start: toLocalISO(new Date(y, m, 1)), end: today };
    case 'last_month':
      return { start: toLocalISO(new Date(y, m - 1, 1)), end: toLocalISO(new Date(y, m, 0)) };
    case 'last_3_months':
      return { start: toLocalISO(new Date(y, m - 2, 1)), end: today };
    case 'this_year':
      return { start: toLocalISO(new Date(y, 0, 1)), end: today };
  }
}

/** "01 Sep 2026 – 27 Sep 2026" */
export function rangeText(range: DateRange): string {
  const f = (iso: string) =>
    parseLocalDate(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  return range.start === range.end ? f(range.start) : `${f(range.start)} – ${f(range.end)}`;
}

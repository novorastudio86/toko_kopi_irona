import type { DashboardMode } from '../../types/dashboard';
import { parseLocalDate, toLocalISO } from '../../utils/date';

export type Period = {
  mode: DashboardMode;
  /** Awal & akhir periode (akhir eksklusif), waktu lokal WIB */
  start: Date;
  end: Date;
  /** Akhir yang dipakai menghitung: kalau periode masih berjalan = sekarang */
  effectiveEnd: Date;
  prevStart: Date;
  /** Pembanding dipotong sepanjang periode ini yang sudah berjalan (perbandingan adil) */
  prevEnd: Date;
  granularity: 'hour' | 'day';
  /** Jumlah titik grafik untuk mode harian (hari) — jam ditentukan jam buka toko */
  days: number;
  isOngoing: boolean;
};

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];
const MONTHS_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
export const WEEKDAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function buildPeriod(mode: DashboardMode, anchorISO: string, now: Date): Period {
  const anchor = parseLocalDate(anchorISO);
  let start: Date;
  let end: Date;
  let prevStart: Date;
  if (mode === 'day') {
    start = anchor;
    end = addDays(anchor, 1);
    prevStart = addDays(anchor, -1);
  } else if (mode === 'week') {
    // Minggu Senin–Minggu yang memuat tanggal terpilih
    const offset = (anchor.getDay() + 6) % 7;
    start = addDays(anchor, -offset);
    end = addDays(start, 7);
    prevStart = addDays(start, -7);
  } else {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    prevStart = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
  }
  const isOngoing = now >= start && now < end;
  const effectiveEnd = isOngoing ? now : end;
  const prevFullEnd =
    mode === 'month' ? start : new Date(prevStart.getTime() + (end.getTime() - start.getTime()));
  const elapsed = effectiveEnd.getTime() - start.getTime();
  const prevEnd = new Date(Math.min(prevStart.getTime() + elapsed, prevFullEnd.getTime()));

  return {
    mode,
    start,
    end,
    effectiveEnd,
    prevStart,
    prevEnd,
    granularity: mode === 'day' ? 'hour' : 'day',
    days: Math.round((end.getTime() - start.getTime()) / 86400000),
    isOngoing,
  };
}

export function shortDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function longDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** Teks di tombol tanggal, mis. "01 Sep 2026 - 30 Sep 2026" */
export function rangeLabel(p: Period): string {
  if (p.mode === 'day') return shortDate(p.start);
  return `${shortDate(p.start)} - ${shortDate(addDays(p.end, -1))}`;
}

/** Label badge di judul grafik */
export function chartBadge(p: Period): string {
  if (p.mode === 'day') return longDate(p.start);
  if (p.mode === 'month') return `${MONTHS_LONG[p.start.getMonth()]} ${p.start.getFullYear()}`;
  return `${shortDate(p.start)} - ${shortDate(addDays(p.end, -1))}`;
}

export function previousLabel(mode: DashboardMode): string {
  return mode === 'day' ? 'Periode Kemarin' : mode === 'week' ? 'Minggu Lalu' : 'Bulan Lalu';
}

export function targetLabel(p: Period): string {
  const word = p.mode === 'day' ? 'Hari' : p.mode === 'week' ? 'Minggu' : 'Bulan';
  return p.isOngoing ? `Target ${word} ini` : `Target ${word}`;
}

/** Tanggal (ISO) titik ke-n pada periode ini / pembanding, untuk label tooltip */
export function bucketDate(base: Date, bucket: number): Date {
  return addDays(base, bucket);
}

export function toISO(d: Date): string {
  return toLocalISO(d);
}

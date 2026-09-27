import type { BalanceStatus, Bucket, EntryType } from '../../types/finance';
import { parseLocalDate } from '../../utils/date';

export const BUCKET_LABELS: Record<Bucket, string> = {
  hpp: 'HPP',
  fixed_cost: 'Fixed Cost',
  net_profit: 'Net Profit',
};

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  alokasi: 'Alokasi Otomatis',
  reversal_refund: 'Reversal Refund',
  bahan_baku: 'Bahan Baku',
  kasbon: 'Kasbon',
  pelunasan_kasbon: 'Pelunasan Kasbon',
  gaji: 'Pembayaran Gaji',
  pengeluaran_lain: 'Pengeluaran Lain',
  try_error: 'Try & Error',
  pembelian_aset: 'Pembelian Aset',
};

export const ENTRY_TYPE_CLASSES: Record<EntryType, string> = {
  alokasi: 'bg-[#ecfdf5] text-[#047857]',
  reversal_refund: 'bg-[#fff1f2] text-[#be123c]',
  bahan_baku: 'bg-[#eff6ff] text-[#1d4ed8]',
  kasbon: 'bg-[#fef3c7] text-[#92400e]',
  pelunasan_kasbon: 'bg-[#ecfdf5] text-[#047857]',
  gaji: 'bg-[#f1f5f9] text-[#334155]',
  pengeluaran_lain: 'bg-[#f5f3ff] text-[#6d28d9]',
  try_error: 'bg-[#fef3c7] text-[#92400e]',
  pembelian_aset: 'bg-[#f1f5f9] text-[#334155]',
};

export const BALANCE_STATUS_LABELS: Record<BalanceStatus, string> = {
  tertahan: 'Tertahan',
  tersedia: 'Tersedia',
  dicairkan: 'Sudah Dicairkan',
  direfund: 'Direfund',
};

export const BALANCE_STATUS_CLASSES: Record<BalanceStatus, string> = {
  tertahan: 'bg-[#fef3c7] text-[#92400e]',
  tersedia: 'bg-[#eff6ff] text-[#1d4ed8]',
  dicairkan: 'bg-[#ecfdf5] text-[#047857]',
  direfund: 'bg-[#f1f5f9] text-[#64748b]',
};

export const MONTH_NAMES = [
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

/** Jumlah hari dalam bulan (month 1–12), mis. Februari 2028 → 29 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function formatDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Rupiah dengan tanda: +Rp 1.000 / −Rp 1.000 */
export function signedRupiah(value: number, format: (n: number) => string): string {
  if (value === 0) return format(0);
  return `${value > 0 ? '+' : '−'}${format(Math.abs(value))}`;
}

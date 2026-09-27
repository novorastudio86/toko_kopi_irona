import { formatRupiah } from '../../utils/format';
import { parseLocalDate } from '../../utils/date';
import type { Channel, PromoType, PromotionInput } from '../../types/promotion';

export const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
/** Urutan tampil Senin → Minggu (0 = Minggu) */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const CHANNEL_LABELS: Record<Channel, string> = { offline: 'Offline', online: 'Online' };
export const TYPE_LABELS: Record<PromoType, string> = { otomatis: 'Otomatis', manual: 'Manual' };

/** Keterangan dinamis Tipe × Channel (PRD) */
export function typeMeaning(promoType: PromoType, channel: Channel): string {
  if (channel === 'offline') {
    return promoType === 'manual'
      ? 'Kasir pilih & terapkan manual saat transaksi.'
      : 'Diterapkan otomatis begitu syarat terpenuhi.';
  }
  return promoType === 'manual'
    ? 'Jadi voucher — customer klaim dulu sebelum bisa dipakai.'
    : 'Diterapkan otomatis saat checkout.';
}

/** "Produk — 20%" / "Ongkir — Rp10.000" */
export function formatTargetValue(
  p: Pick<PromotionInput, 'discountTarget' | 'discountKind' | 'discountValue'>
): string {
  const value = p.discountKind === 'persen' ? `${p.discountValue}%` : formatRupiah(p.discountValue);
  return `${p.discountTarget === 'ongkir' ? 'Ongkir' : 'Produk'} — ${value}`;
}

export function formatCriteria(
  p: Pick<PromotionInput, 'minPurchaseType' | 'minPurchaseValue' | 'isRepeatable'>
): string {
  const base =
    p.minPurchaseType === 'qty'
      ? `Min. ${p.minPurchaseValue} produk`
      : `Min. belanja ${formatRupiah(p.minPurchaseValue)}`;
  return p.isRepeatable ? `${base} · kelipatan` : base;
}

export function formatDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDays(days: number[]): string {
  if (days.length === 0 || days.length === 7) return 'Setiap hari';
  const sorted = DAY_ORDER.filter((d) => days.includes(d));
  if (sorted.join() === '1,2,3,4,5') return 'Sen–Jum';
  if (sorted.join() === '6,0') return 'Sab–Min';
  return sorted.map((d) => DAY_LABELS[d]).join(', ');
}

export function formatHours(start: string | null, end: string | null): string {
  return start && end ? `${start.slice(0, 5)}–${end.slice(0, 5)}` : 'Sepanjang jam buka';
}

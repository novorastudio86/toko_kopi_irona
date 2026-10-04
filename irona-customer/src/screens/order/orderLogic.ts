import type { OrderStatus } from '../../types/onlineOrder.ts';

/** Batas bayar QRIS sejak pesanan dibuat (samakan dengan expiry QRIS Midtrans) */
export const PAY_WINDOW_MIN = 15;

/** Lama pesanan tamu tetap terlihat di Keranjang, dihitung dari waktu pesan */
export const RECENT_ORDER_HOURS = 24;
const RECENT_ORDER_MAX = 5;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  menunggu_pembayaran: 'Menunggu pembayaran',
  diproses: 'Disiapkan',
  diantar: 'Diantar',
  selesai: 'Selesai',
  kedaluwarsa: 'Waktu bayar habis',
  dibatalkan: 'Dibatalkan',
};

/** Urutan status setelah dibayar, untuk timeline di halaman pesanan */
export const TRACK_STEPS: { status: OrderStatus; label: string; hint: string }[] = [
  { status: 'diproses', label: 'Disiapkan', hint: 'Barista sedang membuat pesananmu' },
  { status: 'diantar', label: 'Diantar', hint: 'Driver menuju titik antar' },
  { status: 'selesai', label: 'Selesai', hint: 'Pesanan sudah diterima' },
];

export const isPaid = (s: OrderStatus) => s === 'diproses' || s === 'diantar' || s === 'selesai';

/** Status masih bisa berubah → halaman perlu cek ulang berkala */
export const isActive = (s: OrderStatus) =>
  s === 'menunggu_pembayaran' || s === 'diproses' || s === 'diantar';

/** Langkah ke-n yang sudah dicapai; -1 = belum dibayar/batal */
export const trackIndex = (s: OrderStatus) => TRACK_STEPS.findIndex((step) => step.status === s);

/** Sisa waktu bayar "mm:ss" (tidak pernah negatif) */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface RecentOrder {
  id: string;
  createdAt: string;
}

/** Buang pesanan yang lewat masa simpan / data rusak; terbaru di atas, maks. 5 */
export function pruneRecent(list: unknown, now: number): RecentOrder[] {
  if (!Array.isArray(list)) return [];
  const minTime = now - RECENT_ORDER_HOURS * 3_600_000;
  return list
    .filter(
      (o): o is RecentOrder =>
        typeof o?.id === 'string' &&
        typeof o?.createdAt === 'string' &&
        Date.parse(o.createdAt) > minTime
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, RECENT_ORDER_MAX);
}

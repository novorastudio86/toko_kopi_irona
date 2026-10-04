import type { DeliverySettings, LatLng, Voucher } from '../../types/onlineOrder.ts';

/** Batas catatan per menu — cukup untuk "tanpa es, gula dikit" */
export const ITEM_NOTE_MAX = 60;

/**
 * Jarak outlet → pin pelanggan, dibulatkan ke atas per 100 m supaya angka tampil = angka ongkir.
 * ponytail: garis lurus (haversine), lebih pendek dari rute jalan; ganti dengan jarak rute
 * (Google Distance Matrix / OSRM) di backend saat order dibuat.
 */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  const meters = 2 * 6371000 * Math.asin(Math.sqrt(h));
  return Math.ceil(meters / 100) / 10;
}

/** 3,4 km */
export function formatKm(km: number): string {
  return `${km.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

/** Salinan calcDeliveryFee di irona-admin (= SQL calc_delivery_fee); null = di luar jangkauan */
export function deliveryFee(km: number, s: DeliverySettings): number | null {
  if (km > s.maxDistanceKm) return null;
  const distanceM = Math.round(km * 1000);
  const stepM = Math.round(s.stepKm * 1000);
  const steps = Math.floor(distanceM / stepM);
  const units = Math.ceil((distanceM - steps * stepM) / 100);
  return steps * s.feePerStep + units * s.feePer100m;
}

export interface VoucherContext {
  subtotal: number;
  /** null = titik belum dipilih / di luar jangkauan */
  shippingFee: number | null;
  km: number | null;
  isMember: boolean;
}

/** Potongan dalam Rupiah, atau alasan voucher belum bisa dipakai */
export function checkVoucher(
  v: Voucher,
  ctx: VoucherContext
): { discount: number } | { reason: string } {
  if (v.memberOnly && !ctx.isMember) return { reason: 'Khusus member' };
  if (ctx.subtotal < v.minPurchase)
    return { reason: `Min. belanja Rp${v.minPurchase.toLocaleString('id-ID')}` };
  if (v.target === 'ongkir') {
    if (ctx.shippingFee === null || ctx.km === null) return { reason: 'Pilih titik antar dulu' };
    if (v.maxDistanceKm !== null && ctx.km > v.maxDistanceKm)
      return { reason: `Maks. ${formatKm(v.maxDistanceKm)}` };
  }
  const base = v.target === 'produk' ? ctx.subtotal : (ctx.shippingFee ?? 0);
  const raw = v.kind === 'persen' ? Math.round((base * v.value) / 100) : v.value;
  return { discount: Math.min(raw, base) };
}

/** Aturan bisnis: 1 diskon per transaksi, default potongan terbesar */
export function bestVoucher(vouchers: Voucher[], ctx: VoucherContext): Voucher | null {
  let best: Voucher | null = null;
  let bestDiscount = 0;
  for (const v of vouchers) {
    const r = checkVoucher(v, ctx);
    if ('discount' in r && r.discount > bestDiscount) {
      best = v;
      bestDiscount = r.discount;
    }
  }
  return best;
}

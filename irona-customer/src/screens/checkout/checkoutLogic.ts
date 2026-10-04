import type { DeliverySettings, Voucher } from '../../types/onlineOrder.ts';

/** Batas catatan per menu — cukup untuk "tanpa es, gula dikit" */
export const ITEM_NOTE_MAX = 60;

/** Meter rute → km, dibulatkan ke atas per 100 m (sama dengan Edge Function delivery-quote) */
export function routeKm(meters: number): number {
  return Math.ceil(meters / 100) / 10;
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
      return { reason: `Maks. ${v.maxDistanceKm.toLocaleString('id-ID')} km` };
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

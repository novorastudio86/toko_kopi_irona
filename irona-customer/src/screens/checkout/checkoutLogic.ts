import type { DeliverySettings, Voucher } from '../../types/onlineOrder.ts';

/** Batas catatan pesanan untuk kasir */
export const ORDER_NOTE_MAX = 100;

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

export type VoucherTarget = Voucher['target'];
export type VoucherPicks = Record<VoucherTarget, string | null>;

/** Warna pembeda sasaran: menu = hitam, ongkir = abu (dipakai juga di chip halaman checkout) */
export const TARGET_TONE: Record<VoucherTarget, string> = {
  produk: 'bg-primary text-primary-foreground',
  ongkir: 'bg-muted-foreground text-background',
};

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

/**
 * Aturan bisnis: maks. 1 voucher menu + 1 voucher ongkir per transaksi;
 * default per sasaran = promo otomatis dengan potongan terbesar
 */
export function bestVoucher(
  vouchers: Voucher[],
  ctx: VoucherContext,
  target: Voucher['target']
): Voucher | null {
  let best: Voucher | null = null;
  let bestDiscount = 0;
  for (const v of vouchers) {
    if (v.promoType !== 'otomatis' || v.target !== target) continue;
    const r = checkVoucher(v, ctx);
    if ('discount' in r && r.discount > bestDiscount) {
      best = v;
      bestDiscount = r.discount;
    }
  }
  return best;
}

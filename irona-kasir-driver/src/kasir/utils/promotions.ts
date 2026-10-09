import type { CartItem, Promotion } from '@/kasir/types/catalog';
import type { OrderType } from '@/kasir/types/order';

export interface PromoContext {
  items: CartItem[];
  isMember: boolean;
  orderType: OrderType;
  now: Date;
}

/** Diskon yang terpasang di pesanan + potongan per produk (productId → Rp) */
export interface AppliedPromotion {
  promotion: Promotion;
  discounts: Record<string, number>;
  total: number;
}

/** "YYYY-MM-DD" menurut jam tablet */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const lineTotal = (i: CartItem) => i.product.price * i.quantity;

function relatedItems(p: Promotion, items: CartItem[]): CartItem[] {
  return p.appliesToAllProducts ? items : items.filter((i) => p.productIds.includes(i.product.id));
}

/** Berapa kali syarat minimal terpenuhi (0 = belum, >1 hanya kalau Berlaku Kelipatan) */
function multiplier(p: Promotion, related: CartItem[]): number {
  if (p.minPurchaseType === 'none' || p.minPurchaseValue <= 0) return 1;
  const metric = related.reduce((sum, i) => sum + (p.minPurchaseType === 'qty' ? i.quantity : lineTotal(i)), 0);
  const times = Math.floor(metric / p.minPurchaseValue);
  return p.isRepeatable ? times : Math.min(times, 1);
}

/** Alasan diskon belum bisa dipakai di pesanan ini; null = bisa dipakai */
export function promoBlocker(p: Promotion, ctx: PromoContext): string | null {
  const today = localDate(ctx.now);
  if (today < p.startDate) return `Mulai ${p.startDate.split('-').reverse().join('/')}`;
  if (today > p.endDate) return 'Sudah berakhir';
  if (p.validDays.length > 0 && !p.validDays.includes(ctx.now.getDay())) return 'Tidak berlaku hari ini';
  // ponytail: jam lintas tengah malam (mis. 22:00–02:00) belum didukung, sama seperti form admin
  const time = ctx.now.toTimeString().slice(0, 8);
  if (p.validStartTime && p.validEndTime && (time < p.validStartTime || time > p.validEndTime)) {
    return `Berlaku ${p.validStartTime.slice(0, 5)}–${p.validEndTime.slice(0, 5)}`;
  }
  if (p.memberOnly && !ctx.isMember) return 'Khusus member';
  if (!p.appliesToTakeAway && ctx.orderType === 'take_away') return 'Tidak berlaku Take Away';
  const related = relatedItems(p, ctx.items);
  if (related.length === 0) return 'Produknya belum ada di pesanan';
  if (multiplier(p, related) < 1) {
    return p.minPurchaseType === 'qty'
      ? `Min. ${p.minPurchaseValue} produk`
      : `Min. belanja Rp${p.minPurchaseValue.toLocaleString('id-ID')}`;
  }
  return null;
}

/** Potongan per produk untuk diskon yang sudah lolos promoBlocker */
function apply(p: Promotion, items: CartItem[]): AppliedPromotion {
  const related = relatedItems(p, items);
  const discounts: Record<string, number> = {};
  if (p.discountKind === 'persen') {
    const pct = Math.min(p.discountValue, 100);
    related.forEach((i) => (discounts[i.product.id] = Math.round((lineTotal(i) * pct) / 100)));
  } else {
    // Nominal (× kelipatan) dipotong berurutan dari produk terkait, tidak melebihi harganya
    let left = p.discountValue * multiplier(p, related);
    related.forEach((i) => {
      const cut = Math.min(left, lineTotal(i));
      left -= cut;
      if (cut > 0) discounts[i.product.id] = cut;
    });
  }
  const total = Object.values(discounts).reduce((sum, v) => sum + v, 0);
  return { promotion: p, discounts, total };
}

/**
 * Aturan bisnis: 1 diskon per transaksi. Diskon manual pilihan kasir dipakai kalau masih
 * memenuhi syarat; selain itu diskon otomatis dengan potongan terbesar.
 */
export function pickPromotion(
  promotions: Promotion[],
  selectedId: string | null,
  ctx: PromoContext
): AppliedPromotion | null {
  const usable = promotions.filter((p) => !promoBlocker(p, ctx));
  const chosen = usable.find((p) => p.id === selectedId && p.promoType === 'manual');
  if (chosen) return apply(chosen, ctx.items);
  return usable
    .filter((p) => p.promoType === 'otomatis')
    .map((p) => apply(p, ctx.items))
    .reduce<AppliedPromotion | null>((best, a) => (a.total > (best?.total ?? 0) ? a : best), null);
}

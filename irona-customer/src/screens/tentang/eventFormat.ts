import { formatRupiah } from '../../utils/format.ts';

// Import relatif + ekstensi .ts supaya bisa diuji langsung dengan node (scripts/events.check.ts)

/** Bentuk diskon mengikuti Promosi › Diskon di web admin (irona-admin/src/types/promotion.ts) */
export interface PromoItem {
  kind: 'promo';
  id: string;
  name: string;
  description: string;
  image: string;
  channel: 'offline' | 'online';
  discountTarget: 'produk' | 'ongkir';
  discountKind: 'nominal' | 'persen';
  /** Rp untuk nominal, % untuk persen */
  discountValue: number;
  /** Khusus ongkir; null = semua jarak */
  maxDistanceKm: number | null;
  /** Kosong = semua produk */
  productNames: string[];
  promoType: 'otomatis' | 'manual';
  targetCustomer: 'semua' | 'member';
  minPurchaseType: 'qty' | 'nominal';
  minPurchaseValue: number;
  isRepeatable: boolean;
  /** Khusus online */
  maxOneClaimPerCustomer: boolean;
  /** Khusus offline */
  appliesToTakeAway: boolean;
  isActive: boolean;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  /** 0=Minggu..6=Sabtu, kosong = setiap hari */
  validDays: number[];
  validStartTime: string | null;
  validEndTime: string | null;
}

export interface EventItem {
  kind: 'event';
  id: string;
  title: string;
  description: string;
  image: string;
  tag?: string;
  /** YYYY-MM-DD; lewat dari hari ini = event selesai */
  date: string;
  time: string;
  location: string;
  /** Link Google Maps lokasi event (toko Irona atau tempat lain) */
  mapsUrl: string;
  /** 0 = gratis */
  price: number;
  /** Event mendatang: penjelasan acara & apa saja yang ada */
  details?: string[];
  highlights?: string[];
  /** Event selesai */
  photos?: { src: string; caption?: string }[];
}

export type FeedItem = PromoItem | EventItem;

/** Tanggal lokal hari ini, "YYYY-MM-DD" */
export const todayIso = () => new Date().toLocaleDateString('sv-SE');

export const isPromoRunning = (p: PromoItem, today: string) =>
  p.isActive && p.startDate <= today && today <= p.endDate;

export const isEventDone = (e: EventItem, today: string) => e.date < today;

/** Promo nonaktif / belum mulai / sudah lewat tidak ditampilkan; event selalu tampil */
export const visibleItems = (items: FeedItem[], today: string) =>
  items.filter((i) => i.kind === 'event' || isPromoRunning(i, today));

export function formatDate(iso: string, style: 'short' | 'long' = 'short'): string {
  return new Date(`${iso}T00:00`).toLocaleDateString(
    'id-ID',
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { day: '2-digit', month: 'short', year: 'numeric' }
  );
}

/** "Hari ini" / "Besok" / "8 hari lagi" */
export function countdownLabel(iso: string, today: string): string {
  const days = Math.round((Date.parse(iso) - Date.parse(today)) / 86_400_000);
  return days === 0 ? 'Hari ini' : days === 1 ? 'Besok' : `${days} hari lagi`;
}

/** "20%" / "Rp 4.000" */
export const formatDiscountValue = (p: PromoItem) =>
  p.discountKind === 'persen' ? `${p.discountValue}%` : formatRupiah(p.discountValue);

export const formatMinPurchase = (p: PromoItem) =>
  p.minPurchaseType === 'qty'
    ? `Min. beli ${p.minPurchaseValue} produk`
    : `Min. belanja ${formatRupiah(p.minPurchaseValue)}`;

export const CHANNEL_LABELS = { offline: 'Offline · di toko', online: 'Online · lewat website' };

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function formatDays(days: number[]): string {
  if (days.length === 0 || days.length === 7) return 'Setiap hari';
  // Urut Senin → Minggu
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => days.includes(d))
    .map((d) => DAY_NAMES[d])
    .join(', ');
}

export function formatHours(start: string | null, end: string | null): string {
  const hm = (t: string) => t.slice(0, 5).replace(':', '.');
  return start && end ? `${hm(start)} – ${hm(end)} WIB` : 'Sepanjang jam buka';
}

const HOW_TO_USE = {
  offline: {
    manual: 'Sebutkan promo ini ke kasir saat memesan di toko.',
    otomatis: 'Potongan langsung terpasang di kasir begitu syarat terpenuhi.',
  },
  online: {
    manual: 'Klaim vouchernya dulu, lalu pakai saat checkout di website.',
    otomatis: 'Potongan langsung terpasang saat checkout di website.',
  },
};

/** Syarat & ketentuan promo dalam bahasa pelanggan */
export function promoTerms(p: PromoItem): string[] {
  const min = formatMinPurchase(p);
  const terms = [
    p.isRepeatable ? `${min}, berlaku kelipatan.` : `${min}.`,
    p.discountTarget === 'ongkir'
      ? p.maxDistanceKm
        ? `Potongan ongkir untuk jarak antar maks. ${p.maxDistanceKm} km.`
        : 'Potongan ongkir untuk semua jarak antar.'
      : p.productNames.length
        ? `Berlaku untuk ${p.productNames.join(', ')}.`
        : 'Berlaku untuk semua produk.',
    p.targetCustomer === 'member' ? 'Khusus member Kora Club.' : 'Berlaku untuk semua pelanggan.',
    HOW_TO_USE[p.channel][p.promoType],
  ];
  if (p.channel === 'online' && p.maxOneClaimPerCustomer)
    terms.push('Maks. 1× klaim per pelanggan.');
  if (p.channel === 'offline')
    terms.push(
      p.appliesToTakeAway
        ? 'Berlaku untuk makan di tempat maupun take away.'
        : 'Hanya untuk makan di tempat, tidak untuk take away.'
    );
  terms.push('Satu transaksi hanya bisa memakai 1 promo.');
  return terms;
}

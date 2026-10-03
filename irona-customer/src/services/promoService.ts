import promoImage from '@/assets/images/730cf7c3-5ce8-4323-9d49-1d3694e6ead0.jpg';
import type { Promo } from '@/types/promo';
import { mockDelay } from './mockDelay';

// TODO(backend): ganti dengan query promo aktif dari Supabase. Isi masih dummy.
const MOCK_ACTIVE_PROMO: Promo | null = {
  id: 'promo-dummy-1',
  headline: 'Potongan 20%',
  description:
    'untuk pesanan pertamamu saat gabung member Kora Club. Vouchernya berlaku 30 hari sejak kamu daftar.',
  terms:
    'Gratis daftar, cukup pakai nomor HP. Kumpulkan poin dari setiap pembelian dan tukar dengan reward.',
  imageUrl: promoImage,
  ctaLabel: 'Gabung & Klaim Voucher',
  ctaHref: '/membership',
};

/** Promo yang sedang aktif; null = tidak ada promo */
export async function fetchActivePromo(): Promise<Promo | null> {
  return mockDelay(MOCK_ACTIVE_PROMO);
}

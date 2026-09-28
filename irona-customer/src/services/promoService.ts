import type { Promo } from '@/types/promo';
import { mockDelay } from './mockDelay';

// TODO(backend): ganti dengan query promo aktif dari Supabase. Isi masih dummy.
const MOCK_ACTIVE_PROMO: Promo | null = {
  id: 'promo-dummy-1',
  headline: 'Diskon 20% Kopi Susu',
  description: 'Khusus pesanan online minggu ini, semua varian kopi susu lebih hemat.',
  code: 'IRONA20',
  ctaLabel: 'Pesan sekarang',
  ctaHref: '#menu',
};

/** Promo yang sedang aktif; null = tidak ada promo */
export async function fetchActivePromo(): Promise<Promo | null> {
  return mockDelay(MOCK_ACTIVE_PROMO);
}

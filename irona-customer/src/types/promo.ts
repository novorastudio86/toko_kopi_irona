// TODO(backend): belum ada tabel promo — sementara dari mock di services/promoService.ts.
export interface Promo {
  id: string;
  headline: string;
  description: string;
  /** Kode promo; null = tidak ditampilkan */
  code: string | null;
  ctaLabel: string;
  ctaHref: string;
}

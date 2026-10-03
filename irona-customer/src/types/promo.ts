// TODO(backend): belum ada tabel promo — sementara dari mock di services/promoService.ts.
export interface Promo {
  id: string;
  /** Judul besar popup, juga teks tab samping setelah popup ditutup */
  headline: string;
  description: string;
  /** Syarat singkat di bawah tombol; null = tidak ditampilkan */
  terms: string | null;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
}

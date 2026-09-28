// TODO(backend): belum ada tabel untuk profil toko — sementara dari mock di services/storeProfile.ts.
export interface StoreProfile {
  address: string;
  /** URL iframe Google Maps; null = tampilkan placeholder */
  mapsEmbedUrl: string | null;
  mapsLink: string;
  instagramUrl: string;
  tiktokUrl: string;
  /** Format internasional tanpa "+", mis. "6281234567890" */
  whatsappNumber: string;
}

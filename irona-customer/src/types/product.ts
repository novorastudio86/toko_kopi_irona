/** Produk menu (tabel products) */
export interface Product {
  id: string;
  name: string;
  categoryId: string;
  sellingPrice: number | null;
  photoUrl: string | null;
  // TODO(backend): kolom is_recommended belum ada di tabel products — perlu migration baru.
  isRecommended: boolean;
  availableOnline: boolean;
  isActive: boolean;
}

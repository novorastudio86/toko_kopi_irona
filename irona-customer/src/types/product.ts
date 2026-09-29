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
  // TODO(backend): belum ada kolom stok habis di tabel products; tentukan sumbernya (stok bahan / toggle admin).
  /** Tetap tampil di katalog tapi tidak bisa dipesan */
  isSoldOut: boolean;
  isActive: boolean;
}

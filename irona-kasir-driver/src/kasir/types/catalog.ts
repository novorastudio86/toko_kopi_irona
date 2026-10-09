/** Kategori di bar filter Menu kasir */
export interface MenuCategory {
  id: string;
  name: string;
  /** Kunci ikon dari Web Admin (mis. "coffee-cup"), boleh kosong */
  icon: string | null;
}

/** Produk yang bisa dijual di kasir */
export interface MenuProduct {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  categoryId: string;
  categoryName: string;
  price: number;
  /** Porsi yang masih bisa dibuat dari stok bahan baku (backend menyusul) */
  stockAvailable?: number;
  /** Bahan baku menipis → badge stok merah (backend menyusul) */
  stockLow?: boolean;
}

/** Isi keranjang: produk + jumlahnya */
export interface CartItem {
  product: MenuProduct;
  quantity: number;
  notes: string;
}
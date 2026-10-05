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
}

/** Isi keranjang: produk + jumlahnya */
export interface CartItem {
  product: MenuProduct;
  quantity: number;
  notes: string;
}
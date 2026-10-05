export type ProductFilters = {
  /** Tanggal lokal "YYYY-MM-DD" (akhir inklusif) */
  start: string;
  end: string;
  categoryId?: string | null;
  channel?: 'offline' | 'online' | null;
  orderType?: 'dine_in' | 'take_away' | 'online' | null;
};

export type ProductSalesRow = {
  productId: string;
  name: string;
  categoryName: string;
  quantity: number;
  sales: number;
  hpp: number;
  grossProfit: number;
  /** Ada item yang HPP-nya belum tercatat (resep belum lengkap saat transaksi) */
  missingCost: boolean;
};

export type ProductSalesReport = {
  products: ProductSalesRow[];
  /** Tren harian 5 produk terlaris */
  series: { date: string; productId: string; sales: number; quantity: number }[];
};

export type CategorySalesRow = {
  categoryId: string;
  name: string;
  productCount: number;
  quantity: number;
  sales: number;
  hpp: number;
  missingCost: boolean;
};

export type CategorySalesReport = {
  categories: CategorySalesRow[];
  series: { period: string; categoryId: string; sales: number; quantity: number }[];
};

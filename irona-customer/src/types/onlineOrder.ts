// Kolom mengikuti tabel online_order_settings & promotions (channel online) di irona-backend.

/** online_order_settings — skema ongkir & biaya layanan (diatur admin di Penjualan › Order Online) */
export interface DeliverySettings {
  feePerStep: number;
  stepKm: number;
  feePer100m: number;
  maxDistanceKm: number;
  serviceFee: number;
  /** Titik outlet, asal hitung jarak */
  storeLat: number;
  storeLng: number;
}

/** promotions channel online — potong harga produk atau ongkir */
export interface Voucher {
  id: string;
  name: string;
  /** otomatis = langsung terpakai saat checkout; manual = voucher yang dipilih/diklaim customer */
  promoType: 'otomatis' | 'manual';
  target: 'produk' | 'ongkir';
  kind: 'nominal' | 'persen';
  /** Rp untuk nominal, % untuk persen */
  value: number;
  minPurchase: number;
  memberOnly: boolean;
  /** Khusus ongkir; null = semua jarak */
  maxDistanceKm: number | null;
  /** Tanggal selesai promo (YYYY-MM-DD) */
  endDate: string | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Hasil Edge Function delivery-quote */
export interface DeliveryQuote {
  deliverable: boolean;
  /** null = di luar jangkauan */
  fee: number | null;
  /** Internal (syarat voucher ongkir); tidak ditampilkan ke pelanggan */
  distanceKm: number;
}

/**
 * Status pesanan online dari sisi pelanggan.
 * menunggu_pembayaran → diproses (settlement Midtrans) → diantar → selesai;
 * kedaluwarsa = QRIS lewat batas waktu tanpa dibayar.
 */
export type OrderStatus =
  'menunggu_pembayaran' | 'diproses' | 'diantar' | 'selesai' | 'kedaluwarsa' | 'dibatalkan';

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
}

export interface OnlineOrder {
  id: string;
  /** Kode pendek untuk ditunjukkan ke kasir/driver, mis. IRN-4821 */
  code: string;
  status: OrderStatus;
  createdAt: string;
  /** Batas bayar QRIS (ISO) */
  payExpiresAt: string;
  /** Gambar QRIS dari Midtrans (actions generate-qr-code); null kalau pembuatan QRIS gagal */
  qrUrl: string | null;
  customerName: string;
  phone: string;
  address: string | null;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  serviceFee: number;
  total: number;
}

/** Isi form checkout; harga & potongan final dihitung ulang server */
export interface NewOnlineOrder {
  customerName: string;
  phone: string;
  location: LatLng;
  address: string | null;
  driverNote: string;
  orderNote: string;
  voucherIds: string[];
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  serviceFee: number;
}

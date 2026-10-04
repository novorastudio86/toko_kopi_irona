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
  code: string;
  name: string;
  target: 'produk' | 'ongkir';
  kind: 'nominal' | 'persen';
  /** Rp untuk nominal, % untuk persen */
  value: number;
  minPurchase: number;
  memberOnly: boolean;
  /** Khusus ongkir; null = semua jarak */
  maxDistanceKm: number | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

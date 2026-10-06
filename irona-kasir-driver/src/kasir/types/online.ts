import type { LatLng } from '@/types/store';
import type { OrderReceipt } from './order';

/** Tahap pesanan online (lihat migration online_order_flow) */
export type OnlineStatus = 'masuk' | 'dibuat' | 'siap_diantar' | 'diantar' | 'selesai' | 'dibatalkan';

/** Jenis catatan di riwayat pesanan: perubahan status + driver ditugaskan / tiba di lokasi */
export type OnlineEventType = OnlineStatus | 'driver_ditugaskan' | 'driver_tiba';

export interface OnlineOrderEvent {
  status: OnlineEventType;
  notes: string | null;
  createdAt: string;
}

/** Pesanan online di halaman Online: data struk + kontak, alamat, driver, riwayat */
export interface OnlineOrder extends OrderReceipt {
  onlineStatus: OnlineStatus;
  customerPhone: string;
  customerEmail: string | null;
  address: string;
  addressNote: string | null;
  distanceKm: number | null;
  /** Titik antar dari pin pelanggan; null untuk pesanan lama tanpa titik */
  destination: LatLng | null;
  deliveryFee: number;
  serviceFee: number;
  /** Total yang dibayar pelanggan (produk + ongkir + biaya layanan) */
  grandTotal: number;
  driverId: string | null;
  driverName: string | null;
  receiptPrintCount: number;
  /** Urut dari yang paling lama */
  events: OnlineOrderEvent[];
}

/** Driver yang sudah absen masuk hari ini & belum pulang */
export interface AvailableDriver {
  employeeId: string;
  fullName: string;
  checkedInAt: string;
  /** Pesanan yang sedang dipegang (siap diantar / diantar) */
  activeDeliveries: number;
}

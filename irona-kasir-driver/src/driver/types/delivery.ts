import type { LatLng } from '@/types/store';

/** Tahap pesanan yang bisa terlihat oleh driver */
export type DeliveryStatus = 'dibuat' | 'siap_diantar' | 'diantar' | 'selesai' | 'dibatalkan';

export interface DeliveryItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string | null;
}

/** Pesanan online yang ditugaskan ke driver */
export interface DeliveryTask {
  transactionId: string;
  transactionNumber: string;
  orderedAt: string;
  status: DeliveryStatus;
  customerName: string;
  customerPhone: string;
  address: string;
  addressNote: string | null;
  distanceKm: number | null;
  /** Titik antar dari pin pelanggan; null untuk pesanan lama tanpa titik */
  destination: LatLng | null;
  items: DeliveryItem[];
  /** Total yang sudah dibayar pelanggan (QRIS) */
  grandTotal: number;
  /** Waktu diantar / selesai dari riwayat status */
  pickedUpAt: string | null;
  /** Driver menandai sudah sampai di lokasi pelanggan */
  arrivedAt: string | null;
  completedAt: string | null;
}

export interface DutyStatus {
  onDuty: boolean;
  checkIn: string | null;
  checkOut: string | null;
}

/** Menu di navigasi bawah Driver App */
export type DriverTab = 'histori' | 'antaran' | 'profil';

export type Channel = 'offline' | 'online';
export type PromoType = 'otomatis' | 'manual';
/** produk = potong harga produk; ongkir = potong ongkir (khusus Online) */
export type DiscountTarget = 'produk' | 'ongkir';
export type DiscountKind = 'nominal' | 'persen';
export type TargetCustomer = 'semua' | 'member';
export type MinPurchaseType = 'qty' | 'nominal';
/** kedaluwarsa = otomatis setelah tanggal selesai lewat, terkunci permanen */
export type PromotionStatus = 'aktif' | 'nonaktif' | 'kedaluwarsa';

export interface PromotionInput {
  name: string;
  description: string | null;
  channel: Channel;
  discountTarget: DiscountTarget;
  discountKind: DiscountKind;
  /** Rp untuk nominal, % untuk persen */
  discountValue: number;
  /** Khusus sasaran ongkir; null = semua jarak */
  maxDistanceKm: number | null;
  appliesToAllProducts: boolean;
  productIds: string[];
  promoType: PromoType;
  targetCustomer: TargetCustomer;
  minPurchaseType: MinPurchaseType;
  minPurchaseValue: number;
  /** Berlaku Kelipatan */
  isRepeatable: boolean;
  /** Khusus Online */
  maxOneClaimPerCustomer: boolean;
  /** Khusus Offline */
  appliesToTakeAway: boolean;
  startDate: string;
  endDate: string;
  /** 0=Minggu..6=Sabtu, kosong = setiap hari */
  validDays: number[];
  validStartTime: string | null;
  validEndTime: string | null;
}

export interface Promotion extends PromotionInput {
  id: string;
  isActive: boolean;
  status: PromotionStatus;
  /** Periode belum dimulai */
  isUpcoming: boolean;
  productNames: string[];
  /** Sudah dipakai di transaksi */
  usedCount: number;
  claimCount: number;
}

export interface PromotionHistoryEntry {
  id: string;
  action: 'dibuat' | 'diubah' | 'diaktifkan' | 'dinonaktifkan' | 'dihapus';
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  changedByName: string | null;
  createdAt: string;
}

export interface PromotionClaim {
  id: string;
  customerName: string;
  phoneNumber: string;
  claimedAt: string;
  usedAt: string | null;
}

export interface ProductOption {
  id: string;
  name: string;
  categoryName: string;
  sellingPrice: number;
  isActive: boolean;
}

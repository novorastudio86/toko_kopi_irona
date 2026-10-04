// Kolom mengikuti tabel Supabase (irona-backend): customers, reward_overview, reward_claim_overview,
// point_earning_tiers, point_transactions, transactions.

/** customers — member yang sedang login */
export interface Member {
  id: string;
  /** Dipakai untuk masuk (kode via email); tidak bisa diubah sendiri oleh member */
  email: string;
  name: string;
  phoneNumber: string;
  pointsBalance: number;
}

/** reward_overview (is_active) — produk gratis yang bisa ditukar poin */
export interface Reward {
  id: string;
  name: string;
  productName: string;
  pointsRequired: number;
  /** stok − kode yang masih menunggu ditukar; 0 = tidak bisa diklaim */
  availableStock: number;
  photoUrl: string | null;
}

/** reward_claim_overview status 'menunggu' — kode yang ditunjukkan ke kasir */
export interface RewardClaim {
  id: string;
  code: string;
  rewardName: string;
  expiresAt: string;
}

/** point_earning_tiers — kelipatan belanja → poin */
export interface PointTier {
  minAmount: number;
  points: number;
}

export type PointType = 'earn' | 'redeem' | 'redeem_cancel' | 'adjust' | 'refund_reversal';

/** point_transactions milik member */
export interface PointHistory {
  id: string;
  date: string;
  type: PointType;
  change: number;
  notes: string | null;
  transactionNumber: string | null;
}

export type TransactionStatus = 'selesai' | 'refund_sebagian' | 'refund_penuh' | 'dibatalkan';
export type OrderType = 'dine_in' | 'take_away' | 'online';

/** transactions milik member + poin yang didapat (point_transactions tipe earn) */
export interface MemberTransaction {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  orderType: OrderType;
  status: TransactionStatus;
  totalAmount: number;
  pointsEarned: number;
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
}

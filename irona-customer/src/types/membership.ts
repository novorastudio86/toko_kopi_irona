// Kolom mengikuti tabel Supabase (irona-backend): customers, rewards, point_earning_tiers, transactions.

/** customers — member yang sedang login */
export interface Member {
  id: string;
  name: string;
  phoneNumber: string;
  pointsBalance: number;
}

/** rewards — hadiah yang bisa ditukar poin */
export interface Reward {
  id: string;
  name: string;
  /** Label jenis reward di kartu, mis. "Potongan Produk" */
  category: string;
  pointsRequired: number;
  photoUrl: string | null;
}

/** reward_claims — kode tukar yang ditunjukkan ke kasir */
export interface RewardClaim {
  code: string;
  expiresAt: string;
}

/** point_earning_tiers — kelipatan belanja → poin */
export interface PointTier {
  minAmount: number;
  points: number;
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

export interface TransactionPage {
  items: MemberTransaction[];
  hasMore: boolean;
}

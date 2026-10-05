export interface PointTier {
  minAmount: number;
  points: number;
}

export interface PointRules {
  tiers: PointTier[];
  /** Sisa ≥ batas ini dihitung 1 tingkat terkecil lagi; 0 = tanpa pembulatan */
  roundingThreshold: number;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface Reward {
  id: string;
  name: string;
  productId: string;
  productName: string;
  pointsRequired: number;
  /** Sisa stok fisik — berkurang saat kode ditukar di kasir */
  stock: number;
  /** Stok − kode yang masih menunggu ditukar (yang dicadangkan) */
  availableStock: number;
  notes: string | null;
  isActive: boolean;
  claimCount: number;
  redeemedCount: number;
  /** Kode yang masih menunggu ditukar (mencadangkan stok) */
  pendingCount: number;
}

export interface RewardInput {
  name: string;
  productId: string;
  pointsRequired: number;
  stock: number;
  notes: string | null;
}

export type ClaimStatus = 'menunggu' | 'sudah_ditukar' | 'hangus' | 'dibatalkan';

export interface RewardClaim {
  id: string;
  customerName: string;
  phoneNumber: string;
  code: string;
  pointsUsed: number;
  claimedAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  status: ClaimStatus;
}

/** Baris Laporan Redeem Point (semua reward) */
export interface RedeemReportRow extends RewardClaim {
  rewardName: string;
}

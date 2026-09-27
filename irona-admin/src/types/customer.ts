export interface Customer {
  id: string;
  name: string;
  phoneNumber: string;
  pointsBalance: number;
  isActive: boolean;
  registeredAt: string;
  /** Sudah punya akun login Web Customer */
  hasAccount: boolean;
  /** Transaksi resmi (bukan dibatalkan / refund penuh) */
  totalTransactions: number;
  /** Nilai produk setelah diskon, dikurangi refund; tanpa ongkir/biaya layanan */
  totalSpent: number;
  lastTransactionAt: string | null;
  /** Semua transaksi termasuk yang dibatalkan — dipakai untuk aturan Hapus */
  allTransactions: number;
}

export type TransactionStatus = 'selesai' | 'refund_sebagian' | 'refund_penuh' | 'dibatalkan';

export interface CustomerPurchase {
  id: string;
  transactionNumber: string;
  date: string;
  orderType: 'dine_in' | 'take_away' | 'online';
  status: TransactionStatus;
  /** Nilai produk setelah diskon */
  amount: number;
  refundedAmount: number;
  items: { name: string; quantity: number; lineTotal: number }[];
}

export type PointType = 'earn' | 'redeem' | 'redeem_cancel' | 'adjust' | 'refund_reversal';

export interface PointHistory {
  id: string;
  date: string;
  type: PointType;
  change: number;
  balanceAfter: number | null;
  notes: string | null;
  transactionNumber: string | null;
  createdByName: string | null;
}

export interface StatusHistory {
  id: string;
  date: string;
  isActive: boolean;
  reason: string;
  changedByName: string | null;
}

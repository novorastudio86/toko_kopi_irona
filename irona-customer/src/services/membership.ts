import icedLattePhoto from '@/assets/home/product-iced-latte.webp';
import type {
  Member,
  MemberTransaction,
  PointTier,
  Reward,
  RewardClaim,
  TransactionPage,
} from '@/types/membership';
import { mockDelay } from './mockDelay';

// TODO(backend): semua fungsi di file ini masih dummy. Ganti isinya dengan query Supabase,
// map snake_case → camelCase di sini supaya komponen tidak perlu berubah.

const MOCK_MEMBER: Member = {
  id: 'cust-dummy-1',
  name: 'Kora Friend',
  phoneNumber: '081200000000',
  pointsBalance: 12,
};

const MOCK_REWARDS: Reward[] = [
  {
    id: 'reward-1',
    name: 'Gratis 1 Americano',
    category: 'Potongan Produk',
    pointsRequired: 8,
    photoUrl: null,
  },
  {
    id: 'reward-2',
    name: 'Gratis 1 Es Kopi Susu Irona',
    category: 'Potongan Produk',
    pointsRequired: 12,
    photoUrl: icedLattePhoto,
  },
  {
    id: 'reward-3',
    name: 'Gratis Kentang Goreng',
    category: 'Potongan Produk',
    pointsRequired: 15,
    photoUrl: null,
  },
];

const MOCK_TIERS: PointTier[] = [
  { minAmount: 10000, points: 1 },
  { minAmount: 25000, points: 3 },
  { minAmount: 50000, points: 6 },
];

const MOCK_TRANSACTIONS: MemberTransaction[] = [
  ['online', 'selesai', 54000, 6],
  ['dine_in', 'selesai', 38000, 3],
  ['take_away', 'selesai', 18000, 1],
  ['online', 'refund_penuh', 25000, 0],
  ['dine_in', 'selesai', 72000, 7],
  ['online', 'selesai', 20000, 1],
  ['take_away', 'dibatalkan', 15000, 0],
].map(([orderType, status, totalAmount, pointsEarned], i) => ({
  id: `trx-${i + 1}`,
  transactionNumber: `IRN-2609${String(30 - i).padStart(2, '0')}${String(i + 1).padStart(4, '0')}`,
  transactionDate: new Date(2026, 8, 30 - i * 3, 14 - i, 30).toISOString(),
  orderType,
  status,
  totalAmount,
  pointsEarned,
})) as MemberTransaction[];

/**
 * Login member. Sementara langsung mengembalikan member dummy.
 * TODO(backend): ganti dengan Supabase Auth (OTP WhatsApp / Google), lalu ambil baris customers
 * lewat customers.auth_user_id.
 */
export async function signInMember(): Promise<Member> {
  return mockDelay(MOCK_MEMBER);
}

/** Reward aktif (rewards.is_active) urut poin termurah */
export async function fetchActiveRewards(): Promise<Reward[]> {
  return mockDelay(MOCK_REWARDS);
}

/** Aturan kelipatan belanja → poin (point_earning_tiers) */
export async function fetchPointTiers(): Promise<PointTier[]> {
  return mockDelay(MOCK_TIERS);
}

/** Riwayat transaksi member, terbaru dulu */
export async function fetchMemberTransactions(
  memberId: string,
  offset: number,
  limit: number
): Promise<TransactionPage> {
  void memberId; // TODO(backend): filter transactions.customer_id = memberId
  return mockDelay({
    items: MOCK_TRANSACTIONS.slice(offset, offset + limit),
    hasMore: offset + limit < MOCK_TRANSACTIONS.length,
  });
}

/**
 * Tukar poin dengan reward → kode untuk ditunjukkan ke kasir.
 * TODO(backend): panggil RPC klaim reward (buat reward_claims + potong poin) dan kembalikan saldo baru.
 */
export async function redeemReward(memberId: string, rewardId: string): Promise<RewardClaim> {
  void memberId;
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return mockDelay({
    code: `KORA-${rewardId.slice(-1)}${Date.now() % 10000}`,
    expiresAt: expires.toISOString(),
  });
}

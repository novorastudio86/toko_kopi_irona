import icedLattePhoto from '@/assets/home/product-iced-latte.webp';
import type {
  Member,
  MemberTransaction,
  Page,
  PointHistory,
  PointTier,
  Reward,
  RewardClaim,
} from '@/types/membership';
import { mockDelay } from './mockDelay';

// TODO(backend): semua fungsi di file ini masih dummy. Ganti isinya dengan query Supabase,
// map snake_case → camelCase di sini supaya komponen tidak perlu berubah.

const MOCK_MEMBER: Member = {
  id: 'cust-dummy-1',
  email: 'kora@irona.id',
  name: 'Kora Friend',
  phoneNumber: '081234567890',
  pointsBalance: 18,
};

const MOCK_REWARDS: Reward[] = [
  {
    id: 'reward-1',
    name: 'Gratis 1 Americano',
    productName: 'Americano',
    pointsRequired: 8,
    availableStock: 20,
    photoUrl: null,
  },
  {
    id: 'reward-2',
    name: 'Gratis Kentang Goreng',
    productName: 'Kentang Goreng',
    pointsRequired: 15,
    availableStock: 0,
    photoUrl: null,
  },
  {
    id: 'reward-3',
    name: 'Gratis 1 Es Kopi Susu Irona',
    productName: 'Es Kopi Susu Irona',
    pointsRequired: 25,
    availableStock: 12,
    photoUrl: icedLattePhoto,
  },
  {
    id: 'reward-4',
    name: 'Paket Kopi + Roti Bakar',
    productName: 'Es Kopi Susu Irona & Roti Bakar',
    pointsRequired: 40,
    availableStock: 5,
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
  ['dine_in', 'selesai', 38000, 4],
  ['take_away', 'selesai', 18000, 1],
  ['online', 'refund_penuh', 25000, 0],
  ['dine_in', 'selesai', 72000, 7],
  ['online', 'selesai', 20000, 2],
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

const MOCK_POINTS: PointHistory[] = [
  [MOCK_TRANSACTIONS[0], 'earn', 6, null],
  [null, 'redeem', -8, 'Klaim reward: Gratis 1 Americano'],
  [MOCK_TRANSACTIONS[1], 'earn', 4, null],
  [MOCK_TRANSACTIONS[2], 'earn', 1, null],
  [MOCK_TRANSACTIONS[3], 'refund_reversal', -3, 'Pesanan direfund'],
  [MOCK_TRANSACTIONS[4], 'earn', 7, null],
  [null, 'adjust', 2, 'Bonus member baru'],
].map(([trx, type, change, notes], i) => ({
  id: `pt-${i + 1}`,
  date:
    (trx as MemberTransaction | null)?.transactionDate ??
    new Date(2026, 8, 29 - i * 3).toISOString(),
  type,
  change,
  notes,
  transactionNumber: (trx as MemberTransaction | null)?.transactionNumber ?? null,
})) as PointHistory[];

// ponytail: klaim dummy disimpan di memori modul supaya kode baru tetap muncul setelah pindah halaman
const MOCK_CLAIMS: RewardClaim[] = [
  {
    id: 'claim-1',
    code: 'K7M2QXPA',
    rewardName: 'Gratis 1 Americano',
    expiresAt: new Date(Date.now() + 21 * 60 * 60 * 1000).toISOString(),
  },
];

function page<T>(items: T[], offset: number, limit: number): Promise<Page<T>> {
  return mockDelay({
    items: items.slice(offset, offset + limit),
    hasMore: offset + limit < items.length,
  });
}

/** Akun demo yang sudah terdaftar di mock */
export const DEMO_MEMBER_EMAIL = MOCK_MEMBER.email;
export const DEMO_MEMBER_PASSWORD = 'kora1234';

// ponytail: akun & password dummy di memori modul, member baru hilang saat refresh; ganti dengan Supabase Auth + tabel customers
const MOCK_ACCOUNTS: Member[] = [MOCK_MEMBER];
const MOCK_PASSWORDS = new Map([[MOCK_MEMBER.email, DEMO_MEMBER_PASSWORD]]);

/** Gagal yang pesannya aman ditampilkan ke pengguna */
export class MemberAuthError extends Error {}

export interface SignUpInput {
  name: string;
  phoneNumber: string;
  email: string;
  password: string;
}

const normEmail = (email: string) => email.trim().toLowerCase();
const findAccount = (email: string) => MOCK_ACCOUNTS.find((m) => m.email === normEmail(email));

/**
 * Masuk pakai email + password, tanpa email notifikasi.
 * TODO(backend): supabase.auth.signInWithPassword({ email, password }), lalu ambil customers lewat
 * auth_user_id. Tolak kalau customers.is_active = false.
 */
export async function signInMember(email: string, password: string): Promise<Member> {
  const account = findAccount(email);
  if (!account || MOCK_PASSWORDS.get(account.email) !== password) {
    await mockDelay(undefined);
    throw new MemberAuthError('Email atau password salah.');
  }
  return mockDelay(account);
}

/**
 * Daftar → kirim kode verifikasi 6 angka ke email (email notifikasi #1).
 * TODO(backend): supabase.auth.signUp({ email, password, options: { data: { name, phone } } }).
 * Perlu [auth.email] enable_confirmations = true & template "Confirm signup" pakai {{ .Token }}.
 */
export async function signUpMember(data: SignUpInput): Promise<void> {
  if (findAccount(data.email)) {
    await mockDelay(undefined);
    throw new MemberAuthError('Email ini sudah terdaftar. Silakan masuk.');
  }
  return mockDelay(undefined);
}

/**
 * Cek kode daftar lalu buat member. Demo: kode 6 angka apa saja diterima.
 * TODO(backend): supabase.auth.verifyOtp({ email, token: code, type: 'email' }), lalu insert
 * customers (auth_user_id, name, phone) — atau lewat trigger dari user metadata.
 */
export async function verifySignUpCode(data: SignUpInput, code: string): Promise<Member> {
  void code;
  const member: Member = {
    id: `cust-${Date.now()}`,
    email: normEmail(data.email),
    name: data.name,
    phoneNumber: data.phoneNumber,
    pointsBalance: 0,
  };
  MOCK_ACCOUNTS.push(member);
  MOCK_PASSWORDS.set(member.email, data.password);
  return mockDelay(member);
}

/**
 * Lupa password → kirim kode reset 6 angka ke email (email notifikasi #2).
 * Tidak memberi tahu apakah email terdaftar, supaya daftar email member tidak bisa ditebak.
 * TODO(backend): supabase.auth.resetPasswordForEmail(email), template "Reset password" pakai {{ .Token }}.
 */
export async function sendResetCode(email: string): Promise<void> {
  void email;
  return mockDelay(undefined);
}

/**
 * Cek kode reset, simpan password baru, langsung masuk. Demo: kode 6 angka apa saja diterima.
 * TODO(backend): supabase.auth.verifyOtp({ email, token: code, type: 'recovery' }), lalu
 * supabase.auth.updateUser({ password }) dan ambil customers.
 */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  password: string
): Promise<Member> {
  void code;
  const account = findAccount(email);
  if (!account) {
    await mockDelay(undefined);
    throw new MemberAuthError('Kode salah atau sudah kedaluwarsa.');
  }
  MOCK_PASSWORDS.set(account.email, password);
  return mockDelay(account);
}

/** Ubah nama & nomor HP. Email tidak bisa diubah. TODO(backend): update customers (RLS self) */
export async function updateMemberProfile(
  memberId: string,
  data: Pick<Member, 'name' | 'phoneNumber'>
): Promise<void> {
  const account = MOCK_ACCOUNTS.find((m) => m.id === memberId);
  if (account) Object.assign(account, data);
  return mockDelay(undefined);
}

/** Riwayat & kode dummy hanya milik akun demo; member baru mulai dari kosong */
const isDemo = (memberId: string) => memberId === MOCK_MEMBER.id;

/** Reward aktif (reward_overview.is_active) urut poin termurah */
export async function fetchActiveRewards(): Promise<Reward[]> {
  return mockDelay(MOCK_REWARDS);
}

/** Aturan kelipatan belanja → poin (point_earning_tiers), urut nominal terkecil */
export async function fetchPointTiers(): Promise<PointTier[]> {
  return mockDelay(MOCK_TIERS);
}

/** Kode reward yang belum ditukar & belum hangus (reward_claim_overview.status = 'menunggu') */
export async function fetchActiveClaims(memberId: string): Promise<RewardClaim[]> {
  // TODO(backend): RLS reward_claims_self_select sudah membatasi ke member ini
  const claims = isDemo(memberId) ? MOCK_CLAIMS : [];
  return mockDelay(claims.filter((c) => new Date(c.expiresAt).getTime() > Date.now()));
}

/** Riwayat pesanan member, terbaru dulu */
export async function fetchMemberTransactions(
  memberId: string,
  offset: number,
  limit: number
): Promise<Page<MemberTransaction>> {
  // TODO(backend): filter transactions.customer_id = memberId
  return page(isDemo(memberId) ? MOCK_TRANSACTIONS : [], offset, limit);
}

/** Riwayat poin masuk/keluar (point_transactions), terbaru dulu */
export async function fetchPointHistory(
  memberId: string,
  offset: number,
  limit: number
): Promise<Page<PointHistory>> {
  // TODO(backend): filter point_transactions.customer_id = memberId
  return page(isDemo(memberId) ? MOCK_POINTS : [], offset, limit);
}

/**
 * Tukar poin dengan reward → kode 8 karakter untuk ditunjukkan ke kasir, berlaku 1 hari.
 * TODO(backend): supabase.rpc('claim_reward', { p_reward_id }) — RPC sudah memotong poin,
 * mencatat point_transactions 'redeem', dan menolak kalau stok habis / poin kurang.
 */
export async function redeemReward(memberId: string, reward: Reward): Promise<RewardClaim> {
  void memberId;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * 32)]).join('');
  const claim: RewardClaim = {
    id: `claim-${Date.now()}`,
    code,
    rewardName: reward.name,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  MOCK_CLAIMS.unshift(claim);
  MOCK_POINTS.unshift({
    id: `pt-${Date.now()}`,
    date: new Date().toISOString(),
    type: 'redeem',
    change: -reward.pointsRequired,
    notes: `Klaim reward: ${reward.name}`,
    transactionNumber: null,
  });
  return mockDelay(claim);
}

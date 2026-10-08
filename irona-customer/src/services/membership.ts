import { AuthError } from '@supabase/supabase-js';
import type {
  Member,
  MemberTransaction,
  OrderType,
  Page,
  PointHistory,
  PointTier,
  PointType,
  Reward,
  RewardClaim,
  TransactionStatus,
} from '@/types/membership';
import { supabase } from './supabase';

/** Gagal yang pesannya aman ditampilkan ke pengguna */
export class MemberAuthError extends Error {
  /** email_not_confirmed = sudah daftar tapi belum isi kode → arahkan ke langkah verifikasi */
  readonly code?: 'email_not_confirmed';
  constructor(message: string, code?: 'email_not_confirmed') {
    super(message);
    this.code = code;
  }
}

export interface SignUpInput {
  name: string;
  phoneNumber: string;
  email: string;
  password: string;
}

const normEmail = (email: string) => email.trim().toLowerCase();

/** Pesan Supabase Auth (bahasa Inggris) → pesan untuk member */
function authError(err: AuthError): MemberAuthError {
  switch (err.code) {
    case 'invalid_credentials':
      return new MemberAuthError('Email atau password salah.');
    case 'email_not_confirmed':
      return new MemberAuthError(
        'Email belum diverifikasi. Kode baru sudah kami kirim ke email kamu.',
        'email_not_confirmed'
      );
    case 'user_already_exists':
    case 'email_exists':
      return new MemberAuthError('Email ini sudah terdaftar. Silakan masuk.');
    case 'otp_expired':
      return new MemberAuthError('Kode salah atau sudah kedaluwarsa.');
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new MemberAuthError('Terlalu sering meminta kode. Tunggu 1 menit lalu coba lagi.');
    case 'weak_password':
      return new MemberAuthError('Password terlalu lemah, coba yang lebih panjang.');
    case 'same_password':
      return new MemberAuthError('Password baru tidak boleh sama dengan password lama.');
    case 'email_address_invalid':
      return new MemberAuthError('Alamat email tidak valid.');
    case 'unexpected_failure':
      // Saat daftar/kirim ulang/reset: biasanya SMTP menolak (cek log container supabase_auth)
      return new MemberAuthError('Email kode gagal dikirim. Coba lagi sebentar.');
  }
  return new MemberAuthError('Ada gangguan, coba lagi sebentar.');
}

interface CustomerRow {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  points_balance: number;
  is_active: boolean;
}

/**
 * Data member dari customers milik sesi yang sedang login (RLS customers_self_select).
 * Bukan member (mis. akun karyawan) / nonaktif = sesi ditutup lagi.
 */
export async function fetchCurrentMember(): Promise<Member | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone_number, email, points_balance, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle<CustomerRow>();
  if (error) throw error;
  if (!data) {
    await supabase.auth.signOut();
    throw new MemberAuthError('Akun ini bukan akun member.');
  }
  if (!data.is_active) {
    await supabase.auth.signOut();
    throw new MemberAuthError('Akun member ini dinonaktifkan. Hubungi kasir Toko Kopi Irona.');
  }
  return {
    id: data.id,
    email: data.email ?? user.email ?? '',
    name: data.name,
    phoneNumber: data.phone_number,
    pointsBalance: data.points_balance,
  };
}

async function requireMember(): Promise<Member> {
  const member = await fetchCurrentMember();
  if (!member) throw new MemberAuthError('Sesi berakhir, silakan masuk lagi.');
  return member;
}

/** Masuk pakai email + password, tanpa email notifikasi */
export async function signInMember(email: string, password: string): Promise<Member> {
  const { error } = await supabase.auth.signInWithPassword({ email: normEmail(email), password });
  if (error) {
    // Belum verifikasi → kirim ulang kode supaya bisa langsung lanjut ke langkah kode
    if (error.code === 'email_not_confirmed') await resendSignUpCode(email).catch(() => {});
    throw authError(error);
  }
  return requireMember();
}

/**
 * Daftar → kirim kode verifikasi 6 angka ke email (template confirmation.html).
 * customers baru dibuat trigger handle_member_confirmed setelah kode benar; nomor HP yang
 * sudah terdaftar lewat kasir (belum punya akun) otomatis disambungkan, poinnya ikut.
 */
export async function signUpMember(data: SignUpInput): Promise<void> {
  const { data: phoneStatus, error: checkError } = await supabase.rpc('member_signup_check', {
    p_phone: data.phoneNumber,
  });
  if (checkError) throw checkError;
  if (phoneStatus === 'taken')
    throw new MemberAuthError('Nomor WhatsApp ini sudah dipakai akun member lain. Silakan masuk.');

  const { data: result, error } = await supabase.auth.signUp({
    email: normEmail(data.email),
    password: data.password,
    options: { data: { account_type: 'member', name: data.name, phone: data.phoneNumber } },
  });
  if (error) throw authError(error);
  // Email sudah terverifikasi sebelumnya: Supabase tidak memberi error, identities-nya kosong
  if (result.user && result.user.identities?.length === 0)
    throw new MemberAuthError('Email ini sudah terdaftar. Silakan masuk.');
}

/** Kirim ulang kode verifikasi daftar */
export async function resendSignUpCode(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: normEmail(email) });
  if (error) throw authError(error);
}

/** Cek kode daftar → sesi aktif & customers sudah dibuat/disambungkan trigger */
export async function verifySignUpCode(email: string, code: string): Promise<Member> {
  const { error } = await supabase.auth.verifyOtp({
    email: normEmail(email),
    token: code,
    type: 'email',
  });
  // Trigger handle_member_confirmed menolak: nomor HP diambil member lain di antara daftar & verifikasi
  if (error?.code === 'unexpected_failure')
    throw new MemberAuthError(
      'Nomor HP ini sudah dipakai akun member lain. Daftar ulang dengan nomor lain.'
    );
  if (error) throw authError(error);
  return requireMember();
}

/**
 * Lupa password → kirim kode reset 6 angka ke email (template recovery.html).
 * Tidak memberi tahu apakah email terdaftar, supaya daftar email member tidak bisa ditebak.
 */
export async function sendResetCode(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(normEmail(email));
  if (error) throw authError(error);
}

/** Cek kode reset, simpan password baru, langsung masuk */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  password: string
): Promise<Member> {
  const { error } = await supabase.auth.verifyOtp({
    email: normEmail(email),
    token: code,
    type: 'recovery',
  });
  if (error) throw authError(error);
  // Cek member dulu supaya password akun karyawan tidak ikut terganti dari Web Customer
  const member = await requireMember();
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) throw authError(updateError);
  return member;
}

export async function signOutMember(): Promise<void> {
  await supabase.auth.signOut();
}

/** Ubah nama & nomor HP. Email tidak bisa diubah. */
export async function updateMemberProfile(
  data: Pick<Member, 'name' | 'phoneNumber'>
): Promise<void> {
  const { error } = await supabase.rpc('update_my_member_profile', {
    p_name: data.name,
    p_phone: data.phoneNumber,
  });
  // Pesan dari RPC sudah bahasa Indonesia (nama kosong, nomor dipakai member lain, ...)
  if (error) throw new MemberAuthError(error.message);
}

/** Reward aktif urut poin termurah (RPC online_member_rewards, bisa dilihat tanpa login) */
export async function fetchActiveRewards(): Promise<Reward[]> {
  const { data, error } = await supabase.rpc('online_member_rewards');
  if (error) throw error;
  return (
    data as {
      id: string;
      name: string;
      product_name: string;
      points_required: number;
      available_stock: number;
      photo_url: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    productName: r.product_name,
    pointsRequired: r.points_required,
    availableStock: r.available_stock,
    photoUrl: r.photo_url,
  }));
}

/** Aturan kelipatan belanja → poin (RPC online_point_tiers), urut nominal terkecil */
export async function fetchPointTiers(): Promise<PointTier[]> {
  const { data, error } = await supabase.rpc('online_point_tiers');
  if (error) throw error;
  return (data as { min_amount: number; points: number }[]).map((t) => ({
    minAmount: Number(t.min_amount),
    points: t.points,
  }));
}

/** Kode reward yang belum ditukar & belum hangus (RLS reward_claims_self_select) */
export async function fetchActiveClaims(memberId: string): Promise<RewardClaim[]> {
  const { data, error } = await supabase
    .from('reward_claim_overview')
    .select('id, code, expires_at, rewards(name)')
    .eq('customer_id', memberId)
    .eq('status', 'menunggu')
    .order('claimed_at', { ascending: false });
  if (error) throw error;
  return (
    data as unknown as {
      id: string;
      code: string;
      expires_at: string;
      rewards: { name: string } | null;
    }[]
  ).map((c) => ({
    id: c.id,
    code: c.code,
    rewardName: c.rewards?.name ?? 'Reward',
    expiresAt: c.expires_at,
  }));
}

/** Riwayat pesanan member + poin yang didapat, terbaru dulu (RLS transactions_self_select) */
export async function fetchMemberTransactions(
  memberId: string,
  offset: number,
  limit: number
): Promise<Page<MemberTransaction>> {
  // Ambil 1 baris lebih untuk tahu masih ada halaman berikutnya
  const { data, error } = await supabase
    .from('transactions')
    .select('id, transaction_number, transaction_date, order_type, status, total_amount')
    .eq('customer_id', memberId)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit);
  if (error) throw error;
  const rows = data.slice(0, limit);

  const earned = new Map<string, number>();
  if (rows.length) {
    const { data: points, error: pointsError } = await supabase
      .from('point_transactions')
      .select('transaction_id, points_change')
      .eq('customer_id', memberId)
      .eq('point_type', 'earn')
      .in(
        'transaction_id',
        rows.map((r) => r.id)
      );
    if (pointsError) throw pointsError;
    for (const p of points)
      earned.set(p.transaction_id, (earned.get(p.transaction_id) ?? 0) + p.points_change);
  }

  return {
    items: rows.map((r) => ({
      id: r.id,
      transactionNumber: r.transaction_number,
      transactionDate: r.transaction_date,
      orderType: r.order_type as OrderType,
      status: r.status as TransactionStatus,
      totalAmount: Number(r.total_amount),
      pointsEarned: earned.get(r.id) ?? 0,
    })),
    hasMore: data.length > limit,
  };
}

/** Riwayat poin masuk/keluar (point_transactions, RLS self), terbaru dulu */
export async function fetchPointHistory(
  memberId: string,
  offset: number,
  limit: number
): Promise<Page<PointHistory>> {
  const { data, error } = await supabase
    .from('point_transactions')
    .select('id, created_at, point_type, points_change, notes, transactions(transaction_number)')
    .eq('customer_id', memberId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit);
  if (error) throw error;
  const rows = data as unknown as {
    id: string;
    created_at: string;
    point_type: PointType;
    points_change: number;
    notes: string | null;
    transactions: { transaction_number: string } | null;
  }[];
  return {
    items: rows.slice(0, limit).map((p) => ({
      id: p.id,
      date: p.created_at,
      type: p.point_type,
      change: p.points_change,
      notes: p.notes,
      transactionNumber: p.transactions?.transaction_number ?? null,
    })),
    hasMore: rows.length > limit,
  };
}

/**
 * Tukar poin dengan reward → kode 8 karakter untuk ditunjukkan ke kasir, berlaku 1 hari.
 * RPC claim_reward memotong poin, mencatat point_transactions 'redeem', dan menolak kalau
 * stok habis / poin kurang.
 */
export async function redeemReward(reward: Reward): Promise<RewardClaim> {
  const { data, error } = await supabase.rpc('claim_reward', { p_reward_id: reward.id });
  if (error) throw new MemberAuthError(error.message);
  const claim = (data as { code: string; expires_at: string }[])[0];
  return { id: claim.code, code: claim.code, rewardName: reward.name, expiresAt: claim.expires_at };
}

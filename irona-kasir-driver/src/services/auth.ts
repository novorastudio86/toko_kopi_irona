import { supabase } from './supabase';
import type { OwnerProfile } from '@/types/auth';

/** Username karyawan disimpan di Supabase Auth sebagai email username@irona.internal */
function toEmail(username: string): string {
  return `${username.trim().toLowerCase()}@irona.internal`;
}

interface EmployeeRow {
  id: string;
  full_name: string;
  username: string;
  is_active: boolean;
  roles: { type: string } | null;
}

/** Profil Owner dari tabel employees; null kalau akun bukan Admin/Owner yang aktif */
async function fetchOwnerProfile(userId: string): Promise<OwnerProfile | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name, username, is_active, roles(type)')
    .eq('id', userId)
    .maybeSingle<EmployeeRow>();

  if (error) throw new Error('Tidak bisa terhubung ke server. Periksa koneksi internet.');
  if (!data || !data.is_active || data.roles?.type !== 'admin') return null;
  return { id: data.id, fullName: data.full_name, username: data.username };
}

/** Login perangkat dengan akun Owner/Admin (sama seperti login Web Admin) */
export async function signInOwner(username: string, password: string): Promise<OwnerProfile> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toEmail(username),
    password,
  });
  if (error || !data.user) throw new Error('Username atau password salah.');

  const owner = await fetchOwnerProfile(data.user.id);
  if (!owner) {
    await supabase.auth.signOut();
    throw new Error('Perangkat hanya bisa dibuka dengan akun Owner/Admin yang aktif.');
  }
  return owner;
}

/** Owner yang tersimpan di perangkat (login sebelumnya), atau null kalau belum login */
export async function getSignedInOwner(): Promise<OwnerProfile | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;

  const owner = await fetchOwnerProfile(userId);
  // Akun sudah dinonaktifkan / bukan admin lagi → keluarkan dari perangkat
  if (!owner) await supabase.auth.signOut();
  return owner;
}

/** Keluar perangkat: berikutnya harus login Owner lagi */
export async function signOutDevice(): Promise<void> {
  await supabase.auth.signOut();
}
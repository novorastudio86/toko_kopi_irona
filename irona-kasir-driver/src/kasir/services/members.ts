import { supabase } from '@/services/supabase';
import type { Member } from '@/kasir/types/order';

interface MemberRow {
  id: string;
  name: string;
  phone_number: string;
  points_balance: number;
}

/** "+62 812-3456" / "62812..." / "0812..." → "0812..." (format di database) */
function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  return digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
}

/** Isian pelanggan berupa angka (No HP) → cari member; huruf/kosong → non-member */
export function isPhoneQuery(input: string): boolean {
  return /^[\d+\s-]*$/.test(input.trim());
}

/** Member aktif yang No HP-nya diawali `phone` (maks 8), untuk daftar saran */
export async function searchMembersByPhone(phone: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone_number, points_balance')
    .like('phone_number', `${normalizePhone(phone)}%`)
    .eq('is_active', true)
    .order('name')
    .limit(8)
    .returns<MemberRow[]>();
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    phoneNumber: row.phone_number,
    pointsBalance: row.points_balance,
  }));
}

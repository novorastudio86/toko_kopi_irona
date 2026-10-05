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

/** Cari member aktif berdasarkan No HP; null kalau tidak ditemukan */
export async function findMemberByPhone(phone: string): Promise<Member | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone_number, points_balance')
    .eq('phone_number', normalizePhone(phone))
    .eq('is_active', true)
    .maybeSingle<MemberRow>();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    phoneNumber: data.phone_number,
    pointsBalance: data.points_balance,
  };
}
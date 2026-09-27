import { supabase } from './supabase';
import type { Kasbon, KasbonInput, KasbonQuota } from '../types/kasbon';

export async function fetchKasbon(): Promise<Kasbon[]> {
  const { data, error } = await supabase
    .from('kasbon_overview')
    .select('*')
    .order('request_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    username: row.username,
    roleName: row.role_name,
    amount: Number(row.amount),
    requestDate: row.request_date,
    deductMonth: row.deduct_month,
    notes: row.notes,
    createdAt: row.created_at,
    createdByName: row.created_by_name,
    settledCashAt: row.settled_cash_at,
    settledCashByName: row.settled_cash_by_name,
    status: row.status,
  }));
}

/** Gaji pokok, kasbon yang sudah diambil bulan itu, dan sisa yang masih bisa diajukan */
export async function fetchKasbonQuota(
  employeeId: string,
  requestDate: string,
  excludeId: string | null = null
): Promise<KasbonQuota> {
  const { data, error } = await supabase.rpc('kasbon_quota', {
    p_employee_id: employeeId,
    p_request_date: requestDate,
    p_exclude_id: excludeId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    baseSalary: Number(row?.base_salary ?? 0),
    usedAmount: Number(row?.used_amount ?? 0),
    remainingAmount: Number(row?.remaining_amount ?? 0),
  };
}

export async function saveKasbon(input: KasbonInput, id: string | null): Promise<void> {
  const { error } = id
    ? await supabase.rpc('update_kasbon', {
        p_id: id,
        p_amount: input.amount,
        p_request_date: input.requestDate,
        p_notes: input.notes,
      })
    : await supabase.rpc('create_kasbon', {
        p_employee_id: input.employeeId,
        p_amount: input.amount,
        p_request_date: input.requestDate,
        p_notes: input.notes,
      });
  if (error) throw error;
}

/** Karyawan mengembalikan kasbon tunai — tidak jadi dipotong dari gaji */
export async function settleKasbonCash(id: string): Promise<void> {
  const { error } = await supabase.rpc('settle_kasbon_cash', { p_id: id });
  if (error) throw error;
}

export async function deleteKasbon(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_kasbon', { p_id: id });
  if (error) throw error;
}

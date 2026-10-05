import { supabase } from './supabase';
import type { AppEmployee, PinCheckResult } from '@/types/employee';
import type { AppRole } from '@/types/role';

interface AppEmployeeRow {
  employee_id: string;
  full_name: string;
  role_name: string;
  has_pin: boolean;
}

interface PinCheckRow {
  ok: boolean;
  employee_id?: string;
  full_name?: string;
  attempts_left?: number;
  locked_until?: string | null;
}

/** Karyawan aktif dengan role sesuai peran (Owner/Admin tidak ikut) */
export async function fetchAppEmployees(role: AppRole): Promise<AppEmployee[]> {
  const { data, error } = await supabase.rpc('list_app_employees', { p_role_type: role });
  if (error) throw new Error(error.message);
  return ((data ?? []) as AppEmployeeRow[]).map((row) => ({
    id: row.employee_id,
    fullName: row.full_name,
    roleName: row.role_name,
    hasPin: row.has_pin,
  }));
}

/** Cek PIN di server (PIN tidak pernah disimpan / dikirim balik ke aplikasi) */
export async function verifyEmployeePin(
  employeeId: string,
  pin: string,
  role: AppRole
): Promise<PinCheckResult> {
  const { data, error } = await supabase.rpc('verify_employee_pin', {
    p_employee_id: employeeId,
    p_pin: pin,
    p_role_type: role,
  });
  if (error) throw new Error(error.message);

  const row = data as PinCheckRow;
  if (row.ok && row.employee_id && row.full_name) {
    return { ok: true, employee: { id: row.employee_id, fullName: row.full_name, role } };
  }
  return { ok: false, attemptsLeft: row.attempts_left ?? 0, lockedUntil: row.locked_until ?? null };
}
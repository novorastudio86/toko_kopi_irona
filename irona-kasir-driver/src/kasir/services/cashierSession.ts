import { supabase } from '@/services/supabase';

/** Buka sesi kasir untuk karyawan yang baru masuk dengan PIN (dipakai Laporan Pendapatan Kasir) */
export async function startCashierSession(employeeId: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_cashier_session', {
    p_employee_id: employeeId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Tutup sesi kasir saat "Ganti" karyawan */
export async function endCashierSession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('end_cashier_session', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
}
import { supabase } from '@/services/supabase';
import type { AttendanceScanResult } from '@/kasir/types/attendance';

interface ScanRow {
  employee_name: string;
  action: 'masuk' | 'pulang';
  shift: string;
  late_minutes?: number;
  overtime_minutes?: number;
  overtime_pending_minutes?: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Catat absen masuk/pulang dari isi QR kartu karyawan (sama seperti /absensi di Web Admin) */
export async function recordAttendanceScan(qrText: string): Promise<AttendanceScanResult> {
  const token = qrText.trim();
  // QR kartu karyawan berisi token UUID; QR lain (mis. QRIS) langsung ditolak
  if (!UUID_PATTERN.test(token)) throw new Error('QR tidak dikenali.');

  const { data, error } = await supabase.rpc('record_attendance_scan', { p_qr_token: token });
  if (error) throw new Error(error.message);

  const row = data as ScanRow;
  return {
    employeeName: row.employee_name,
    action: row.action,
    shift: row.shift,
    lateMinutes: row.late_minutes ?? 0,
    overtimeMinutes: row.overtime_minutes ?? 0,
    overtimePendingMinutes: row.overtime_pending_minutes ?? 0,
  };
}
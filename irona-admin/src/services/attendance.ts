import { supabase } from './supabase';
import { fetchEmployees } from './employees';
import type { AttendanceRow, MissingEmployee, PendingOvertime } from '../types/attendance';

export async function fetchAttendanceByDate(date: string): Promise<AttendanceRow[]> {
  const [attendanceRes, employees] = await Promise.all([
    supabase
      .from('attendance')
      .select(
        'id, employee_id, attendance_date, shift, shift_pattern_ids, check_in, check_out, late_minutes, overtime_minutes, overtime_morning_minutes, overtime_night_minutes, overtime_status, overtime_approved_minutes, overtime_review_note, extra_shift_minutes, status, source, notes'
      )
      .eq('attendance_date', date),
    fetchEmployees(),
  ]);

  if (attendanceRes.error) throw attendanceRes.error;
  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  return (attendanceRes.data ?? []).map((row: any) => {
    const emp = employeeMap.get(row.employee_id);
    return {
      id: row.id,
      employeeId: row.employee_id,
      employeeName: emp?.fullName ?? '—',
      roleName: emp?.roleName ?? '—',
      attendanceDate: row.attendance_date,
      shift: row.shift,
      shiftPatternIds: row.shift_pattern_ids ?? [],
      checkIn: row.check_in,
      checkOut: row.check_out,
      lateMinutes: Number(row.late_minutes ?? 0),
      overtimeMinutes: Number(row.overtime_minutes ?? 0),
      overtimeMorningMinutes: Number(row.overtime_morning_minutes ?? 0),
      overtimeNightMinutes: Number(row.overtime_night_minutes ?? 0),
      overtimeStatus: row.overtime_status ?? 'none',
      overtimeApprovedMinutes: Number(row.overtime_approved_minutes ?? 0),
      overtimeReviewNote: row.overtime_review_note,
      extraShiftMinutes: Number(row.extra_shift_minutes ?? 0),
      status: row.status,
      source: row.source,
      notes: row.notes,
    };
  });
}

/** Karyawan aktif (non-admin) yang belum tercatat sama sekali di tanggal ini */
export async function fetchMissingEmployees(date: string): Promise<MissingEmployee[]> {
  const [employees, attendanceRes] = await Promise.all([
    fetchEmployees(),
    supabase.from('attendance').select('employee_id').eq('attendance_date', date),
  ]);

  const presentIds = new Set((attendanceRes.data ?? []).map((r: any) => r.employee_id));
  return employees
    .filter(
      (e) => e.isActive && e.roleType !== 'admin' && e.hireDate <= date && !presentIds.has(e.id)
    )
    .map((e) => ({ id: e.id, fullName: e.fullName, roleName: e.roleName }));
}

/** Telat, lembur & shift 2 dihitung ulang dari shift yang dipilih */
export async function correctAttendance(input: {
  attendanceId: string;
  checkIn: string;
  checkOut: string | null;
  reason: string;
  shiftPatternIds: string[];
}): Promise<void> {
  const { error } = await supabase.rpc('correct_attendance', {
    p_attendance_id: input.attendanceId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_reason: input.reason,
    p_shift_pattern_ids: input.shiftPatternIds,
  });
  if (error) throw error;
}

export async function createManualAttendance(input: {
  employeeId: string;
  date: string;
  shiftPatternIds: string[];
  checkIn: string;
  checkOut: string | null;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc('create_manual_attendance', {
    p_employee_id: input.employeeId,
    p_attendance_date: input.date,
    p_shift_pattern_ids: input.shiftPatternIds,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_reason: input.reason,
  });
  if (error) throw error;
}

/** Dipanggil halaman Scan Absensi (tanpa login) */
export async function recordAttendanceScan(qrToken: string): Promise<{
  employeeName: string;
  action: 'masuk' | 'pulang';
  shift: string;
  lateMinutes?: number;
  overtimeMinutes?: number;
  overtimePendingMinutes?: number;
  extraShiftMinutes?: number;
}> {
  const { data, error } = await supabase.rpc('record_attendance_scan', { p_qr_token: qrToken });
  if (error) throw new Error(error.message);
  return {
    employeeName: data.employee_name,
    action: data.action,
    shift: data.shift,
    lateMinutes: data.late_minutes,
    overtimeMinutes: data.overtime_minutes,
    overtimePendingMinutes: data.overtime_pending_minutes,
    extraShiftMinutes: data.extra_shift_minutes,
  };
}

/** Semua lembur malam yang belum diputuskan admin (opsional: rentang tanggal) */
export async function fetchPendingOvertime(
  start?: string,
  end?: string
): Promise<PendingOvertime[]> {
  let query = supabase
    .from('attendance')
    .select(
      'id, employee_id, attendance_date, shift, check_in, check_out, overtime_night_minutes, employees!attendance_employee_id_fkey(full_name)'
    )
    .eq('overtime_status', 'pending')
    .order('attendance_date', { ascending: false });
  if (start) query = query.gte('attendance_date', start);
  if (end) query = query.lte('attendance_date', end);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employees?.full_name ?? '—',
    attendanceDate: row.attendance_date,
    shift: row.shift,
    checkIn: row.check_in,
    checkOut: row.check_out,
    overtimeNightMinutes: Number(row.overtime_night_minutes ?? 0),
  }));
}

/** Setujui (penuh / sebagian) atau tolak lembur malam */
export async function reviewOvertime(input: {
  attendanceIds: string[];
  action: 'approve' | 'reject';
  minutes?: number | null;
  note?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('review_overtime', {
    p_attendance_ids: input.attendanceIds,
    p_action: input.action,
    p_minutes: input.minutes ?? null,
    p_note: input.note ?? null,
  });
  if (error) throw error;
}

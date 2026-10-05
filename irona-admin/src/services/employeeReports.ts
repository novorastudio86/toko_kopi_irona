import { supabase } from './supabase';
import type { AttendanceReportDay, AttendanceReportRow } from '../types/employeeReport';

const num = (v: unknown) => Number(v ?? 0);

/** Rekap absensi per karyawan aktif (non-admin), tanggal lokal "YYYY-MM-DD" inklusif */
export async function fetchAttendanceReport(
  start: string,
  end: string
): Promise<AttendanceReportRow[]> {
  const { data, error } = await supabase.rpc('report_attendance', {
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    employeeId: r.employee_id,
    fullName: r.full_name,
    roleName: r.role_name,
    totalMasuk: num(r.total_masuk),
    totalIzin: num(r.total_izin),
    totalTidakMasuk: num(r.total_tidak_masuk),
    totalTelat: num(r.total_telat),
    lateMinutes: num(r.late_minutes),
    workDays: num(r.work_days),
  }));
}

export async function fetchAttendanceReportDetail(
  employeeId: string,
  start: string,
  end: string
): Promise<AttendanceReportDay[]> {
  const { data, error } = await supabase.rpc('report_attendance_detail', {
    p_employee_id: employeeId,
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    day: r.day,
    status: r.status,
    scheduled: Boolean(r.scheduled),
    shift: r.shift,
    checkIn: r.check_in,
    checkOut: r.check_out,
    lateMinutes: num(r.late_minutes),
    source: r.source,
    notes: r.notes,
  }));
}

export type AttendanceStatus = 'hadir' | 'telat';
export type AttendanceSource = 'qr' | 'manual';
export type OvertimeStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface AttendanceRow {
  id: string;
  employeeId: string;
  employeeName: string;
  roleName: string;
  attendanceDate: string;
  /** Nama shift saat dicatat, mis. "Pagi" atau "Pagi + Sore" */
  shift: string | null;
  /** Pola shift yang dipakai menghitung telat/lembur/shift 2 */
  shiftPatternIds: string[];
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  /** Lembur yang dibayar = pagi (otomatis) + malam yang disetujui */
  overtimeMinutes: number;
  /** Lembur sebelum jam buka karena Jam Khusus — otomatis disetujui */
  overtimeMorningMinutes: number;
  /** Lembur lewat jam tutup — perlu persetujuan admin */
  overtimeNightMinutes: number;
  overtimeStatus: OvertimeStatus;
  overtimeApprovedMinutes: number;
  overtimeReviewNote: string | null;
  /** Menit kerja di shift ke-2 (dibayar sebagai bonus) */
  extraShiftMinutes: number;
  status: AttendanceStatus;
  source: AttendanceSource;
  notes: string | null;
}

/** Karyawan yang belum ada baris presensi sama sekali di tanggal itu */
export interface MissingEmployee {
  id: string;
  fullName: string;
  roleName: string;
}

/** Lembur malam yang menunggu persetujuan (lintas tanggal) */
export interface PendingOvertime {
  id: string;
  employeeId: string;
  employeeName: string;
  attendanceDate: string;
  shift: string | null;
  checkIn: string | null;
  checkOut: string | null;
  overtimeNightMinutes: number;
}

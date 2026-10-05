export type AttendanceDayStatus = 'masuk' | 'telat' | 'izin' | 'tidak_masuk';

export type AttendanceReportRow = {
  employeeId: string;
  fullName: string;
  roleName: string;
  totalMasuk: number;
  totalIzin: number;
  totalTidakMasuk: number;
  totalTelat: number;
  lateMinutes: number;
  /** Hari kerja = terjadwal atau ada presensi (pembagi % kehadiran) */
  workDays: number;
};

export type AttendanceReportDay = {
  day: string;
  status: AttendanceDayStatus;
  scheduled: boolean;
  shift: string | null;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  source: 'qr' | 'manual' | null;
  notes: string | null;
};

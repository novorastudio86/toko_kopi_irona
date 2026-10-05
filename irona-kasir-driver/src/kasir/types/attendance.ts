export interface AttendanceScanResult {
  employeeName: string;
  action: 'masuk' | 'pulang';
  shift: string;
  lateMinutes: number;
  overtimeMinutes: number;
  /** Lembur malam yang masih menunggu persetujuan admin */
  overtimePendingMinutes: number;
}
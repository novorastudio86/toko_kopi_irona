/**
 * berjalan    = akan dipotong dari gaji bulan ini
 * lunas_gaji  = bulan pengajuan sudah lewat, sudah dipotong gaji
 * lunas_tunai = dikembalikan tunai, tidak dipotong gaji
 */
export type KasbonStatus = 'berjalan' | 'lunas_gaji' | 'lunas_tunai';

export interface Kasbon {
  id: string;
  employeeId: string;
  employeeName: string;
  username: string;
  roleName: string;
  amount: number;
  requestDate: string;
  /** Tanggal 1 bulan gaji yang dipotong, mis. "2026-09-01" */
  deductMonth: string;
  notes: string | null;
  createdAt: string;
  createdByName: string | null;
  settledCashAt: string | null;
  settledCashByName: string | null;
  status: KasbonStatus;
}

export interface KasbonInput {
  employeeId: string;
  amount: number;
  requestDate: string;
  notes: string | null;
}

export interface KasbonQuota {
  baseSalary: number;
  usedAmount: number;
  remainingAmount: number;
}

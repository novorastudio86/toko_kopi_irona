/** staf = tidak login ke aplikasi apa pun (mis. Barista), cukup absen lewat QR */
export type RoleType = 'admin' | 'kasir' | 'driver' | 'staf';

export interface EmployeeListItem {
  id: string;
  fullName: string;
  phoneNumber: string;
  username: string;
  roleId: string;
  roleName: string;
  roleType: RoleType;
  baseSalary: number;
  deliveryBonus: number;
  isActive: boolean;
  hireDate: string;
}

export interface RoleOption {
  id: string;
  name: string;
  type: RoleType;
}

export interface RoleWithEmployees extends RoleOption {
  employees: {
    id: string;
    fullName: string;
    username: string;
    isActive: boolean;
    baseSalary: number;
    deliveryBonus: number;
  }[];
}

export interface EmployeeDetail {
  id: string;
  code: string;
  fullName: string;
  address: string | null;
  phoneNumber: string;
  username: string;
  roleId: string;
  roleName: string;
  roleType: RoleType;
  baseSalary: number;
  deliveryBonus: number;
  isActive: boolean;
  createdAt: string;
  hireDate: string;
  qrToken: string;
}

export interface EmployeeInput {
  fullName: string;
  address: string | null;
  phoneNumber: string;
  username: string;
  password: string;
  roleId: string;
  baseSalary: number;
  deliveryBonus: number;
  /** Tanggal mulai kerja "2026-01-15" */
  hireDate: string;
}

/** Rincian gaji satu karyawan dalam satu periode */
export interface PayrollRow {
  employeeId: string;
  baseSalary: number;
  deliveryRate: number;
  deliveryCount: number;
  deliveryBonusTotal: number;
  overtimeMinutes: number;
  hourlyRate: number;
  overtimeBonusTotal: number;
  extraShiftMinutes: number;
  extraShiftBonusTotal: number;
  bonusTotal: number;
  kasbonCount: number;
  kasbonTotal: number;
  /** Gaji pokok + semua bonus, sebelum dipotong kasbon */
  grossSalary: number;
  /** Gaji bersih yang dibayarkan (gross − kasbon) */
  totalSalary: number;
}

export interface EmployeeDetail {
  id: string;
  code: string;
  fullName: string;
  address: string | null;
  phoneNumber: string;
  username: string;
  roleId: string;
  roleName: string;
  roleType: RoleType;
  baseSalary: number;
  deliveryBonus: number;
  isActive: boolean;
  createdAt: string;
  qrToken: string;
}
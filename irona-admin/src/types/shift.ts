export interface ShiftPattern {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

/** Satu shift yang dipegang seorang karyawan di satu tanggal */
export interface ShiftSlot {
  shiftPatternId: string;
  shiftName: string;
  /** Jam efektif, sudah kena Jam Khusus */
  startTime: string;
  endTime: string;
  isSpecialHours: boolean;
  /** Hasil tukar/gantikan/tambah, bukan dari jadwal mingguan */
  isChanged: boolean;
}

export interface EmployeeShiftRow {
  employeeId: string;
  fullName: string;
  username: string;
  roleName: string;
  hasSchedule: boolean;
  isLibur: boolean;
  /** Gabungan, mis. "Pagi + Sore" */
  shiftName: string | null;
  startTime: string | null;
  endTime: string | null;
  isSwap: boolean;
  swapWithName: string | null;
  slots: ShiftSlot[];
}

/** day_of_week (0=Minggu..6=Sabtu) → id pola shift (maks. 2). Hari kosong = Libur */
export type WeeklyShifts = Record<number, string[]>;

export interface DateOverride {
  id: string;
  date: string;
  patternId: string;
  patternName: string;
  startTime: string;
  endTime: string;
  note: string | null;
}

export type ShiftChangeKind = 'tukar' | 'gantikan' | 'tambah' | 'libur';

export interface ShiftChangeLine {
  employeeName: string;
  date: string;
  shiftName: string;
  shiftStart: string;
  action: 'tambah' | 'lepas';
}

export interface ShiftChangeEvent {
  id: string;
  kind: ShiftChangeKind;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
  lines: ShiftChangeLine[];
}

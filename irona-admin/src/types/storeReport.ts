export type CashierIncomeRow = {
  sessionId: string;
  employeeId: string;
  cashierName: string;
  loginAt: string;
  logoutAt: string | null;
  transactions: number;
  cashAmount: number;
  nonCashAmount: number;
  onlineAmount: number;
  totalAmount: number;
  /** Kasbon yang dibuat selama sesi — info saja */
  cashOutCount: number;
  cashOutAmount: number;
  refundCount: number;
  refundAmount: number;
};

export type OpeningHourRow = {
  day: string;
  sessionCount: number;
  shift1Cashier: string | null;
  shift1Login: string | null;
  shift1Logout: string | null;
  shift2Cashier: string | null;
  shift2Login: string | null;
  shift2Logout: string | null;
  /** Menit kosong antara logout shift 1 dan login shift 2 (null = hanya 1 shift) */
  gapMinutes: number | null;
  scheduledOpen: string | null;
  scheduledClose: string | null;
  storeOpen: boolean;
  /** + = buka lebih lambat dari jadwal, − = lebih cepat */
  openDiffMinutes: number | null;
  /** + = tutup lebih lambat dari jadwal, − = lebih cepat */
  closeDiffMinutes: number | null;
};

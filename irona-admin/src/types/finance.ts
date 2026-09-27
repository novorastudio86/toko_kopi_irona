export type Bucket = 'hpp' | 'fixed_cost' | 'net_profit';

export type EntryType =
  | 'alokasi'
  | 'reversal_refund'
  | 'bahan_baku'
  | 'kasbon'
  | 'pelunasan_kasbon'
  | 'gaji'
  | 'pengeluaran_lain'
  | 'try_error'
  | 'pembelian_aset';

export type CashFlowEntry = {
  key: string;
  bucket: Bucket;
  entryDate: string;
  entryType: EntryType;
  description: string;
  amount: number; // + masuk, − keluar
  refTable: string;
  refId: string | null;
  sortAt: string;
};

export type BucketSummary = {
  bucket: Bucket;
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
  currentBalance: number;
};

export type HppMonth = {
  month: string;
  allocation: number;
  budget: number;
  spent: number;
  remaining: number;
  reserveShare: number;
  movedToReserve: number;
  reserveTotal: number;
  isClosed: boolean;
};

export type NetProfitMonth = {
  month: string;
  netProfit: number;
  bepShare: number;
  ownerShare: number;
  managerShare: number;
  assetSpent: number;
  bepBalance: number;
  ownerBalance: number;
  managerBalance: number;
};

export type FinanceSettings = {
  hppPct: number;
  fixedCostPct: number;
  netProfitPct: number;
  hppBudgetPct: number;
  bepPct: number;
  ownerPct: number;
  managerPct: number;
  settlementBusinessDays: number;
};

export type ExpenseType = 'gaji' | 'lain';

export type FinanceExpense = {
  id: string;
  expenseType: ExpenseType;
  name: string;
  employeeId: string | null;
  salaryMonth: string | null;
  amount: number;
  expenseDate: string;
  notes: string | null;
};

export type ExpenseInput = {
  expenseType: ExpenseType;
  name: string;
  employeeId: string | null;
  salaryMonth: string | null;
  amount: number;
  expenseDate: string;
  notes: string | null;
};

export type BalanceStatus = 'tertahan' | 'tersedia' | 'dicairkan' | 'direfund';

export type OnlineBalanceRow = {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  customerName: string | null;
  grossAmount: number;
  gatewayMdr: number;
  gatewayTax: number;
  netAmount: number;
  settledAt: string;
  availableDate: string;
  disbursedDate: string | null;
  status: BalanceStatus;
};

export type Disbursement = {
  id: string;
  disbursedDate: string;
  transactionCount: number;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  notes: string | null;
};

export type BankHoliday = { date: string; name: string };

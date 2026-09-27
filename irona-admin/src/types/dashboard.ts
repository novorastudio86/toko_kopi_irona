export type DashboardMode = 'day' | 'week' | 'month';

export type PeriodStats = {
  sales: number;
  paidSales: number;
  promoCost: number;
  transactions: number;
  transactionsOffline: number;
  transactionsOnline: number;
  productsSold: number;
  productsOffline: number;
  productsOnline: number;
};

export type SeriesPoint = { bucket: number; amount: number };

export type BreakdownRow = { key: string; label: string; amount: number; count: number };

export type LowStockRow = {
  name: string;
  stock: number;
  minStock: number;
  unit: string;
  ratio: number;
};

export type DashboardData = {
  current: PeriodStats;
  previous: PeriodStats;
  series: SeriesPoint[];
  previousSeries: SeriesPoint[];
  byCashier: BreakdownRow[];
  byOrderType: BreakdownRow[];
  byPayment: BreakdownRow[];
  byCategory: BreakdownRow[];
  topProducts: BreakdownRow[];
  lowStock: LowStockRow[];
  targets: { daily: number; monthly: number };
  generatedAt: string;
};

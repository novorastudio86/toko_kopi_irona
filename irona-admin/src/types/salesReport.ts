import type { BalanceStatus } from './finance';

export type SalesFilters = {
  /** Tanggal lokal "YYYY-MM-DD" (akhir inklusif) */
  start: string;
  end: string;
  timeBasis?: 'order' | 'pay';
  channel?: 'offline' | 'online' | null;
  orderType?: 'dine_in' | 'take_away' | 'online' | null;
  search?: string | null;
  balanceStatus?: BalanceStatus | null;
};

export type SalesSummary = {
  transactions: number;
  transactionsOffline: number;
  transactionsOnline: number;
  products: number;
  grossRevenue: number;
  discount: number;
  rewardRedeem: number;
  totalSales: number;
  refund: number;
  netSales: number;
  gatewayFeeTotal: number;
  gatewayFeeProducts: number;
  grossProfit: number;
  deliveryFee: number;
  serviceFee: number;
  priceAdjustment: number;
  totalPaid: number;
  received: number;
  notReceived: number;
};

export type SalesRow = {
  id: string;
  transactionNumber: string;
  orderTime: string;
  payTime: string | null;
  channel: 'offline' | 'online';
  orderType: 'dine_in' | 'take_away' | 'online';
  paymentMethod: string;
  status: string;
  customerName: string | null;
  subtotal: number;
  discount: number;
  totalAmount: number;
  deliveryFee: number;
  serviceFee: number;
  priceAdjustment: number;
  totalPaid: number;
  refund: number;
  gatewayMdr: number;
  gatewayTax: number;
  products: number;
  cashierName: string | null;
  driverName: string | null;
  distanceKm: number | null;
  address: string | null;
  balanceStatus: BalanceStatus | null;
  availableDate: string | null;
  disbursedDate: string | null;
};

export type PeriodRow = {
  periodStart: string;
  sales: number;
  refund: number;
  grossProfit: number;
  products: number;
  transactions: number;
};

export type PaymentReport = {
  methods: { method: string; transactions: number; amount: number }[];
  series: { period: string; method: string; transactions: number; amount: number }[];
};

export type TransactionItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
};

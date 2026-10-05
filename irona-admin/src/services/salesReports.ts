import { supabase } from './supabase';
import type {
  PaymentReport,
  PeriodRow,
  SalesFilters,
  SalesRow,
  SalesSummary,
  TransactionItem,
} from '../types/salesReport';
import { parseLocalDate, toLocalISO } from '../utils/date';

const num = (v: unknown) => Number(v ?? 0);

/** Rentang tanggal lokal → timestamptz WIB (akhir eksklusif = hari setelah tanggal akhir) */
export function toTs(start: string, end: string) {
  const next = parseLocalDate(end);
  next.setDate(next.getDate() + 1);
  return { start: `${start}T00:00:00+07:00`, end: `${toLocalISO(next)}T00:00:00+07:00` };
}

function filterParams(f: SalesFilters) {
  const ts = toTs(f.start, f.end);
  return {
    p_start: ts.start,
    p_end: ts.end,
    p_time_basis: f.timeBasis ?? 'order',
    p_channel: f.channel ?? null,
    p_order_type: f.orderType ?? null,
    p_search: f.search?.trim() || null,
    p_balance_status: f.balanceStatus ?? null,
  };
}

export async function fetchSalesSummary(f: SalesFilters): Promise<SalesSummary> {
  const { data, error } = await supabase.rpc('report_sales_summary', filterParams(f));
  if (error) throw error;
  const d: any = data;
  return {
    transactions: num(d.transactions),
    transactionsOffline: num(d.transactions_offline),
    transactionsOnline: num(d.transactions_online),
    products: num(d.products),
    grossRevenue: num(d.gross_revenue),
    discount: num(d.discount),
    rewardRedeem: num(d.reward_redeem),
    totalSales: num(d.total_sales),
    refund: num(d.refund),
    netSales: num(d.net_sales),
    gatewayFeeTotal: num(d.gateway_fee_total),
    gatewayFeeProducts: num(d.gateway_fee_products),
    grossProfit: num(d.gross_profit),
    deliveryFee: num(d.delivery_fee),
    serviceFee: num(d.service_fee),
    priceAdjustment: num(d.price_adjustment),
    totalPaid: num(d.total_paid),
    received: num(d.received),
    notReceived: num(d.not_received),
  };
}

function mapRow(r: any): SalesRow {
  return {
    id: r.id,
    transactionNumber: r.transaction_number,
    orderTime: r.order_time,
    payTime: r.pay_time,
    channel: r.channel,
    orderType: r.order_type,
    paymentMethod: r.payment_method,
    status: r.status,
    customerName: r.customer_name,
    subtotal: num(r.subtotal),
    discount: num(r.discount_amount),
    totalAmount: num(r.total_amount),
    deliveryFee: num(r.delivery_fee),
    serviceFee: num(r.service_fee),
    priceAdjustment: num(r.online_price_adjustment),
    totalPaid: num(r.total_paid),
    refund: num(r.refund_amount),
    gatewayMdr: num(r.gateway_mdr),
    gatewayTax: num(r.gateway_tax),
    products: num(r.products),
    cashierName: r.cashier_name,
    driverName: r.driver_name,
    distanceKm: r.delivery_distance_km === null ? null : num(r.delivery_distance_km),
    address: r.delivery_address,
    balanceStatus: r.balance_status,
    availableDate: r.available_date,
    disbursedDate: r.disbursed_date,
  };
}

/** Satu halaman daftar transaksi (terbaru dulu) + total baris */
export async function fetchSalesRows(
  f: SalesFilters,
  page: number,
  pageSize: number
): Promise<{ rows: SalesRow[]; total: number }> {
  const orderCol = f.timeBasis === 'pay' ? 'pay_time' : 'order_time';
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .rpc('sales_report_filtered', filterParams(f), { count: 'exact' })
    .order(orderCol, { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []).map(mapRow), total: count ?? 0 };
}

/** Semua baris untuk ekspor (diambil per 1000) */
export async function fetchAllSalesRows(f: SalesFilters): Promise<SalesRow[]> {
  const all: SalesRow[] = [];
  const size = 1000;
  for (let page = 1; ; page++) {
    const { rows } = await fetchSalesRows(f, page, size);
    all.push(...rows);
    if (rows.length < size) break;
  }
  return all;
}

export async function fetchSalesByPeriod(
  f: SalesFilters,
  group: 'day' | 'week' | 'month'
): Promise<PeriodRow[]> {
  const ts = toTs(f.start, f.end);
  const { data, error } = await supabase.rpc('report_sales_by_period', {
    p_start: ts.start,
    p_end: ts.end,
    p_group: group,
    p_channel: f.channel ?? null,
    p_order_type: f.orderType ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    periodStart: r.period_start,
    sales: num(r.sales),
    refund: num(r.refund),
    grossProfit: num(r.gross_profit),
    products: num(r.products),
    transactions: num(r.transactions),
  }));
}

export async function fetchPaymentReport(
  f: SalesFilters,
  group: 'day' | 'month'
): Promise<PaymentReport> {
  const ts = toTs(f.start, f.end);
  const { data, error } = await supabase.rpc('report_payment_methods', {
    p_start: ts.start,
    p_end: ts.end,
    p_channel: f.channel ?? null,
    p_group: group,
  });
  if (error) throw error;
  const d: any = data;
  return {
    methods: (d.methods ?? []).map((m: any) => ({
      method: m.method,
      transactions: num(m.transactions),
      amount: num(m.amount),
    })),
    series: (d.series ?? []).map((s: any) => ({
      period: s.period,
      method: s.method,
      transactions: num(s.transactions),
      amount: num(s.amount),
    })),
  };
}

export async function fetchTransactionItems(transactionId: string): Promise<TransactionItem[]> {
  const { data, error } = await supabase
    .from('transaction_items')
    .select('quantity, unit_price, discount_amount, line_total, products(name)')
    .eq('transaction_id', transactionId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map((i: any) => ({
    productName: i.products?.name ?? '—',
    quantity: num(i.quantity),
    unitPrice: num(i.unit_price),
    discount: num(i.discount_amount),
    lineTotal: num(i.line_total),
  }));
}

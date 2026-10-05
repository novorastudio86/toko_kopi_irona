import { supabase } from '@/services/supabase';
import type { HistoryTransaction, TransactionStatus } from '@/kasir/types/history';
import type { OrderType, PaymentMethod } from '@/kasir/types/order';

interface HistoryRow {
  id: string;
  transaction_number: string;
  queue_number: number | null;
  transaction_date: string;
  customer_name: string | null;
  customer_id: string | null;
  order_type: OrderType;
  payment_method: PaymentMethod;
  subtotal: number | string;
  total_amount: number | string;
  cash_received: number | string | null;
  change_amount: number | string | null;
  status: TransactionStatus;
  receipt_print_count: number;
  cashier: { full_name: string } | null;
  transaction_items: {
    quantity: number;
    unit_price: number | string;
    line_total: number | string;
    notes: string | null;
    products: { name: string } | null;
  }[];
  point_transactions: { points_change: number; point_type: string }[];
}

const SELECT = [
  'id, transaction_number, queue_number, transaction_date, customer_name, customer_id',
  'order_type, payment_method, subtotal, total_amount, cash_received, change_amount',
  'status, receipt_print_count',
  'cashier:employees!transactions_employee_id_fkey(full_name)',
  'transaction_items(quantity, unit_price, line_total, notes, products(name))',
  'point_transactions(points_change, point_type)',
].join(', ');

/** "2026-09-30" → "2026-10-01" */
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Transaksi kasir (Dine In / Take Away) pada satu tanggal WIB, terbaru dulu */
export async function fetchTransactionHistory(date: string): Promise<HistoryTransaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(SELECT)
    .in('order_type', ['dine_in', 'take_away'])
    .gte('transaction_date', `${date}T00:00:00+07:00`)
    .lt('transaction_date', `${nextDay(date)}T00:00:00+07:00`)
    .order('transaction_date', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as HistoryRow[]).map((row) => {
    const earned = row.point_transactions.find((p) => p.point_type === 'earn');
    return {
      transactionId: row.id,
      transactionNumber: row.transaction_number,
      queueNumber: row.queue_number ?? 0,
      transactionDate: row.transaction_date,
      cashierName: row.cashier?.full_name ?? '-',
      customerName: row.customer_name ?? '-',
      isMember: row.customer_id !== null,
      orderType: row.order_type,
      paymentMethod: row.payment_method,
      items: row.transaction_items.map((i) => ({
        name: i.products?.name ?? '-',
        quantity: i.quantity,
        unitPrice: Number(i.unit_price),
        lineTotal: Number(i.line_total),
        notes: i.notes,
      })),
      subtotal: Number(row.subtotal),
      total: Number(row.total_amount),
      cashReceived: row.cash_received === null ? null : Number(row.cash_received),
      change: row.change_amount === null ? null : Number(row.change_amount),
      pointsEarned: earned?.points_change ?? 0,
      pointsBalance: null,
      status: row.status,
      receiptPrintCount: row.receipt_print_count,
    };
  });
}

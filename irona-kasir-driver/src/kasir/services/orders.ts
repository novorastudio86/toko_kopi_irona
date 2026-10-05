import { supabase } from '@/services/supabase';
import type { OrderDraft, OrderReceipt, OrderType, PaymentMethod } from '@/kasir/types/order';

interface ReceiptRow {
  transaction_id: string;
  transaction_number: string;
  queue_number: number;
  transaction_date: string;
  cashier_name: string;
  customer_name: string;
  is_member: boolean;
  order_type: OrderType;
  payment_method: PaymentMethod;
  items: {
    name: string;
    quantity: number;
    unit_price: number | string;
    line_total: number | string;
    notes: string | null;
  }[];
  subtotal: number | string;
  total: number | string;
  cash_received: number | string | null;
  change: number | string | null;
  points_earned: number;
  points_balance: number | null;
}

const toNumberOrNull = (v: number | string | null): number | null => (v === null ? null : Number(v));

/**
 * Simpan order ke server. Tablet hanya mengirim produk, jumlah, catatan, pelanggan & pembayaran;
 * harga, stok, poin, No. Order & antrean dihitung server.
 */
export async function createKasirOrder(sessionId: string, draft: OrderDraft): Promise<OrderReceipt> {
  const { data, error } = await supabase.rpc('create_kasir_order', {
    p_session_id: sessionId,
    p_items: draft.items.map((i) => ({
      product_id: i.product.id,
      quantity: i.quantity,
      notes: i.notes.trim() || null,
    })),
    p_order_type: draft.orderType,
    p_payment_method: draft.paymentMethod,
    p_customer_name: draft.customerName.trim(),
    p_customer_id: draft.member?.id ?? null,
    p_cash_received: draft.paymentMethod === 'tunai' ? draft.cashReceived : null,
  });
  if (error) throw new Error(error.message);

  const row = data as ReceiptRow;
  return {
    transactionId: row.transaction_id,
    transactionNumber: row.transaction_number,
    queueNumber: row.queue_number,
    transactionDate: row.transaction_date,
    cashierName: row.cashier_name,
    customerName: row.customer_name,
    isMember: row.is_member,
    orderType: row.order_type,
    paymentMethod: row.payment_method,
    items: row.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
      notes: i.notes,
    })),
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    cashReceived: toNumberOrNull(row.cash_received),
    change: toNumberOrNull(row.change),
    pointsEarned: row.points_earned,
    pointsBalance: row.points_balance,
  };
}
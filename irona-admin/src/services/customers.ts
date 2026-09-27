import { supabase } from './supabase';
import type { Customer, CustomerPurchase, PointHistory, StatusHistory } from '../types/customer';

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase.from('customer_overview').select('*').order('name');
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    phoneNumber: row.phone_number,
    pointsBalance: Number(row.points_balance ?? 0),
    isActive: row.is_active,
    registeredAt: row.registered_at,
    hasAccount: row.has_account,
    totalTransactions: Number(row.total_transactions ?? 0),
    totalSpent: Number(row.total_spent ?? 0),
    lastTransactionAt: row.last_transaction_at,
    allTransactions: Number(row.all_transactions ?? 0),
  }));
}

export async function fetchCustomerPurchases(customerId: string): Promise<CustomerPurchase[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, transaction_number, transaction_date, order_type, status, subtotal, discount_amount, ' +
        'transaction_items(quantity, line_total, products(name)), refunds(refund_amount)'
    )
    .eq('customer_id', customerId)
    .order('transaction_date', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    transactionNumber: row.transaction_number,
    date: row.transaction_date,
    orderType: row.order_type,
    status: row.status,
    amount: Number(row.subtotal ?? 0) - Number(row.discount_amount ?? 0),
    refundedAmount: (row.refunds ?? []).reduce(
      (sum: number, r: any) => sum + Number(r.refund_amount ?? 0),
      0
    ),
    items: (row.transaction_items ?? []).map((i: any) => ({
      name: i.products?.name ?? '—',
      quantity: i.quantity,
      lineTotal: Number(i.line_total ?? 0),
    })),
  }));
}

export async function fetchPointHistory(customerId: string): Promise<PointHistory[]> {
  const { data, error } = await supabase
    .from('point_transactions')
    .select(
      'id, created_at, point_type, points_change, balance_after, notes, transactions(transaction_number), employees(full_name)'
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    date: row.created_at,
    type: row.point_type,
    change: row.points_change,
    balanceAfter: row.balance_after,
    notes: row.notes,
    transactionNumber: row.transactions?.transaction_number ?? null,
    createdByName: row.employees?.full_name ?? null,
  }));
}

export async function fetchStatusHistory(customerId: string): Promise<StatusHistory[]> {
  const { data, error } = await supabase
    .from('customer_status_history')
    .select('id, created_at, is_active, reason, employees(full_name)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    date: row.created_at,
    isActive: row.is_active,
    reason: row.reason,
    changedByName: row.employees?.full_name ?? null,
  }));
}

/** Tambah (+) / kurangi (−) poin manual. Mengembalikan saldo baru. */
export async function adjustCustomerPoints(
  customerId: string,
  delta: number,
  reason: string
): Promise<number> {
  const { data, error } = await supabase.rpc('adjust_customer_points', {
    p_customer_id: customerId,
    p_delta: delta,
    p_reason: reason,
  });
  if (error) throw error;
  return Number(data);
}

export async function setCustomerActive(
  customerId: string,
  active: boolean,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('set_customer_active', {
    p_customer_id: customerId,
    p_active: active,
    p_reason: reason,
  });
  if (error) throw error;
}

/** Hanya untuk member yang belum pernah bertransaksi */
export async function deleteCustomer(customerId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_customer', { p_customer_id: customerId });
  if (error) throw error;
}

/** "0812-3456-789" → "https://wa.me/628123456789" */
export function whatsappLink(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  return `https://wa.me/${digits}`;
}

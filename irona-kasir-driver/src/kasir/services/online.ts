import { supabase } from '@/services/supabase';
import type {
  AvailableDriver,
  OnlineEventType,
  OnlineOrder,
  OnlineStatus,
} from '@/kasir/types/online';
import type { PaymentMethod } from '@/kasir/types/order';

interface OnlineOrderRow {
  id: string;
  transaction_number: string;
  transaction_date: string;
  customer_name: string | null;
  customer_id: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  delivery_address: string | null;
  address_note: string | null;
  delivery_distance_km: number | string | null;
  delivery_lat: number | string | null;
  delivery_lng: number | string | null;
  payment_method: PaymentMethod;
  subtotal: number | string;
  total_amount: number | string;
  delivery_fee: number | string;
  service_fee: number | string;
  online_status: OnlineStatus;
  driver_id: string | null;
  receipt_print_count: number;
  cashier: { full_name: string } | null;
  driver: { full_name: string } | null;
  transaction_items: {
    quantity: number;
    unit_price: number | string;
    line_total: number | string;
    notes: string | null;
    products: { name: string } | null;
  }[];
  point_transactions: { points_change: number; point_type: string }[];
  online_order_events: { status: OnlineEventType; notes: string | null; created_at: string }[];
}

interface AvailableDriverRow {
  employee_id: string;
  full_name: string;
  checked_in_at: string;
  active_deliveries: number;
}

const SELECT = [
  'id, transaction_number, transaction_date, customer_name, customer_id, customer_phone',
  'customer_email, delivery_address, address_note, delivery_distance_km, delivery_lat, delivery_lng',
  'payment_method, subtotal, total_amount, delivery_fee, service_fee, online_status, driver_id, receipt_print_count',
  'cashier:employees!transactions_employee_id_fkey(full_name)',
  'driver:employees!transactions_driver_id_fkey(full_name)',
  'transaction_items(quantity, unit_price, line_total, notes, products(name))',
  'point_transactions(points_change, point_type)',
  'online_order_events(status, notes, created_at)',
].join(', ');

const ACTIVE_STATUSES: OnlineStatus[] = ['masuk', 'dibuat', 'siap_diantar', 'diantar'];

/** Jam 00:00 WIB hari ini dalam format ISO (UTC) */
function startOfTodayWib(): string {
  const wib = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  return new Date(`${wib}T00:00:00+07:00`).toISOString();
}

function toOnlineOrder(row: OnlineOrderRow): OnlineOrder {
  const earned = row.point_transactions.find((p) => p.point_type === 'earn');
  const total = Number(row.total_amount);
  const deliveryFee = Number(row.delivery_fee);
  const serviceFee = Number(row.service_fee);
  return {
    transactionId: row.id,
    transactionNumber: row.transaction_number,
    queueNumber: 0,
    transactionDate: row.transaction_date,
    cashierName: row.cashier?.full_name ?? '-',
    customerName: row.customer_name ?? '-',
    isMember: row.customer_id !== null,
    orderType: 'online',
    paymentMethod: row.payment_method,
    items: row.transaction_items.map((i) => ({
      name: i.products?.name ?? '-',
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
      notes: i.notes,
    })),
    subtotal: Number(row.subtotal),
    total,
    cashReceived: null,
    change: null,
    pointsEarned: earned?.points_change ?? 0,
    pointsBalance: null,
    onlineStatus: row.online_status,
    customerPhone: row.customer_phone ?? '',
    customerEmail: row.customer_email,
    address: row.delivery_address ?? '-',
    addressNote: row.address_note,
    distanceKm: row.delivery_distance_km === null ? null : Number(row.delivery_distance_km),
    destination:
      row.delivery_lat === null || row.delivery_lng === null
        ? null
        : { latitude: Number(row.delivery_lat), longitude: Number(row.delivery_lng) },
    deliveryFee,
    serviceFee,
    grandTotal: total + deliveryFee + serviceFee,
    driverId: row.driver_id,
    driverName: row.driver?.full_name ?? null,
    receiptPrintCount: row.receipt_print_count,
    events: [...row.online_order_events]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => ({ status: e.status, notes: e.notes, createdAt: e.created_at })),
  };
}

/** Pesanan online yang masih berjalan (tanggal berapa pun) + semua pesanan hari ini */
export async function fetchOnlineOrders(): Promise<OnlineOrder[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(SELECT)
    .eq('order_type', 'online')
    .or(`online_status.in.(${ACTIVE_STATUSES.join(',')}),transaction_date.gte.${startOfTodayWib()}`)
    .order('transaction_date', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as OnlineOrderRow[]).map(toOnlineOrder);
}

/** Pindah ke tahap berikutnya (server memeriksa urutan status) */
export async function advanceOnlineOrder(
  transactionId: string,
  to: OnlineStatus,
  sessionId: string | null,
  note?: string
): Promise<void> {
  const { error } = await supabase.rpc('advance_online_order', {
    p_transaction_id: transactionId,
    p_to: to,
    p_session_id: sessionId,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function assignOnlineDriver(
  transactionId: string,
  driverId: string,
  sessionId: string | null
): Promise<void> {
  const { error } = await supabase.rpc('assign_online_driver', {
    p_transaction_id: transactionId,
    p_driver_id: driverId,
    p_session_id: sessionId,
  });
  if (error) throw new Error(error.message);
}

export async function fetchAvailableDrivers(): Promise<AvailableDriver[]> {
  const { data, error } = await supabase.rpc('list_available_drivers');
  if (error) throw new Error(error.message);
  return ((data ?? []) as AvailableDriverRow[]).map((d) => ({
    employeeId: d.employee_id,
    fullName: d.full_name,
    checkedInAt: d.checked_in_at,
    activeDeliveries: Number(d.active_deliveries),
  }));
}

/**
 * Dengarkan perubahan pesanan online secara real-time (pesanan baru, status berubah,
 * termasuk dari Driver App nanti). Mengembalikan fungsi untuk berhenti mendengarkan.
 */
export function subscribeOnlineOrderEvents(
  onEvent: (status: OnlineEventType) => void
): () => void {
  const channel = supabase
    .channel('kasir-online-orders')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'online_order_events' },
      (payload) => onEvent((payload.new as { status: OnlineEventType }).status)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

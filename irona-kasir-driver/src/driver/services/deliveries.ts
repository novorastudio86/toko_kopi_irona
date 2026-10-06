import { supabase } from '@/services/supabase';
import type { DeliveryStatus, DeliveryTask, DutyStatus } from '@/driver/types/delivery';

interface DeliveryRow {
  id: string;
  transaction_number: string;
  transaction_date: string;
  online_status: DeliveryStatus;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  address_note: string | null;
  delivery_distance_km: number | string | null;
  delivery_lat: number | string | null;
  delivery_lng: number | string | null;
  total_amount: number | string;
  delivery_fee: number | string;
  service_fee: number | string;
  transaction_items: {
    quantity: number;
    unit_price: number | string;
    line_total: number | string;
    notes: string | null;
    products: { name: string } | null;
  }[];
  online_order_events: { status: string; created_at: string }[];
}

const SELECT = [
  'id, transaction_number, transaction_date, online_status, customer_name, customer_phone',
  'delivery_address, address_note, delivery_distance_km, delivery_lat, delivery_lng, total_amount, delivery_fee, service_fee',
  'transaction_items(quantity, unit_price, line_total, notes, products(name))',
  'online_order_events(status, created_at)',
].join(', ');

function toTask(row: DeliveryRow): DeliveryTask {
  const eventAt = (status: string) =>
    row.online_order_events.find((e) => e.status === status)?.created_at ?? null;
  return {
    transactionId: row.id,
    transactionNumber: row.transaction_number,
    orderedAt: row.transaction_date,
    status: row.online_status,
    customerName: row.customer_name ?? '-',
    customerPhone: row.customer_phone ?? '',
    address: row.delivery_address ?? '-',
    addressNote: row.address_note,
    distanceKm: row.delivery_distance_km === null ? null : Number(row.delivery_distance_km),
    destination:
      row.delivery_lat === null || row.delivery_lng === null
        ? null
        : { latitude: Number(row.delivery_lat), longitude: Number(row.delivery_lng) },
    items: row.transaction_items.map((i) => ({
      name: i.products?.name ?? '-',
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
      notes: i.notes,
    })),
    grandTotal: Number(row.total_amount) + Number(row.delivery_fee) + Number(row.service_fee),
    pickedUpAt: eventAt('diantar'),
    arrivedAt: eventAt('driver_tiba'),
    completedAt: eventAt('selesai'),
  };
}

/** Pesanan yang sedang ditugaskan ke driver (masih dibuat / siap / sedang diantar) */
export async function fetchActiveDeliveries(driverId: string): Promise<DeliveryTask[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(SELECT)
    .eq('order_type', 'online')
    .eq('driver_id', driverId)
    .in('online_status', ['dibuat', 'siap_diantar', 'diantar'])
    .order('transaction_date', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as DeliveryRow[]).map(toTask);
}

/** Pesanan yang sudah selesai diantar driver sejak tanggal tertentu, terbaru dulu */
export async function fetchDeliveryHistory(driverId: string, since: Date): Promise<DeliveryTask[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(SELECT)
    .eq('order_type', 'online')
    .eq('driver_id', driverId)
    .eq('online_status', 'selesai')
    .gte('transaction_date', since.toISOString())
    .order('transaction_date', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as DeliveryRow[])
    .map(toTask)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
}

export async function fetchDutyStatus(driverId: string): Promise<DutyStatus> {
  const { data, error } = await supabase.rpc('driver_duty_status', { p_driver_id: driverId });
  if (error) throw new Error(error.message);
  const d = data as { on_duty: boolean; check_in: string | null; check_out: string | null };
  return { onDuty: d.on_duty, checkIn: d.check_in, checkOut: d.check_out };
}

/** Driver menandai pesanan Diantar (berangkat) atau Selesai (diterima pelanggan) */
export async function advanceDelivery(
  transactionId: string,
  driverId: string,
  to: 'diantar' | 'selesai'
): Promise<void> {
  const { error } = await supabase.rpc('driver_advance_online_order', {
    p_transaction_id: transactionId,
    p_driver_id: driverId,
    p_to: to,
  });
  if (error) throw new Error(error.message);
}

/** Driver sudah sampai di lokasi (pesanan tetap "diantar" sampai diterima pelanggan) */
export async function markArrived(transactionId: string, driverId: string): Promise<void> {
  const { error } = await supabase.rpc('driver_mark_arrived', {
    p_transaction_id: transactionId,
    p_driver_id: driverId,
  });
  if (error) throw new Error(error.message);
}

/** Dengarkan perubahan pesanan online (penugasan baru, status berubah) */
export function subscribeDeliveryEvents(onEvent: () => void): () => void {
  const channel = supabase
    .channel('driver-deliveries')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'online_order_events' }, onEvent)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

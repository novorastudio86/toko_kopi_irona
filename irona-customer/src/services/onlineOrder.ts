import type {
  DeliveryQuote,
  DeliverySettings,
  LatLng,
  NewOnlineOrder,
  OnlineOrder,
  Voucher,
} from '@/types/onlineOrder';
import { supabase } from './supabase';

// TODO: pindah ke kolom profil toko saat tabelnya ada (sama dengan services/storeProfile.ts)
const STORE = { storeLat: -8.2692841, storeLng: 113.5402096 };

/** Angka ongkir & biaya layanan untuk tampilan checkout (RPC online_checkout_settings) */
export async function fetchDeliverySettings(): Promise<DeliverySettings> {
  const { data, error } = await supabase.rpc('online_checkout_settings').single<{
    fee_per_step: number;
    step_km: number;
    fee_per_100m: number;
    max_distance_km: number;
    service_fee: number;
  }>();
  if (error) throw error;
  return {
    feePerStep: Number(data.fee_per_step),
    stepKm: Number(data.step_km),
    feePer100m: Number(data.fee_per_100m),
    maxDistanceKm: Number(data.max_distance_km),
    serviceFee: Number(data.service_fee),
    ...STORE,
  };
}

// TODO(backend): sambungkan ke promotions channel online (validasi ulang di create-online-order).
// Sementara voucher dinonaktifkan: server selalu memakai diskon 0.
export async function fetchOnlineVouchers(): Promise<Voucher[]> {
  return [];
}

/** Ongkir dari rute jalan toko → titik pelanggan (Edge Function delivery-quote) */
export async function quoteDelivery(point: LatLng, signal?: AbortSignal): Promise<DeliveryQuote> {
  const { data, error } = await supabase.functions.invoke<DeliveryQuote>('delivery-quote', {
    body: point,
    signal,
  });
  if (error) throw error;
  return data!;
}

/**
 * Edge Function create-online-order: harga, ongkir & total dihitung ulang server,
 * lalu QRIS dibuat lewat Midtrans. Harga/total dari client tidak dipakai.
 */
export async function createOnlineOrder(input: NewOnlineOrder): Promise<OnlineOrder> {
  const { data, error } = await supabase.functions.invoke<OnlineOrder>('create-online-order', {
    body: {
      customerName: input.customerName,
      phone: input.phone,
      location: input.location,
      address: input.address,
      driverNote: input.driverNote,
      orderNote: input.orderNote,
      items: input.items.map((i) => ({ productId: i.productId, qty: i.qty })),
    },
  });
  if (error) {
    // Pesan dari server (mis. toko tutup, di luar jangkauan) ditampilkan apa adanya
    const body = await error.context?.json?.().catch(() => null);
    throw new Error(body?.error ?? 'Gagal membuat pesanan. Coba lagi.', { cause: error });
  }
  return data!;
}

/**
 * Status terbaru pesanan (dipanggil berkala selama menunggu bayar).
 * Status dibayar diisi webhook Midtrans (midtrans-webhook), bukan oleh client.
 */
export async function fetchOnlineOrder(id: string): Promise<OnlineOrder | null> {
  const { data, error } = await supabase.rpc('get_online_order', { p_id: id });
  if (error) throw error;
  return (data as OnlineOrder | null) ?? null;
}

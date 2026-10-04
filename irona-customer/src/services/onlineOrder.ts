import { deliveryFee, routeKm } from '@/screens/checkout/checkoutLogic';
import { PAY_WINDOW_MIN } from '@/screens/order/orderLogic';
import type {
  DeliveryQuote,
  DeliverySettings,
  LatLng,
  NewOnlineOrder,
  OnlineOrder,
  Voucher,
} from '@/types/onlineOrder';
import { mockDelay } from './mockDelay';

// TODO(backend): ganti dengan select online_order_settings (anon perlu policy select).
// Angka = default migration; titik toko dari services/storeProfile.ts.
const MOCK_SETTINGS: DeliverySettings = {
  feePerStep: 5000,
  stepKm: 2,
  feePer100m: 500,
  maxDistanceKm: 11,
  serviceFee: 1000,
  storeLat: -8.2692841,
  storeLng: 113.5402096,
};

// TODO(backend): ganti dengan promotions aktif channel online (periode, hari, jam, klaim per pelanggan).
const MOCK_VOUCHERS: Voucher[] = [
  {
    id: 'v-gratis-ongkir',
    name: 'Gratis ongkir s.d. 5 km',
    promoType: 'otomatis',
    target: 'ongkir',
    kind: 'persen',
    value: 100,
    minPurchase: 30000,
    memberOnly: false,
    maxDistanceKm: 5,
    endDate: '2026-10-31',
  },
  {
    id: 'v-ongkir-5k',
    name: 'Potongan ongkir Rp5.000',
    promoType: 'otomatis',
    target: 'ongkir',
    kind: 'nominal',
    value: 5000,
    minPurchase: 20000,
    memberOnly: false,
    maxDistanceKm: null,
    endDate: null,
  },
  {
    id: 'v-diskon-5k',
    name: 'Diskon menu Rp5.000',
    promoType: 'otomatis',
    target: 'produk',
    kind: 'nominal',
    value: 5000,
    minPurchase: 40000,
    memberOnly: false,
    maxDistanceKm: null,
    endDate: '2026-10-15',
  },
  {
    id: 'v-member-10',
    name: 'Diskon menu 10% khusus member',
    promoType: 'manual',
    target: 'produk',
    kind: 'persen',
    value: 10,
    minPurchase: 50000,
    memberOnly: true,
    maxDistanceKm: null,
    endDate: '2026-12-31',
  },
];

export async function fetchDeliverySettings(): Promise<DeliverySettings> {
  return mockDelay(MOCK_SETTINGS);
}

export async function fetchOnlineVouchers(): Promise<Voucher[]> {
  return mockDelay(MOCK_VOUCHERS);
}

/**
 * Ongkir dari rute jalan toko → titik pelanggan.
 * TODO(backend): ganti isi fungsi ini dengan supabase.functions.invoke('delivery-quote', { body: point }).
 * Versi mock menghitung di browser (rute OSRM + skema mock) — ongkir final tetap wajib dihitung ulang
 * di server saat order dibuat, jangan terima ongkir dari client.
 */
export async function quoteDelivery(point: LatLng, signal?: AbortSignal): Promise<DeliveryQuote> {
  const s = MOCK_SETTINGS;
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${s.storeLng},${s.storeLat};${point.lng},${point.lat}?overview=false`,
    { signal }
  );
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  const meters = data?.routes?.[0]?.distance;
  if (data?.code !== 'Ok' || typeof meters !== 'number') throw new Error(`OSRM ${data?.code}`);
  const distanceKm = routeKm(meters);
  const fee = deliveryFee(distanceKm, s);
  return { deliverable: fee !== null, fee, distanceKm };
}

// ponytail: "server" pesanan mock = localStorage browser ini. Hapus blok ini saat backend siap.
const MOCK_ORDERS_KEY = 'irona:mock-orders';

function readMockOrders(): Record<string, OnlineOrder> {
  try {
    return JSON.parse(localStorage.getItem(MOCK_ORDERS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeMockOrder(order: OnlineOrder) {
  try {
    localStorage.setItem(
      MOCK_ORDERS_KEY,
      JSON.stringify({ ...readMockOrders(), [order.id]: order })
    );
  } catch {
    // mock saja
  }
}

/**
 * TODO(backend): Edge Function create-online-order — validasi item, hitung ulang harga/ongkir/voucher
 * di server, simpan transaksi online, minta QRIS dinamis Midtrans, kirim link status ke WhatsApp.
 */
export async function createOnlineOrder(input: NewOnlineOrder): Promise<OnlineOrder> {
  const now = Date.now();
  const order: OnlineOrder = {
    id: crypto.randomUUID(),
    code: `IRN-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    status: 'menunggu_pembayaran',
    createdAt: new Date(now).toISOString(),
    payExpiresAt: new Date(now + PAY_WINDOW_MIN * 60_000).toISOString(),
    customerName: input.customerName,
    phone: input.phone,
    address: input.address,
    items: input.items,
    subtotal: input.subtotal,
    shippingFee: input.shippingFee,
    discount: input.discount,
    serviceFee: input.serviceFee,
    total: input.subtotal + input.shippingFee + input.serviceFee - input.discount,
  };
  writeMockOrder(order);
  return mockDelay(order);
}

/**
 * Status terbaru pesanan (dipanggil berkala selama menunggu bayar).
 * TODO(backend): select dari transaksi online by id (uuid tidak bisa ditebak; jangan expose by code).
 * Status dibayar diisi webhook Midtrans, bukan oleh client.
 */
export async function fetchOnlineOrder(id: string): Promise<OnlineOrder | null> {
  const order = readMockOrders()[id] ?? null;
  if (order?.status === 'menunggu_pembayaran' && Date.parse(order.payExpiresAt) <= Date.now()) {
    order.status = 'kedaluwarsa';
    writeMockOrder(order);
  }
  return mockDelay(order);
}

/** MOCK ONLY: pengganti webhook settlement Midtrans. Hapus bersama tombol simulasinya. */
export async function simulatePayment(id: string): Promise<void> {
  const order = readMockOrders()[id];
  if (order?.status === 'menunggu_pembayaran') writeMockOrder({ ...order, status: 'diproses' });
  return mockDelay(undefined);
}

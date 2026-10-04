import { deliveryFee, routeKm } from '@/screens/checkout/checkoutLogic';
import type { DeliveryQuote, DeliverySettings, LatLng, Voucher } from '@/types/onlineOrder';
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

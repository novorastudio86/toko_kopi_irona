import type { DeliverySettings, Voucher } from '@/types/onlineOrder';
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
    code: 'GRATISONGKIR',
    name: 'Gratis ongkir s.d. 5 km',
    target: 'ongkir',
    kind: 'persen',
    value: 100,
    minPurchase: 30000,
    memberOnly: false,
    maxDistanceKm: 5,
  },
  {
    id: 'v-ongkir-5k',
    code: 'ONGKIR5K',
    name: 'Potongan ongkir Rp5.000',
    target: 'ongkir',
    kind: 'nominal',
    value: 5000,
    minPurchase: 20000,
    memberOnly: false,
    maxDistanceKm: null,
  },
  {
    id: 'v-diskon-5k',
    code: 'HEMAT5K',
    name: 'Diskon menu Rp5.000',
    target: 'produk',
    kind: 'nominal',
    value: 5000,
    minPurchase: 40000,
    memberOnly: false,
    maxDistanceKm: null,
  },
  {
    id: 'v-member-10',
    code: 'MEMBER10',
    name: 'Diskon menu 10% khusus member',
    target: 'produk',
    kind: 'persen',
    value: 10,
    minPurchase: 50000,
    memberOnly: true,
    maxDistanceKm: null,
  },
];

export async function fetchDeliverySettings(): Promise<DeliverySettings> {
  return mockDelay(MOCK_SETTINGS);
}

export async function fetchOnlineVouchers(): Promise<Voucher[]> {
  return mockDelay(MOCK_VOUCHERS);
}

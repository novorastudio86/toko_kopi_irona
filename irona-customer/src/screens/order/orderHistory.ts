import { pruneRecent, type RecentOrder } from './orderLogic';

// Pesanan tamu tidak punya akun, jadi daftar "pesanan barusan" disimpan di browser ini saja.
// Isinya hanya id; detail & status selalu diambil dari server.
// TODO(backend): member → ambil riwayat dari server (customer_id), bukan dari sini.
const STORAGE_KEY = 'irona:recent-orders';

export function loadRecentOrders(): RecentOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return pruneRecent(raw ? JSON.parse(raw) : [], Date.now());
  } catch {
    return [];
  }
}

export function rememberOrder(order: RecentOrder) {
  try {
    const next = pruneRecent([order, ...loadRecentOrders()], Date.now());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // tidak tersimpan: pesanan tetap bisa dibuka dari link di WhatsApp
  }
}

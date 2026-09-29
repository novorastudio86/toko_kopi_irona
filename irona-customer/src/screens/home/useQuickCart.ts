import { useCallback, useSyncExternalStore } from 'react';

// TODO(cart): keranjang asli (CartProvider) baru counter dummy tanpa qty per produk.
// Setelah CartProvider menyimpan item + qty, ganti isi hook ini dengan useCart() — antarmukanya tetap.
const STORAGE_KEY = 'irona:quick-cart';
const CHANGE_EVENT = 'irona:quick-cart-change';

/** Batas qty per produk (belum ada batas di keranjang asli) */
export const MAX_QTY = 99;

type Quantities = Record<string, number>;

// Snapshot di-cache per string mentah supaya useSyncExternalStore dapat referensi stabil.
// Kalau localStorage tidak bisa dipakai (private mode), qty tetap jalan di memori.
let cachedRaw: string | null = null;
let cached: Quantities = {};

function read(): Quantities {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return cached;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      cached = parsed && typeof parsed === 'object' ? (parsed as Quantities) : {};
    } catch {
      cached = {};
    }
  }
  return cached;
}

function write(next: Quantities) {
  cached = next;
  cachedRaw = JSON.stringify(next);
  try {
    localStorage.setItem(STORAGE_KEY, cachedRaw);
  } catch {
    // tetap di memori
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// "storage" = diubah dari tab/halaman lain; CHANGE_EVENT = diubah di tab ini
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Qty per produk untuk tombol tambah cepat; tersimpan di localStorage dan sinkron antar tab */
export function useQuickCart() {
  const quantities = useSyncExternalStore(subscribe, read);

  const quantityOf = useCallback(
    (productId: string) => {
      const qty = Math.floor(Number(quantities[productId]) || 0);
      return Math.min(MAX_QTY, Math.max(0, qty));
    },
    [quantities]
  );

  /** qty 0 = hapus dari keranjang */
  const setQuantity = useCallback((productId: string, qty: number) => {
    const next = { ...read() };
    if (qty > 0) next[productId] = Math.min(MAX_QTY, qty);
    else delete next[productId];
    write(next);
  }, []);

  return { quantityOf, setQuantity };
}

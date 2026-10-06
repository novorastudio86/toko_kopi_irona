import { useCallback, useEffect, useState } from 'react';
import { Vibration } from 'react-native';
import { fetchOnlineOrders, subscribeOnlineOrderEvents } from '@/kasir/services/online';
import type { OnlineOrder } from '@/kasir/types/online';

/**
 * Daftar pesanan online yang selalu terbarui: dimuat sekali, lalu dimuat ulang setiap ada
 * event baru dari server. Dipakai di KasirShell supaya badge sidebar tetap jalan
 * walaupun kasir sedang di menu lain.
 */
export function useOnlineOrders() {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setOrders(await fetchOnlineOrders());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat pesanan online.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    return subscribeOnlineOrderEvents((status) => {
      // Getar sebentar kalau ada pesanan baru masuk
      if (status === 'masuk') Vibration.vibrate([0, 400, 200, 400]);
      reload();
    });
  }, [reload]);

  const newCount = orders.filter((o) => o.onlineStatus === 'masuk').length;

  return { orders, loading, error, reload, newCount };
}

export type OnlineOrdersApi = ReturnType<typeof useOnlineOrders>;

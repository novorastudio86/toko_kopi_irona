import { useEffect, useState } from 'react';
import { fetchStoreHours } from '@/services/storeHours';
import type { StoreHours } from '@/types/storeHours';

/** Jam buka semua channel; null selama memuat / gagal */
export function useStoreHours(): StoreHours[] | null {
  const [hours, setHours] = useState<StoreHours[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStoreHours()
      .then((data) => !cancelled && setHours(data))
      .catch((err) => console.error('Gagal memuat jam buka', err));
    return () => {
      cancelled = true;
    };
  }, []);

  return hours;
}

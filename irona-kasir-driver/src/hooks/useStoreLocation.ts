import { useEffect, useState } from 'react';
import { fetchStoreLocation } from '@/services/store';
import type { LatLng } from '@/types/store';

/** Titik toko untuk peta; null selama dimuat / belum diisi di Web Admin */
export function useStoreLocation(): LatLng | null {
  const [location, setLocation] = useState<LatLng | null>(null);
  useEffect(() => {
    fetchStoreLocation()
      .then(setLocation)
      .catch(() => setLocation(null));
  }, []);
  return location;
}

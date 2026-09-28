import { useEffect, useState } from 'react';
import { fetchStoreProfile } from '@/services/storeProfile';
import type { StoreProfile } from '@/types/storeProfile';

/** Profil toko (alamat, peta, sosial); null selama memuat / gagal */
export function useStoreProfile(): StoreProfile | null {
  const [profile, setProfile] = useState<StoreProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStoreProfile()
      .then((data) => !cancelled && setProfile(data))
      .catch((err) => console.error('Gagal memuat profil toko', err));
    return () => {
      cancelled = true;
    };
  }, []);

  return profile;
}

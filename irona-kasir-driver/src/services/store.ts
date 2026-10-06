import { supabase } from './supabase';
import type { LatLng } from '@/types/store';

let cached: LatLng | null = null;

/** Titik lokasi toko dari Data Toko (Web Admin); null kalau belum diisi */
export async function fetchStoreLocation(): Promise<LatLng | null> {
  if (cached) return cached;
  const { data, error } = await supabase
    .from('store_settings')
    .select('latitude, longitude')
    .single<{ latitude: number | string | null; longitude: number | string | null }>();
  if (error) throw new Error(error.message);
  if (data.latitude === null || data.longitude === null) return null;
  cached = { latitude: Number(data.latitude), longitude: Number(data.longitude) };
  return cached;
}

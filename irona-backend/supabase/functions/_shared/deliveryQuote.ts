import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

// TODO: pindah ke kolom profil toko saat tabelnya ada (sama dengan irona-customer services/storeProfile.ts)
const STORE = { lat: -8.2692841, lng: 113.5402096 };

// ponytail: server demo OSRM publik — gratis & tanpa key, tapi profil mobil (bukan motor),
// ~1 req/detik, tanpa SLA. Kalau order ramai: self-host OSRM (set OSRM_URL) atau Google Routes TWO_WHEELER.
const OSRM_URL = Deno.env.get('OSRM_URL') ?? 'https://router.project-osrm.org';

/** Jarak rute jalan toko → titik pelanggan, dibulatkan ke atas per 100 m */
async function routeDistanceKm(lat: number, lng: number): Promise<number> {
  const res = await fetch(
    `${OSRM_URL}/route/v1/driving/${STORE.lng},${STORE.lat};${lng},${lat}?overview=false`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  const meters = data?.routes?.[0]?.distance;
  if (data?.code !== 'Ok' || typeof meters !== 'number') throw new Error(`OSRM ${data?.code}`);
  return Math.ceil(meters / 100) / 10;
}

/**
 * Ongkir dihitung di server dari rute jalan + calc_delivery_fee.
 * Dipakai ulang saat order dibuat — jangan pernah menerima ongkir/jarak dari client.
 */
export async function quoteDelivery(admin: SupabaseClient, lat: number, lng: number) {
  const distanceKm = await routeDistanceKm(lat, lng);
  const { data, error } = await admin
    .rpc('calc_delivery_fee', { p_distance_km: distanceKm })
    .single<{ is_deliverable: boolean; fee: number | null }>();
  if (error) throw error;
  return {
    deliverable: data.is_deliverable,
    fee: data.fee === null ? null : Number(data.fee),
    distanceKm,
  };
}

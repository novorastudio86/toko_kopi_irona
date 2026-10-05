-- ============================================================
-- KOORDINAT TOKO & TITIK PENGANTARAN (peta di Driver App)
--
-- - store_settings.latitude/longitude: titik toko, diatur Owner di Web Admin (Data Toko).
-- - transactions.delivery_lat/lng: titik antar pesanan online, nanti diisi Web Customer
--   saat pelanggan memilih pin di peta waktu checkout.
-- - distance_km(): jarak garis lurus (haversine) — dipakai data contoh sekarang dan bisa
--   dipakai Web Customer untuk menghitung jarak/ongkir.
-- ============================================================

alter table public.store_settings
  add column latitude numeric(9, 6) check (latitude between -90 and 90),
  add column longitude numeric(9, 6) check (longitude between -180 and 180);

comment on column public.store_settings.latitude is 'Titik lokasi toko (untuk peta & jarak antar)';

-- Perkiraan titik Toko Kopi Irona, Jl. Rambipuji No. 99, Balung Lor, Jember.
-- Koreksi dari Web Admin → Custom Struk → Data Toko kalau titiknya kurang pas.
update public.store_settings set latitude = -8.2655, longitude = 113.5515
where id and latitude is null;

alter table public.transactions
  add column delivery_lat numeric(9, 6) check (delivery_lat between -90 and 90),
  add column delivery_lng numeric(9, 6) check (delivery_lng between -180 and 180);

comment on column public.transactions.delivery_lat is 'Titik antar pesanan online (pin pelanggan)';

create or replace function public.distance_km(
  p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric
)
returns numeric
language sql
immutable
as $$
  select round((6371 * 2 * asin(sqrt(
      power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  )))::numeric, 2);
$$;

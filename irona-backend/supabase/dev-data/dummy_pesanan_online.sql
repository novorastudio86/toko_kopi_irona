-- ============================================================
-- DATA CONTOH PESANAN ONLINE (untuk Laporan Penjualan Online)
-- Mengisi pesanan online DUMMY dengan jarak, ongkir (rumus Order Online), biaya layanan,
-- alamat, dan driver. Jalankan setelah dummy_pelanggan.sql / dummy_keuangan.sql.
-- Aman dijalankan ulang: hanya mengisi pesanan online DUMMY yang jaraknya masih kosong.
-- Data ini ikut terhapus bersama transaksi DUMMY (script *_hapus.sql).
-- ============================================================
begin;
-- Data contoh bertanggal lampau: lewati kunci tutup buku (khusus script dev)
set local irona.bypass_period_lock = 'on';

with target as (
  select t.id,
         -- jarak 0,5–10,9 km (maks antar 11 km)
         round((0.5 + random() * 10.4)::numeric, 1) as km,
         (array['Jl. Kaliurang Km 5 No. 12', 'Jl. Gejayan No. 88', 'Jl. Seturan Raya No. 21',
                'Perum Griya Asri Blok C-7', 'Jl. Magelang Km 7 No. 3', 'Jl. Palagan No. 45',
                'Kos Melati, Jl. Pandega Marta No. 9', 'Jl. Babarsari No. 30'])[1 + floor(random() * 8)::int]
           as address
  from transactions t
  where t.transaction_number like 'DUMMY-%' and t.order_type = 'online' and t.delivery_distance_km is null
)
update transactions t set
  delivery_distance_km = x.km,
  delivery_fee = coalesce((select fee from calc_delivery_fee(x.km)), 0),
  service_fee = (select service_fee from online_order_settings),
  delivery_address = x.address,
  driver_id = (select e.id from employees e join roles r on r.id = e.role_id
               where r.type = 'driver' and e.is_active order by e.full_name limit 1)
from target x
where t.id = x.id;

commit;

-- ============================================================
-- DATA CONTOH PEMAKAIAN STOK DARI PENJUALAN (untuk Perputaran Stok & Kartu Stok)
-- Mencatat pergerakan 'penjualan' (bahan terpotong sesuai resep) untuk setiap transaksi DUMMY,
-- persis seperti yang nanti dilakukan Kasir App. Supaya stok tidak minus, ditambahkan satu
-- penyesuaian "stok awal" (opname +) per bahan tanggal 31 Jul 2026 sebesar pemakaian + 10–60%.
-- Catatan stok awal diawali "[DUMMY-AWAL]".
-- Jalankan setelah dummy_keuangan.sql. Aman dijalankan ulang (transaksi yang sudah punya
-- pergerakan penjualan dilewati). Hapus dengan dummy_pemakaian_stok_hapus.sql.
-- ============================================================
begin;
set local irona.bypass_period_lock = 'on';

create temp table dummy_usage on commit drop as
select t.id as transaction_id, t.transaction_date, t.employee_id,
       x.item_type, x.raw_material_id, x.racikan_id, x.unit_id, sum(x.quantity) as qty
from transactions t
join transaction_items i on i.transaction_id = t.id
cross join lateral expand_product_usage(i.product_id, i.quantity) x
where t.transaction_number like 'DUMMY-%'
  and t.status not in ('dibatalkan', 'refund_penuh')
  and not exists (select 1 from stock_movements sm
                  where sm.transaction_id = t.id and sm.movement_type = 'penjualan')
group by 1, 2, 3, 4, 5, 6, 7
having sum(x.quantity) > 0;

-- Stok awal: cukup untuk seluruh pemakaian + cadangan acak (bervariasi supaya perputaran beda-beda)
insert into stock_movements (movement_type, item_type, raw_material_id, racikan_id, quantity, unit_id,
                             adjustment_reason, notes, movement_date, created_at)
select 'penyesuaian', u.item_type, u.raw_material_id, u.racikan_id,
       ceil(sum(u.qty) * (1.1 + random() * 0.5)), min(u.unit_id::text)::uuid, 'opname',
       '[DUMMY-AWAL] Stok awal data contoh', date '2026-07-31',
       (date '2026-07-31' + time '22:00') at time zone 'Asia/Jakarta'
from dummy_usage u
group by u.item_type, u.raw_material_id, u.racikan_id;

insert into stock_movements (movement_type, item_type, raw_material_id, racikan_id, quantity, unit_id,
                             notes, movement_date, transaction_id, created_at)
select 'penjualan', u.item_type, u.raw_material_id, u.racikan_id, -u.qty, u.unit_id,
       'Penjualan ' || t.transaction_number,
       (u.transaction_date at time zone 'Asia/Jakarta')::date, u.transaction_id, u.transaction_date
from dummy_usage u
join transactions t on t.id = u.transaction_id;

commit;

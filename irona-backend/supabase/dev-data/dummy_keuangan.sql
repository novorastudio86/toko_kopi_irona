-- ============================================================
-- DATA CONTOH MODUL KEUANGAN (Agustus 2026 s/d hari ini)
-- Hapus lagi dengan dummy_keuangan_hapus.sql
--
-- Penanda data contoh:
--   transaksi 'DUMMY-KEU-…', catatan/notes berisi '[contoh]'
-- Dijalankan sebagai Budi Owner (lewat jwt claims) supaya memakai RPC yang sama dengan aplikasi.
-- ============================================================
begin;
-- Data contoh bertanggal lampau: lewati kunci tutup buku (khusus script dev)
set local irona.bypass_period_lock = 'on';

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- Pesanan online dummy pelanggan yang tercatat "tunai" → QRIS (online selalu via payment gateway)
update transactions set payment_method = 'qris', cash_received = null, change_amount = null
where transaction_number like 'DUMMY-%' and order_type = 'online' and payment_method = 'tunai';
update transactions set settled_at = transaction_date + interval '2 minutes'
where transaction_number like 'DUMMY-%' and order_type = 'online' and settled_at is null;

-- ------------------------------------------------------------
-- 1. Transaksi harian (12–20 per hari, jam 08:00–22:00 WIB)
-- ------------------------------------------------------------
do $$
declare
  d date;
  i int;
  n int;
  v_no int := 0;
  v_tx uuid;
  v_type text;
  v_pay text;
  v_time timestamptz;
  v_total numeric;
  v_cash numeric;
  p record;
  v_qty int;
  names text[] := array['Andi', 'Sari', 'Dewi', 'Rizky', 'Putra', 'Nadia', 'Fajar', 'Laras', 'Bayu',
                        'Citra', 'Yoga', 'Intan', 'Galih', 'Maya', 'Tono', 'Rara'];
begin
  for d in select generate_series(date '2026-08-01', jakarta_today(), interval '1 day')::date loop
    -- akhir pekan lebih ramai
    n := case when extract(isodow from d) >= 6 then 16 + floor(random() * 6)::int
              else 11 + floor(random() * 6)::int end;
    for i in 1..n loop
      v_no := v_no + 1;
      v_type := case when random() < 0.4 then 'dine_in' when random() < 0.7 then 'take_away' else 'online' end;
      v_pay := case when v_type = 'online' then 'qris' when random() < 0.55 then 'tunai' else 'qris' end;
      v_time := (d + time '08:00' + (random() * interval '14 hours')) at time zone 'Asia/Jakarta';
      -- transaksi hari ini tidak boleh di masa depan
      if v_time > now() then continue; end if;

      insert into transactions (transaction_number, order_type, payment_method, customer_name, employee_id,
                                subtotal, discount_amount, total_amount, status, transaction_date, settled_at)
      values ('DUMMY-KEU-' || lpad(v_no::text, 5, '0'), v_type, v_pay,
              names[1 + floor(random() * array_length(names, 1))::int],
              'a0000000-0000-0000-0000-000000000001', 0, 0, 0, 'selesai', v_time,
              case when v_type = 'online' then v_time + interval '2 minutes' end)
      returning id into v_tx;

      v_total := 0;
      for p in select id, selling_price from products
               where is_active and selling_price > 0 order by random() limit 1 + floor(random() * 3)::int loop
        v_qty := 1 + floor(random() * 2)::int;
        insert into transaction_items (transaction_id, product_id, quantity, unit_price, line_total)
        values (v_tx, p.id, v_qty, p.selling_price, p.selling_price * v_qty);
        v_total := v_total + p.selling_price * v_qty;
      end loop;

      v_cash := case when v_pay = 'tunai' then ceil(v_total / 50000) * 50000 end;
      update transactions
      set subtotal = v_total, total_amount = v_total,
          cash_received = v_cash, change_amount = v_cash - v_total
      where id = v_tx;
    end loop;
  end loop;
end $$;

-- Refund contoh: 1 transaksi di bulan ini (produk sudah dibuat)
select create_refund(
  (select id from transactions where transaction_number like 'DUMMY-KEU-%' and status = 'selesai'
     and transaction_date >= date_trunc('month', now()) and order_type <> 'online'
   order by transaction_date limit 1),
  'sudah_dibuat', 'Pelanggan komplain rasa terlalu manis [contoh]');

-- ------------------------------------------------------------
-- 2. HPP: belanja bahan baku (Stok Masuk). Harga = harga per satuan saat ini → harga bahan tidak berubah
-- ------------------------------------------------------------
select record_stock_in(rm.id, rm.base_unit_id, x.packs, x.per_pack, rm.unit_price * x.packs * x.per_pack,
                       x.d::date, x.note || ' [contoh]')
from (values
  ('Coffee Beans Arabica',               4, 1000, '2026-08-03', 'Supplier Roastery'),
  ('Coffee Beans Blend bob mona (TBRK)', 6, 1000, '2026-08-03', 'Supplier Roastery'),
  ('Creamer Avy Cair',                   4, 1000, '2026-08-10', 'Toko bahan'),
  ('cup plastik',                        8,  250, '2026-08-10', 'Toko kemasan'),
  ('GreenField',                        40, 1000, '2026-08-17', 'Distributor susu'),
  ('Coffee Beans Arabica',               4, 1000, '2026-09-02', 'Supplier Roastery'),
  ('Coffee Beans Blend bob mona (TBRK)', 6, 1000, '2026-09-02', 'Supplier Roastery'),
  ('cup plastik',                        8,  250, '2026-09-09', 'Toko kemasan'),
  ('GreenField',                        40, 1000, '2026-09-16', 'Distributor susu'),
  ('Gula',                               5, 1000, '2026-09-16', 'Toko bahan')
) x(material, packs, per_pack, d, note)
join raw_materials rm on rm.name = x.material and rm.unit_price > 0;

-- ------------------------------------------------------------
-- 3. Fixed Cost: pengeluaran rutin, gaji Agustus, kasbon
-- ------------------------------------------------------------
select save_finance_expense(null, jsonb_build_object(
  'expense_type', 'lain', 'name', x.name, 'amount', x.amount, 'expense_date', x.d, 'notes', x.note || ' [contoh]'))
from (values
  ('WiFi',          350000, '2026-08-05', 'Indihome 50 Mbps'),
  ('Gas LPG',       180000, '2026-08-08', '2 tabung 12 kg'),
  ('Listrik',      1200000, '2026-08-20', 'Token PLN'),
  ('Air PDAM',      150000, '2026-08-20', 'Tagihan Juli'),
  ('Iuran Sampah & Keamanan', 100000, '2026-08-25', 'RT setempat'),
  ('WiFi',          350000, '2026-09-05', 'Indihome 50 Mbps'),
  ('Gas LPG',       180000, '2026-09-08', '2 tabung 12 kg'),
  ('Listrik',      1250000, '2026-09-20', 'Token PLN'),
  ('Air PDAM',      160000, '2026-09-20', 'Tagihan Agustus')
) x(name, amount, d, note);

-- Gaji Agustus dibayar 31 Agustus, nominal dari hitungan payroll (gaji bersih)
select save_finance_expense(null, jsonb_build_object(
  'expense_type', 'gaji', 'employee_id', p.employee_id, 'salary_month', '2026-08-01',
  'amount', p.total_salary, 'expense_date', '2026-08-31', 'notes', 'Transfer [contoh]'))
from employee_payroll('2026-08-01', '2026-08-31') p
where p.total_salary > 0;

-- Kasbon bulan ini (dipotong dari gaji September)
insert into kasbon (employee_id, amount, request_date, notes, created_by)
select id, 50000, date '2026-09-12', 'Keperluan mendadak [contoh]', 'a0000000-0000-0000-0000-000000000001'
from employees where full_name = 'Kukuh';

-- ------------------------------------------------------------
-- 4. Net Profit: pembelian aset (memotong BEP)
-- ------------------------------------------------------------
select save_asset(null, jsonb_build_object('name', x.name, 'purchase_price', x.price, 'quantity', x.qty,
                                           'purchase_date', x.d, 'notes', x.note || ' [contoh]'))
from (values
  ('Rak Display Pastry', 450000, 1, '2026-08-12', 'Toko furnitur'),
  ('Grinder Kopi',      4500000, 1, '2026-09-15', 'Pengganti grinder lama')
) x(name, price, qty, d, note);

-- ------------------------------------------------------------
-- 5. Saldo Online: libur & pencairan Midtrans
-- ------------------------------------------------------------
insert into bank_holidays (holiday_date, name) values ('2026-08-17', 'HUT Kemerdekaan RI')
on conflict do nothing;

select record_online_disbursement('2026-08-14', 'Tarik dana Midtrans [contoh]');
select record_online_disbursement('2026-08-28', 'Tarik dana Midtrans [contoh]');
select record_online_disbursement('2026-09-11', 'Tarik dana Midtrans [contoh]');

commit;

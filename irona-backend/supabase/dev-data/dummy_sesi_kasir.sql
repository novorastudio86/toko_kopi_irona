-- ============================================================
-- DATA CONTOH SESI KASIR (untuk Laporan Pendapatan Kasir & Laporan Jam Operasional)
-- Membuat 2 sesi login–logout per hari untuk setiap hari yang punya transaksi DUMMY
-- (sampai kemarin), lalu menautkan transaksi DUMMY ke sesinya:
--   Shift 1: kasir (role Kasir), sekitar jam buka ± beberapa menit s.d. ±16:00
--   Shift 2: Admin/Owner, sekitar 16:00 (kadang ada jeda) s.d. sekitar jam tutup
-- Transaksi sebelum logout shift 1 → sesi 1, sisanya → sesi 2.
-- Jalankan setelah dummy_keuangan.sql. Aman dijalankan ulang (hari yang sudah punya sesi dilewati).
-- Hapus dengan dummy_sesi_kasir_hapus.sql.
-- ============================================================
begin;

do $$
declare
  v_kasir uuid := (select e.id from employees e join roles r on r.id = e.role_id
                   where r.type = 'kasir' and e.is_active order by e.full_name limit 1);
  v_owner uuid := (select e.id from employees e join roles r on r.id = e.role_id
                   where r.type = 'admin' and e.is_active order by e.full_name limit 1);
  d date;
  h record;
  v_open timestamptz;
  v_close timestamptz;
  l1 timestamptz; o1 timestamptz; l2 timestamptz; o2 timestamptz;
  s1 uuid; s2 uuid;
begin
  if v_kasir is null then v_kasir := v_owner; end if;

  for d in
    select distinct (t.transaction_date at time zone 'Asia/Jakarta')::date
    from transactions t
    where t.transaction_number like 'DUMMY-%'
      and (t.transaction_date at time zone 'Asia/Jakarta')::date < jakarta_today()
    order by 1
  loop
    continue when exists (
      select 1 from cashier_sessions cs where (cs.login_at at time zone 'Asia/Jakarta')::date = d
    );

    select coalesce(open_time, '08:00') as open_time, coalesce(close_time, '23:00') as close_time
      into h
    from store_hours where channel = 'offline' and day_of_week = extract(dow from d)::int;

    v_open := (d + h.open_time) at time zone 'Asia/Jakarta';
    v_close := (d + h.close_time) at time zone 'Asia/Jakarta';

    -- Buka: kebanyakan 0–10 menit sebelum jadwal, kadang telat s.d. 25 menit
    l1 := v_open + make_interval(mins => case when random() < 0.8 then -floor(random() * 11)::int
                                             else floor(5 + random() * 21)::int end);
    o1 := ((d + time '16:00') at time zone 'Asia/Jakarta') + make_interval(mins => floor(random() * 11)::int - 5);
    -- Pergantian shift: kebanyakan langsung, kadang ada jeda 5–30 menit
    l2 := o1 + make_interval(mins => case when random() < 0.75 then 0 else floor(5 + random() * 26)::int end);
    -- Tutup: sekitar jadwal, −10 s.d. +15 menit
    o2 := v_close + make_interval(mins => floor(random() * 26)::int - 10);

    insert into cashier_sessions (employee_id, login_at, logout_at, created_at)
    values (v_kasir, l1, o1, l1) returning id into s1;
    insert into cashier_sessions (employee_id, login_at, logout_at, created_at)
    values (v_owner, l2, o2, l2) returning id into s2;

    update transactions t
    set cashier_session_id = case when t.transaction_date < o1 then s1 else s2 end
    where t.transaction_number like 'DUMMY-%'
      and (t.transaction_date at time zone 'Asia/Jakarta')::date = d
      and t.cashier_session_id is null;
  end loop;
end;
$$;

commit;

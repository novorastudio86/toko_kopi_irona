-- ============================================================
-- DATA CONTOH ANTARAN DRIVER (untuk mencoba Driver App tanpa memproses dari kasir)
-- 1. Driver aktif pertama diabsenkan masuk sekarang (kalau belum absen hari ini).
-- 2. 3 pesanan contoh "masuk" (dari dummy_online_masuk.sql) ditugaskan ke driver itu:
--    1 masih Dibuat, 2 Siap Diantar. Stok dipotong seperti alur asli.
-- Jalankan dummy_online_masuk.sql dulu kalau pesanan "masuk" kurang dari 3.
-- Hapus dengan dummy_online_masuk_hapus.sql (ikut menghapus absen contoh ini).
-- ============================================================
do $$
declare
  v_driver uuid := (select e.id from employees e join roles r on r.id = e.role_id
                    where r.type = 'driver' and e.is_active order by e.full_name limit 1);
  v_tx record;
  v_n integer := 0;
begin
  if v_driver is null then
    raise exception 'Belum ada karyawan Driver yang aktif.';
  end if;

  insert into attendance (employee_id, attendance_date, check_in, status, source, notes)
  values (v_driver, current_work_date(), now(), 'hadir', 'manual', '[DUMMY] absen uji antaran')
  on conflict (employee_id, attendance_date) do nothing;

  for v_tx in
    select id from transactions
    where online_status = 'masuk' and customer_email like '%@dummy.irona.test'
    order by transaction_date limit 3
  loop
    v_n := v_n + 1;
    perform apply_online_status(v_tx.id, 'dibuat', null, null);
    insert into deliveries (transaction_id, driver_id, status) values (v_tx.id, v_driver, 'ditugaskan');
    update transactions set driver_id = v_driver where id = v_tx.id;
    insert into online_order_events (transaction_id, status, notes)
    values (v_tx.id, 'driver_ditugaskan', 'Driver: ' || (select full_name from employees where id = v_driver));
    if v_n > 1 then
      perform apply_online_status(v_tx.id, 'siap_diantar', null, null);
    end if;
  end loop;

  if v_n = 0 then
    raise exception 'Tidak ada pesanan contoh berstatus masuk. Jalankan dummy_online_masuk.sql dulu.';
  end if;
end;
$$;

-- ============================================================
-- PIN UJI KARYAWAN (khusus development Kasir/Driver App)
-- Mengisi PIN 123456 untuk semua karyawan aktif ber-role Kasir/Driver yang BELUM punya PIN.
-- PIN yang sudah diatur dari Web Admin tidak diubah. Jangan dijalankan di database produksi.
-- ============================================================
insert into public.employee_pins (employee_id, pin_hash)
select e.id, extensions.crypt('123456', extensions.gen_salt('bf'))
from public.employees e
join public.roles r on r.id = e.role_id
where e.is_active and r.type in ('kasir', 'driver')
on conflict (employee_id) do nothing;

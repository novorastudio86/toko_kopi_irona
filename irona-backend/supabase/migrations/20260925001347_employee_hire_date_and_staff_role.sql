-- ============================================================
-- KARYAWAN: tanggal mulai kerja + tipe role "staf" (tanpa aplikasi)
--
-- - hire_date: tanggal mulai kerja, bisa diedit. Karyawan lama diisi dari tanggal akun dibuat.
--   Gaji tetap penuh per bulan (tidak prorata).
-- - Tipe role 'staf' = tidak login ke aplikasi apa pun, cukup absen lewat kartu QR (mis. Barista).
--   Akunnya tetap ada (employees terhubung ke auth.users) tapi dengan password acak
--   yang tidak diketahui siapa pun, diatur oleh edge function create/update-employee.
-- ============================================================

alter table public.employees
  add column hire_date date;

update public.employees
set hire_date = (created_at at time zone 'Asia/Jakarta')::date
where hire_date is null;

alter table public.employees
  alter column hire_date set not null,
  alter column hire_date set default ((now() at time zone 'Asia/Jakarta')::date);

comment on column public.employees.hire_date is 'Tanggal mulai kerja (diterima kerja), bisa diedit admin';


alter table public.roles
  drop constraint roles_type_check,
  add constraint roles_type_check check (type in ('admin', 'kasir', 'driver', 'staf'));

comment on column public.roles.type is
  'admin = Web Admin, kasir = aplikasi Kasir, driver = aplikasi Driver, staf = tanpa aplikasi (absen QR saja)';

-- Barista tidak memakai aplikasi apa pun
update public.roles set type = 'staf' where lower(name) = 'barista';

-- Karyawan Barista yang sudah ada dulunya bertipe kasir dan masih punya password lama.
-- Ganti dengan password acak supaya akunnya tidak bisa dipakai login lagi.
update auth.users u
set encrypted_password = extensions.crypt(gen_random_uuid()::text || gen_random_uuid()::text, extensions.gen_salt('bf')),
    updated_at = now()
from public.employees e
join public.roles r on r.id = e.role_id
where e.id = u.id
  and r.type = 'staf';

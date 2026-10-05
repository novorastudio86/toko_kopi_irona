-- ============================================================
-- PIN KARYAWAN (login Kasir/Driver App)
--
-- Alur aplikasi Kasir/Driver (keputusan 2026-09-29):
--   1. Owner login sekali per perangkat (akun Admin/Owner, sama seperti Web Admin).
--   2. Pilih peran Kasir / Driver.
--   3. Pilih nama karyawan (role sesuai) + masukkan PIN 6 digit.
--
-- - PIN disimpan terpisah di employee_pins sebagai hash bcrypt. Tabel ini RLS aktif TANPA policy,
--   jadi tidak bisa dibaca/ditulis lewat API sama sekali — hanya lewat fungsi di bawah.
-- - PIN boleh sama antar karyawan.
-- - 5x salah berturut-turut → PIN karyawan itu terkunci 1 menit.
-- ============================================================

create table public.employee_pins (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.employee_pins enable row level security;
revoke all on public.employee_pins from anon, authenticated;

-- ------------------------------------------------------------
-- Web Admin: atur / reset PIN (Daftar Karyawan)
-- ------------------------------------------------------------
create or replace function public.set_employee_pin(p_employee_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur PIN.' using errcode = '42501';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN harus 6 digit angka.';
  end if;
  if not exists (
    select 1 from employees e join roles r on r.id = e.role_id
    where e.id = p_employee_id and r.type in ('kasir', 'driver')
  ) then
    raise exception 'PIN hanya untuk karyawan dengan role Kasir atau Driver.';
  end if;

  insert into employee_pins (employee_id, pin_hash)
  values (p_employee_id, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (employee_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();
end;
$$;

-- Web Admin: karyawan mana saja yang sudah punya PIN
create or replace function public.employee_pin_status()
returns table (employee_id uuid, has_pin boolean, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner.' using errcode = '42501';
  end if;
  return query select p.employee_id, true, p.updated_at from employee_pins p;
end;
$$;

-- ------------------------------------------------------------
-- Kasir/Driver App (perangkat login sebagai Owner)
-- ------------------------------------------------------------

-- Daftar nama untuk dropdown: karyawan aktif dengan role sesuai (tanpa Admin/Owner)
create or replace function public.list_app_employees(p_role_type text)
returns table (employee_id uuid, full_name text, role_name text, has_pin boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;
  if p_role_type not in ('kasir', 'driver') then
    raise exception 'Peran tidak dikenal.';
  end if;
  return query
  select e.id, e.full_name, r.name, p.employee_id is not null
  from employees e
  join roles r on r.id = e.role_id
  left join employee_pins p on p.employee_id = e.id
  where e.is_active and r.type = p_role_type
  order by e.full_name;
end;
$$;

-- Cek PIN. Hasil: { ok, employee_id, full_name, role_type, attempts_left, locked_until }
create or replace function public.verify_employee_pin(
  p_employee_id uuid,
  p_pin text,
  p_role_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp record;
  v_pin record;
  c_max_attempts constant int := 5;
  c_lock constant interval := interval '1 minute';
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;

  select e.id, e.full_name, e.is_active, r.type as role_type into v_emp
  from employees e join roles r on r.id = e.role_id
  where e.id = p_employee_id;

  if v_emp.id is null or not v_emp.is_active or v_emp.role_type <> p_role_type then
    raise exception 'Karyawan tidak ditemukan untuk peran ini.';
  end if;

  select * into v_pin from employee_pins where employee_id = p_employee_id for update;
  if v_pin.employee_id is null then
    raise exception 'PIN karyawan ini belum diatur. Minta Owner mengaturnya di Web Admin.';
  end if;

  if v_pin.locked_until is not null and v_pin.locked_until > now() then
    return jsonb_build_object('ok', false, 'attempts_left', 0, 'locked_until', v_pin.locked_until);
  end if;

  if v_pin.pin_hash = extensions.crypt(coalesce(p_pin, ''), v_pin.pin_hash) then
    update employee_pins set failed_attempts = 0, locked_until = null
    where employee_id = p_employee_id;
    return jsonb_build_object('ok', true, 'employee_id', v_emp.id, 'full_name', v_emp.full_name,
                              'role_type', v_emp.role_type);
  end if;

  -- Salah: tambah hitungan; kunci kalau sudah mencapai batas
  update employee_pins
  set failed_attempts = case when failed_attempts + 1 >= c_max_attempts then 0 else failed_attempts + 1 end,
      locked_until = case when failed_attempts + 1 >= c_max_attempts then now() + c_lock else null end
  where employee_id = p_employee_id
  returning * into v_pin;

  return jsonb_build_object(
    'ok', false,
    'attempts_left', case when v_pin.locked_until is not null then 0
                          else c_max_attempts - v_pin.failed_attempts end,
    'locked_until', v_pin.locked_until);
end;
$$;

revoke execute on function public.set_employee_pin(uuid, text) from public, anon;
revoke execute on function public.employee_pin_status() from public, anon;
revoke execute on function public.list_app_employees(text) from public, anon;
revoke execute on function public.verify_employee_pin(uuid, text, text) from public, anon;

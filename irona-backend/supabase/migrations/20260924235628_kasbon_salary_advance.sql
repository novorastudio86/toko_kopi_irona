-- ============================================================
-- KASBON = GAJI DIBAYAR DI MUKA
--
-- Aturan (disepakati dengan owner, merevisi PRD yang memakai cicilan):
-- - Kasbon dipotong SEKALIGUS dari gaji bulan yang sama dengan tanggal pengajuan.
-- - Tidak ada cicilan / tombol "Potong Bulan Ini".
-- - Total kasbon seorang karyawan dalam satu bulan tidak boleh melebihi gaji pokoknya.
-- - Admin bisa menandai "Lunas Tunai" (karyawan mengembalikan tunai) sehingga tidak dipotong gaji.
-- - Ubah / Lunasi Tunai / Hapus hanya selama bulan pengajuan belum lewat.
-- - Status dihitung otomatis:
--     berjalan    = bulan pengajuan = bulan ini, akan dipotong dari gaji bulan ini
--     lunas_gaji  = bulan pengajuan sudah lewat (sudah dipotong gaji)
--     lunas_tunai = dikembalikan tunai
-- ============================================================


-- ------------------------------------------------------------
-- 1. Struktur tabel
-- ------------------------------------------------------------
-- remaining_amount & status tidak dipakai lagi (tidak ada cicilan; status dihitung otomatis).
-- Tabel masih kosong, jadi aman dihapus.
alter table public.kasbon
  drop column remaining_amount,
  drop column status,
  add column request_date date not null default ((now() at time zone 'Asia/Jakarta')::date),
  add column notes text,
  add column created_by uuid references public.employees(id) default auth.uid(),
  add column settled_cash_at timestamptz,
  add column settled_cash_by uuid references public.employees(id),
  add constraint kasbon_amount_positive check (amount > 0);

create index kasbon_employee_month_idx on public.kasbon (employee_id, request_date);


-- ------------------------------------------------------------
-- 2. Daftar kasbon + status otomatis (dipakai layar Kasbon)
-- ------------------------------------------------------------
create or replace function public.jakarta_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;

create or replace view public.kasbon_overview
with (security_invoker = true)
as
select
  k.id,
  k.employee_id,
  e.full_name as employee_name,
  e.username,
  r.name as role_name,
  k.amount,
  k.request_date,
  date_trunc('month', k.request_date)::date as deduct_month,
  k.notes,
  k.created_at,
  c.full_name as created_by_name,
  k.settled_cash_at,
  s.full_name as settled_cash_by_name,
  case
    when k.settled_cash_at is not null then 'lunas_tunai'
    when date_trunc('month', k.request_date) < date_trunc('month', public.jakarta_today()) then 'lunas_gaji'
    else 'berjalan'
  end as status
from public.kasbon k
join public.employees e on e.id = k.employee_id
join public.roles r on r.id = e.role_id
left join public.employees c on c.id = k.created_by
left join public.employees s on s.id = k.settled_cash_by;


-- ------------------------------------------------------------
-- 3. Kuota kasbon: gaji pokok, sudah terpakai bulan itu, dan sisa yang bisa diajukan
-- ------------------------------------------------------------
create or replace function public.kasbon_quota(
  p_employee_id uuid,
  p_request_date date,
  p_exclude_id uuid default null
)
returns table (base_salary numeric, used_amount numeric, remaining_amount numeric)
language sql
stable
set search_path = public
as $$
  with used as (
    select coalesce(sum(k.amount), 0) as total
    from kasbon k
    where k.employee_id = p_employee_id
      and k.settled_cash_at is null
      and date_trunc('month', k.request_date) = date_trunc('month', p_request_date)
      and (p_exclude_id is null or k.id <> p_exclude_id)
  )
  select e.base_salary, used.total, greatest(0, e.base_salary - used.total)
  from employees e, used
  where e.id = p_employee_id;
$$;


-- Validasi bersama untuk tambah & ubah
create or replace function public.assert_valid_kasbon(
  p_employee_id uuid,
  p_amount numeric,
  p_request_date date,
  p_exclude_id uuid default null
)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_employee record;
  v_quota record;
  v_today date := jakarta_today();
begin
  select e.full_name, e.is_active, r.type as role_type into v_employee
  from employees e join roles r on r.id = e.role_id
  where e.id = p_employee_id;

  if v_employee.full_name is null then
    raise exception 'Karyawan tidak ditemukan.';
  end if;
  if not v_employee.is_active then
    raise exception '% sudah nonaktif, tidak bisa mengajukan kasbon.', v_employee.full_name;
  end if;
  if v_employee.role_type = 'admin' then
    raise exception 'Admin/Owner tidak bisa mengajukan kasbon.';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Jumlah kasbon harus lebih dari 0.';
  end if;
  if p_request_date is null then
    raise exception 'Tanggal pengajuan wajib diisi.';
  end if;
  if date_trunc('month', p_request_date) <> date_trunc('month', v_today) then
    raise exception 'Tanggal pengajuan harus di bulan ini (%), karena kasbon dipotong dari gaji bulan pengajuan.',
      to_char(v_today, 'MM/YYYY');
  end if;
  if p_request_date > v_today then
    raise exception 'Tanggal pengajuan tidak boleh melewati hari ini.';
  end if;

  select * into v_quota from kasbon_quota(p_employee_id, p_request_date, p_exclude_id);

  if v_quota.base_salary <= 0 then
    raise exception 'Gaji pokok % belum diatur, kasbon tidak bisa diajukan.', v_employee.full_name;
  end if;
  if p_amount > v_quota.remaining_amount then
    raise exception 'Kasbon melebihi gaji pokok bulan ini. Gaji pokok Rp%, sudah kasbon Rp%, sisa yang bisa diajukan Rp%.',
      replace(to_char(v_quota.base_salary, 'FM999G999G999G999'), ',', '.'),
      replace(to_char(v_quota.used_amount, 'FM999G999G999G999'), ',', '.'),
      replace(to_char(v_quota.remaining_amount, 'FM999G999G999G999'), ',', '.');
  end if;
end;
$$;

-- Kasbon hanya bisa diubah/dilunasi/dihapus selama masih "berjalan". Mengembalikan employee_id.
create or replace function public.assert_kasbon_open(p_id uuid)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_row record;
begin
  select * into v_row from kasbon_overview where id = p_id;
  if v_row.id is null then
    raise exception 'Data kasbon tidak ditemukan.';
  end if;
  if v_row.status = 'lunas_tunai' then
    raise exception 'Kasbon ini sudah dilunasi tunai.';
  end if;
  if v_row.status = 'lunas_gaji' then
    raise exception 'Kasbon ini sudah dipotong dari gaji % dan tidak bisa diubah lagi.',
      to_char(v_row.deduct_month, 'MM/YYYY');
  end if;
  return v_row.employee_id;
end;
$$;


-- ------------------------------------------------------------
-- 4. Aksi
-- ------------------------------------------------------------
create or replace function public.create_kasbon(
  p_employee_id uuid,
  p_amount numeric,
  p_request_date date,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mencatat kasbon.' using errcode = '42501';
  end if;

  perform assert_valid_kasbon(p_employee_id, p_amount, p_request_date);

  insert into kasbon (employee_id, amount, request_date, notes)
  values (p_employee_id, p_amount, p_request_date, nullif(trim(p_notes), ''))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_kasbon(
  p_id uuid,
  p_amount numeric,
  p_request_date date,
  p_notes text default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_employee_id uuid;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengubah kasbon.' using errcode = '42501';
  end if;

  v_employee_id := assert_kasbon_open(p_id);
  perform assert_valid_kasbon(v_employee_id, p_amount, p_request_date, p_id);

  update kasbon set
    amount = p_amount,
    request_date = p_request_date,
    notes = nullif(trim(p_notes), '')
  where id = p_id;
end;
$$;

create or replace function public.settle_kasbon_cash(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh melunasi kasbon.' using errcode = '42501';
  end if;

  perform assert_kasbon_open(p_id);

  update kasbon set settled_cash_at = now(), settled_cash_by = auth.uid() where id = p_id;
end;
$$;

create or replace function public.delete_kasbon(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menghapus kasbon.' using errcode = '42501';
  end if;

  perform assert_kasbon_open(p_id);

  delete from kasbon where id = p_id;
end;
$$;


-- ------------------------------------------------------------
-- 5. Gaji: kasbon mengurangi gaji di bulan pengajuan
--    total_salary sekarang = gaji BERSIH (gross_salary − kasbon_total)
-- ------------------------------------------------------------
drop function if exists public.employee_payroll(date, date);

create or replace function public.employee_payroll(p_start date, p_end date)
returns table (
  employee_id uuid,
  base_salary numeric,
  delivery_rate numeric,
  delivery_count bigint,
  delivery_bonus_total numeric,
  regular_hours numeric,
  hourly_rate numeric,
  overtime_minutes bigint,
  overtime_bonus_total numeric,
  extra_shift_minutes bigint,
  extra_shift_bonus_total numeric,
  bonus_total numeric,
  kasbon_count bigint,
  kasbon_total numeric,
  gross_salary numeric,
  total_salary numeric
)
language sql
stable
set search_path = public
as $$
  with delivery_agg as (
    select
      d.driver_id as id,
      count(*) as delivery_count,
      coalesce(sum(d.bonus_amount), 0) as delivery_bonus_total
    from deliveries d
    where d.status = 'selesai'
      and (d.completed_at at time zone 'Asia/Jakarta')::date between p_start and p_end
    group by d.driver_id
  ),
  attendance_agg as (
    select
      a.employee_id as id,
      coalesce(sum(a.overtime_minutes), 0) as overtime_minutes,
      coalesce(sum(a.extra_shift_minutes), 0) as extra_shift_minutes
    from attendance a
    where a.attendance_date between p_start and p_end
    group by a.employee_id
  ),
  kasbon_agg as (
    select
      k.employee_id as id,
      count(*) as kasbon_count,
      coalesce(sum(k.amount), 0) as kasbon_total
    from kasbon k
    where k.settled_cash_at is null
      and k.request_date between p_start and p_end
    group by k.employee_id
  ),
  base as (
    select
      e.id,
      e.base_salary,
      e.delivery_bonus,
      coalesce(da.delivery_count, 0) as delivery_count,
      coalesce(da.delivery_bonus_total, 0) as delivery_bonus_total,
      coalesce(aa.overtime_minutes, 0) as overtime_minutes,
      coalesce(aa.extra_shift_minutes, 0) as extra_shift_minutes,
      coalesce(ka.kasbon_count, 0) as kasbon_count,
      coalesce(ka.kasbon_total, 0) as kasbon_total,
      -- Jaring pengaman kalau belum ada jadwal sama sekali: 26 hari × 7,5 jam
      coalesce(nullif(employee_regular_hours(e.id, p_start), 0), 26 * 7.5) as regular_hours
    from employees e
    left join delivery_agg da on da.id = e.id
    left join attendance_agg aa on aa.id = e.id
    left join kasbon_agg ka on ka.id = e.id
  ),
  priced as (
    select
      b.*,
      round(b.base_salary / b.regular_hours, 2) as hourly_rate,
      round(b.base_salary / b.regular_hours * b.overtime_minutes / 60.0, 2) as overtime_bonus_total,
      round(b.base_salary / b.regular_hours * b.extra_shift_minutes / 60.0, 2) as extra_shift_bonus_total
    from base b
  ),
  totals as (
    select
      p.*,
      p.delivery_bonus_total + p.overtime_bonus_total + p.extra_shift_bonus_total as bonus_total,
      p.base_salary + p.delivery_bonus_total + p.overtime_bonus_total + p.extra_shift_bonus_total as gross_salary
    from priced p
  )
  select
    t.id,
    t.base_salary,
    t.delivery_bonus,
    t.delivery_count,
    t.delivery_bonus_total,
    round(t.regular_hours, 2),
    t.hourly_rate,
    t.overtime_minutes,
    t.overtime_bonus_total,
    t.extra_shift_minutes,
    t.extra_shift_bonus_total,
    t.bonus_total,
    t.kasbon_count,
    t.kasbon_total,
    t.gross_salary,
    t.gross_salary - t.kasbon_total
  from totals t;
$$;

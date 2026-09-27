-- ============================================================
-- SHIFT KERJA v2 — pola mingguan otomatis, jam khusus toko,
-- dan pengecualian per karyawan (tukar shift / libur mendadak)
-- ============================================================

-- Pola mingguan tetap per karyawan: hari apa dapat shift apa (berulang otomatis).
-- day_of_week: 0 = Minggu ... 6 = Sabtu (sama dengan EXTRACT(DOW) Postgres & Date.getDay() JS)
create table if not exists public.employee_shift_defaults (
  employee_id uuid not null references public.employees(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  shift_pattern_id uuid references public.shift_patterns(id), -- null = Libur
  primary key (employee_id, day_of_week)
);

alter table public.employee_shift_defaults enable row level security;
create policy "shift_defaults_select" on public.employee_shift_defaults for select to authenticated using (true);
create policy "shift_defaults_admin_write" on public.employee_shift_defaults for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Jam khusus toko di satu tanggal (mis. Sabtu buka lebih pagi).
-- Berlaku untuk SEMUA karyawan yang kebagian shift itu hari itu, bukan per orang.
create table if not exists public.shift_date_overrides (
  id uuid primary key default gen_random_uuid(),
  override_date date not null,
  shift_pattern_id uuid not null references public.shift_patterns(id),
  start_time time not null,
  end_time time not null,
  note text,
  created_at timestamptz not null default now(),
  unique (override_date, shift_pattern_id)
);

alter table public.shift_date_overrides enable row level security;
create policy "shift_overrides_select" on public.shift_date_overrides for select to authenticated using (true);
create policy "shift_overrides_admin_write" on public.shift_date_overrides for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- shift_schedules dipakai ulang sebagai pengecualian PER KARYAWAN per tanggal:
-- shift_pattern_id null = Libur; swap_with_employee_id diisi kalau hasil Tukar Shift.
alter table public.shift_schedules
  alter column shift_pattern_id drop not null,
  add column if not exists swap_with_employee_id uuid references public.employees(id),
  add column if not exists note text;

-- Shift efektif seorang karyawan di satu tanggal, sudah mempertimbangkan urutan:
-- pengecualian tanggal (tukar/libur) > pola mingguan default > tidak ada jadwal.
create or replace function public.get_effective_shift(p_employee_id uuid, p_date date)
returns table (
  has_schedule boolean,
  is_libur boolean,
  shift_pattern_id uuid,
  shift_name text,
  start_time time,
  end_time time,
  is_swap boolean,
  swap_with_employee_id uuid,
  swap_with_name text
)
language plpgsql
stable
as $$
declare
  v_has_exception boolean := false;
  v_has_schedule boolean := false;
  v_pattern_id uuid;
  v_swap_id uuid;
  v_dow int := extract(dow from p_date)::int;
begin
  select true, ss.shift_pattern_id, ss.swap_with_employee_id
    into v_has_exception, v_pattern_id, v_swap_id
  from public.shift_schedules ss
  where ss.employee_id = p_employee_id and ss.schedule_date = p_date;

  if v_has_exception then
    v_has_schedule := true;
  else
    v_swap_id := null;
    select true, esd.shift_pattern_id
      into v_has_schedule, v_pattern_id
    from public.employee_shift_defaults esd
    where esd.employee_id = p_employee_id and esd.day_of_week = v_dow;
  end if;

  if not v_has_schedule then
    return query select false, false, null::uuid, null::text, null::time, null::time, false, null::uuid, null::text;
    return;
  end if;

  if v_pattern_id is null then
    return query
      select true, true, null::uuid, null::text, null::time, null::time,
             v_swap_id is not null, v_swap_id, e.full_name
      from (select v_swap_id) s
      left join public.employees e on e.id = v_swap_id;
    return;
  end if;

  return query
    select
      true, false, sp.id, sp.name,
      coalesce(sdo.start_time, sp.start_time),
      coalesce(sdo.end_time, sp.end_time),
      v_swap_id is not null, v_swap_id, e2.full_name
    from public.shift_patterns sp
    left join public.shift_date_overrides sdo
      on sdo.shift_pattern_id = sp.id and sdo.override_date = p_date
    left join public.employees e2 on e2.id = v_swap_id
    where sp.id = v_pattern_id;
end;
$$;

-- Shift semua karyawan aktif (non-admin) di satu tanggal — dipakai tabel utama Shift Kerja.
create or replace function public.list_employee_shifts(p_date date)
returns table (
  employee_id uuid,
  full_name text,
  username text,
  role_name text,
  has_schedule boolean,
  is_libur boolean,
  shift_pattern_id uuid,
  shift_name text,
  start_time time,
  end_time time,
  is_swap boolean,
  swap_with_name text
)
language sql
stable
as $$
  select
    e.id, e.full_name, e.username, r.name,
    eff.has_schedule, eff.is_libur, eff.shift_pattern_id, eff.shift_name,
    eff.start_time, eff.end_time, eff.is_swap, eff.swap_with_name
  from public.employees e
  join public.roles r on r.id = e.role_id
  cross join lateral public.get_effective_shift(e.id, p_date) eff
  where e.is_active and r.type <> 'admin'
  order by e.full_name;
$$;

-- record_attendance_scan sekarang wajib ada jadwal (bukan lagi menebak dari jam),
-- dan scan Masuk dibatasi jendela [jam_mulai - 1 jam, jam_selesai].
create or replace function public.record_attendance_scan(p_qr_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee record;
  v_now timestamptz := now();
  v_now_local timestamp := (v_now at time zone 'Asia/Jakarta');
  v_effective_date date;
  v_time time := v_now_local::time;
  v_existing record;
  v_eff record;
  v_shift_end time;
  v_window_open time;
  v_late int := 0;
  v_overtime int := 0;
begin
  select id, full_name, is_active into v_employee
  from public.employees where qr_token = p_qr_token;

  if v_employee.id is null then
    raise exception 'QR tidak dikenali.';
  end if;
  if not v_employee.is_active then
    raise exception 'Akun karyawan ini nonaktif, tidak bisa absen.';
  end if;

  if v_time < '03:00' then
    v_effective_date := (v_now_local::date) - 1;
  else
    v_effective_date := v_now_local::date;
  end if;

  select * into v_existing from public.attendance
  where employee_id = v_employee.id and attendance_date = v_effective_date;

  if v_existing.id is null then
    select * into v_eff from public.get_effective_shift(v_employee.id, v_effective_date);

    if not v_eff.has_schedule then
      raise exception '% belum punya jadwal shift hari ini. Hubungi admin untuk mengatur jadwal di Shift Kerja.', v_employee.full_name;
    end if;
    if v_eff.is_libur then
      raise exception '% terjadwal Libur hari ini.', v_employee.full_name;
    end if;

    v_window_open := v_eff.start_time - interval '1 hour';
    if v_time < v_window_open or v_time > v_eff.end_time then
      raise exception '% terjadwal shift % (%–%). Absen masuk hanya bisa dilakukan mulai %.',
        v_employee.full_name, v_eff.shift_name,
        to_char(v_eff.start_time, 'HH24:MI'), to_char(v_eff.end_time, 'HH24:MI'),
        to_char(v_window_open, 'HH24:MI');
    end if;

    v_late := greatest(0, extract(epoch from (v_time - v_eff.start_time)) / 60)::int;

    insert into public.attendance
      (employee_id, attendance_date, check_in, shift, late_minutes, status, source)
    values
      (v_employee.id, v_effective_date, v_now, lower(v_eff.shift_name), v_late,
       case when v_late > 0 then 'telat' else 'hadir' end, 'qr');

    return jsonb_build_object(
      'employee_name', v_employee.full_name, 'action', 'masuk',
      'shift', lower(v_eff.shift_name), 'late_minutes', v_late
    );
  end if;

  if v_existing.check_out is not null then
    raise exception '% sudah absen masuk dan pulang hari ini.', v_employee.full_name;
  end if;

  select * into v_eff from public.get_effective_shift(v_employee.id, v_existing.attendance_date);
  v_shift_end := coalesce(v_eff.end_time, case when v_existing.shift = 'pagi' then '16:00'::time else '23:00'::time end);

  if v_now_local > (v_existing.attendance_date + 1) + v_shift_end then
    v_overtime := extract(epoch from (
      v_now_local - ((v_existing.attendance_date + 1)::timestamp + v_shift_end)
    )) / 60;
  elsif v_now_local::time > v_shift_end and v_now_local::date = v_existing.attendance_date then
    v_overtime := extract(epoch from (v_now_local::time - v_shift_end)) / 60;
  end if;

  update public.attendance
  set check_out = v_now, overtime_minutes = greatest(0, v_overtime)::int
  where id = v_existing.id;

  return jsonb_build_object(
    'employee_name', v_employee.full_name, 'action', 'pulang',
    'shift', v_existing.shift, 'overtime_minutes', greatest(0, v_overtime)::int
  );
end;
$$;
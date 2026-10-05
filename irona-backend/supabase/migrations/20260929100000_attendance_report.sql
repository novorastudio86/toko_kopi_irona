-- ============================================================
-- LAPORAN ABSENSI (Laporan Karyawan)
--
-- Satu baris per karyawan per hari kerja di rentang laporan:
-- - Hari kerja = hari yang terjadwal di Shift Kerja (effective_shift_slots) ATAU punya presensi.
-- - Status harian: masuk (hadir) / telat / izin / tidak_masuk.
--   Terjadwal tapi tanpa presensi = tidak_masuk, kecuali hari ini (masih bisa absen).
-- - Hanya karyawan aktif non-admin, dan hanya sejak tanggal mulai kerja (hire_date).
-- ============================================================

create or replace function public.attendance_report_days(p_start date, p_end date)
returns table (
  employee_id uuid,
  day date,
  status text,          -- 'masuk' | 'telat' | 'izin' | 'tidak_masuk'
  scheduled boolean,
  shift text,
  check_in timestamptz,
  check_out timestamptz,
  late_minutes integer,
  source text,
  notes text
)
language sql
stable
set search_path = public
as $$
  with emp as (
    select e.id, e.hire_date
    from employees e
    join roles r on r.id = e.role_id
    where e.is_active and r.type <> 'admin'
  ), sched as (
    select s.employee_id, s.slot_date as day, string_agg(s.shift_name, ' + ' order by s.start_time) as shift
    from effective_shift_slots(p_start, least(p_end, jakarta_today())) s
    group by s.employee_id, s.slot_date
  ), days as (
    select coalesce(a.employee_id, s.employee_id) as employee_id,
           coalesce(a.attendance_date, s.day) as day,
           s.day is not null as scheduled,
           coalesce(a.shift, s.shift) as shift,
           a.status as att_status, a.check_in, a.check_out, a.late_minutes, a.source, a.notes
    from sched s
    full join (
      select * from attendance where attendance_date between p_start and p_end
    ) a on a.employee_id = s.employee_id and a.attendance_date = s.day
  )
  select d.employee_id, d.day,
         case
           when d.att_status = 'hadir' then 'masuk'
           when d.att_status is null then 'tidak_masuk'
           else d.att_status
         end,
         d.scheduled, d.shift, d.check_in, d.check_out, coalesce(d.late_minutes, 0), d.source, d.notes
  from days d
  join emp on emp.id = d.employee_id
  where d.day >= emp.hire_date
    -- Hari ini belum absen = belum dihitung tidak masuk
    and not (d.att_status is null and d.day >= jakarta_today());
$$;

-- Rekap per karyawan
create or replace function public.report_attendance(p_start date, p_end date)
returns table (
  employee_id uuid,
  full_name text,
  role_name text,
  total_masuk bigint,
  total_izin bigint,
  total_tidak_masuk bigint,
  total_telat bigint,
  late_minutes bigint,
  work_days bigint
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh melihat laporan.' using errcode = '42501';
  end if;
  return query
  select e.id, e.full_name, r.name,
         count(d.day) filter (where d.status in ('masuk', 'telat')),
         count(d.day) filter (where d.status = 'izin'),
         count(d.day) filter (where d.status = 'tidak_masuk'),
         count(d.day) filter (where d.status = 'telat'),
         coalesce(sum(d.late_minutes), 0)::bigint,
         count(d.day)
  from employees e
  join roles r on r.id = e.role_id
  left join attendance_report_days(p_start, p_end) d on d.employee_id = e.id
  where e.is_active and r.type <> 'admin'
  group by e.id, e.full_name, r.name
  order by e.full_name;
end;
$$;

-- Rincian harian satu karyawan
create or replace function public.report_attendance_detail(p_employee_id uuid, p_start date, p_end date)
returns table (
  employee_id uuid, day date, status text, scheduled boolean, shift text,
  check_in timestamptz, check_out timestamptz, late_minutes integer, source text, notes text
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh melihat laporan.' using errcode = '42501';
  end if;
  return query
  select * from attendance_report_days(p_start, p_end) d
  where d.employee_id = p_employee_id
  order by d.day desc;
end;
$$;

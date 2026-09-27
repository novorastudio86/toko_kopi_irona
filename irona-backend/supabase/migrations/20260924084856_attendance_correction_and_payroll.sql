-- ============================================================
-- KOREKSI PRESENSI + GAJI DENGAN JAM KERJA DARI JADWAL SHIFT
-- ============================================================

-- Siapa yang mengoreksi presensi, supaya beda dari hasil scan asli
alter table public.attendance
  add column if not exists corrected_by uuid references public.employees(id),
  add column if not exists corrected_at timestamptz;

-- Admin mengoreksi jam masuk/pulang satu baris presensi.
-- Telat & lembur dihitung ulang otomatis dari jam yang dikoreksi.
drop function if exists public.employee_payroll(date, date);
create or replace function public.correct_attendance(
  p_attendance_id uuid,
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_reason text
)
returns void
language plpgsql
security invoker
as $$
declare
  v_row record;
  v_shift_start time;
  v_shift_end time;
  v_late int := 0;
  v_overtime int := 0;
  v_in_local timestamp;
  v_out_local timestamp;
begin
  if not public.is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengoreksi presensi.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Alasan koreksi wajib diisi.';
  end if;
  if p_check_out is not null and p_check_out <= p_check_in then
    raise exception 'Jam pulang harus setelah jam masuk.';
  end if;

  select * into v_row from public.attendance where id = p_attendance_id;
  if v_row.id is null then
    raise exception 'Data presensi tidak ditemukan.';
  end if;

  v_shift_start := case when v_row.shift = 'pagi' then '08:00'::time else '16:00'::time end;
  v_shift_end := case when v_row.shift = 'pagi' then '16:00'::time else '23:00'::time end;

  v_in_local := p_check_in at time zone 'Asia/Jakarta';
  v_late := greatest(0, extract(epoch from (v_in_local::time - v_shift_start)) / 60)::int;

  if p_check_out is not null then
    v_out_local := p_check_out at time zone 'Asia/Jakarta';
    if v_out_local::date > v_in_local::date then
      v_overtime := extract(epoch from (
        v_out_local - ((v_in_local::date + 1)::timestamp + v_shift_end)
      )) / 60;
    elsif v_out_local::time > v_shift_end then
      v_overtime := extract(epoch from (v_out_local::time - v_shift_end)) / 60;
    end if;
  end if;

  update public.attendance set
    check_in = p_check_in,
    check_out = p_check_out,
    late_minutes = v_late,
    overtime_minutes = greatest(0, v_overtime)::int,
    status = case when v_late > 0 then 'telat' else 'hadir' end,
    source = 'manual',
    notes = p_reason,
    corrected_by = auth.uid(),
    corrected_at = now()
  where id = p_attendance_id;
end;
$$;

-- Total jam kerja seorang karyawan dalam satu periode, dari jadwal Shift Kerja
-- (Pagi = 8 jam, Sore = 7 jam). Jaring pengaman 26 hari campuran kalau belum ada jadwal sama sekali.
create or replace function public.employee_scheduled_hours(p_employee_id uuid, p_start date, p_end date)
returns numeric
language sql
stable
as $$
  select coalesce(
    nullif(
      sum(extract(epoch from (sp.end_time - sp.start_time)) / 3600),
      0
    ),
    26 * 7.5  -- jaring pengaman: 26 hari, rata-rata 7,5 jam (campuran Pagi/Sore)
  )
  from public.shift_schedules ss
  join public.shift_patterns sp on sp.id = ss.shift_pattern_id
  where ss.employee_id = p_employee_id
    and ss.schedule_date between p_start and p_end;
$$;

-- Rincian gaji per karyawan dalam satu periode.
-- bonus_total sekarang gabungan: bonus antar (driver) + bonus lembur (semua role).
create or replace function public.employee_payroll(p_start date, p_end date)
returns table (
  employee_id     uuid,
  base_salary     numeric,
  delivery_rate   numeric,
  delivery_count  bigint,
  delivery_bonus_total numeric,
  overtime_minutes bigint,
  hourly_rate     numeric,
  overtime_bonus_total numeric,
  bonus_total     numeric,
  total_salary    numeric
)
language sql
stable
as $$
  with delivery_agg as (
    select
      e.id,
      count(d.id) as delivery_count,
      coalesce(sum(d.bonus_amount), 0) as delivery_bonus_total
    from public.employees e
    left join public.deliveries d
      on d.driver_id = e.id
     and d.status = 'selesai'
     and d.completed_at::date between p_start and p_end
    group by e.id
  ),
  overtime_agg as (
    select
      employee_id,
      coalesce(sum(overtime_minutes), 0) as overtime_minutes
    from public.attendance
    where attendance_date between p_start and p_end
    group by employee_id
  )
  select
    e.id,
    e.base_salary,
    e.delivery_bonus,
    coalesce(da.delivery_count, 0),
    coalesce(da.delivery_bonus_total, 0),
    coalesce(oa.overtime_minutes, 0),
    round(e.base_salary / nullif(public.employee_scheduled_hours(e.id, p_start, p_end), 0), 2),
    round(
      (e.base_salary / nullif(public.employee_scheduled_hours(e.id, p_start, p_end), 0))
      * (coalesce(oa.overtime_minutes, 0) / 60.0),
      2
    ),
    coalesce(da.delivery_bonus_total, 0) + round(
      (e.base_salary / nullif(public.employee_scheduled_hours(e.id, p_start, p_end), 0))
      * (coalesce(oa.overtime_minutes, 0) / 60.0),
      2
    ),
    e.base_salary + coalesce(da.delivery_bonus_total, 0) + round(
      (e.base_salary / nullif(public.employee_scheduled_hours(e.id, p_start, p_end), 0))
      * (coalesce(oa.overtime_minutes, 0) / 60.0),
      2
    )
  from public.employees e
  left join delivery_agg da on da.id = e.id
  left join overtime_agg oa on oa.employee_id = e.id;
$$;
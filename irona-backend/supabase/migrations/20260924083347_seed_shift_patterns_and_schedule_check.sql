-- Seed dua pola shift tetap sesuai jam operasional
insert into public.shift_patterns (name, start_time, end_time)
select 'Pagi', '08:00', '16:00'
where not exists (select 1 from public.shift_patterns where name = 'Pagi');

insert into public.shift_patterns (name, start_time, end_time)
select 'Sore', '16:00', '23:00'
where not exists (select 1 from public.shift_patterns where name = 'Sore');

-- Fungsi dipanggil halaman Scan Absensi setiap kartu QR dipindai.
-- Cek jadwal resmi dulu; kalau tidak ada, baru menebak dari jam scan.
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
  v_shift text;
  v_shift_start time;
  v_shift_end time;
  v_late int := 0;
  v_overtime int := 0;
  v_scheduled record;
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
    select sp.name, sp.start_time, sp.end_time into v_scheduled
    from public.shift_schedules ss
    join public.shift_patterns sp on sp.id = ss.shift_pattern_id
    where ss.employee_id = v_employee.id and ss.schedule_date = v_effective_date;

    if v_scheduled.name is not null then
      v_shift := lower(v_scheduled.name);
      v_shift_start := v_scheduled.start_time;
      v_shift_end := v_scheduled.end_time;
    elsif v_time < '12:00' then
      v_shift := 'pagi'; v_shift_start := '08:00'; v_shift_end := '16:00';
    else
      v_shift := 'sore'; v_shift_start := '16:00'; v_shift_end := '23:00';
    end if;

    v_late := greatest(0, extract(epoch from (v_time - v_shift_start)) / 60)::int;

    insert into public.attendance
      (employee_id, attendance_date, check_in, shift, late_minutes, status, source)
    values
      (v_employee.id, v_effective_date, v_now, v_shift, v_late,
       case when v_late > 0 then 'telat' else 'hadir' end, 'qr');

    return jsonb_build_object(
      'employee_name', v_employee.full_name, 'action', 'masuk',
      'shift', v_shift, 'late_minutes', v_late
    );
  end if;

  if v_existing.check_out is not null then
    raise exception '% sudah absen masuk dan pulang hari ini.', v_employee.full_name;
  end if;

  v_shift_end := case when v_existing.shift = 'pagi' then '16:00'::time else '23:00'::time end;

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
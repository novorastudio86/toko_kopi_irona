-- Presensi manual untuk karyawan yang lupa scan sama sekali di hari itu.
-- Beda dari correct_attendance (yang membetulkan baris yang sudah ada),
-- ini membuat baris baru dari nol.
create or replace function public.create_manual_attendance(
  p_employee_id uuid,
  p_attendance_date date,
  p_shift text,
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_reason text
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_shift_start time;
  v_shift_end time;
  v_late int := 0;
  v_overtime int := 0;
  v_in_local timestamp;
  v_out_local timestamp;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menambah presensi manual.' using errcode = '42501';
  end if;
  if p_shift not in ('pagi', 'sore') then
    raise exception 'Shift tidak valid.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Alasan wajib diisi.';
  end if;
  if exists (
    select 1 from public.attendance
    where employee_id = p_employee_id and attendance_date = p_attendance_date
  ) then
    raise exception 'Presensi tanggal ini sudah ada. Gunakan Koreksi, bukan Tambah Manual.';
  end if;

  v_shift_start := case when p_shift = 'pagi' then '08:00'::time else '16:00'::time end;
  v_shift_end := case when p_shift = 'pagi' then '16:00'::time else '23:00'::time end;

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

  insert into public.attendance
    (employee_id, attendance_date, check_in, check_out, shift, late_minutes, overtime_minutes,
     status, source, notes, corrected_by, corrected_at)
  values
    (p_employee_id, p_attendance_date, p_check_in, p_check_out, p_shift, v_late, greatest(0, v_overtime)::int,
     case when v_late > 0 then 'telat' else 'hadir' end, 'manual', p_reason, auth.uid(), now())
  returning id into v_id;

  return v_id;
end;
$$;
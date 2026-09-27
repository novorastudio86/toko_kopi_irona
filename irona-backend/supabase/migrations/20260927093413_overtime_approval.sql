-- ============================================================
-- PRESENSI: PERSETUJUAN LEMBUR
--
-- - Lembur PAGI (kerja sebelum jam buka karena Jam Khusus) → otomatis disetujui (direncanakan admin).
-- - Lembur MALAM (lewat jam tutup, shift penutup) → "Menunggu persetujuan"; admin bisa
--   Setujui penuh / Setujui sebagian (menit) / Tolak.
-- - attendance.overtime_minutes = lembur yang DIBAYAR = pagi + malam yang disetujui
--   (payroll tetap membaca kolom ini). Dihitung trigger.
-- - Kalau menit lembur malam berubah (koreksi jam pulang/shift), persetujuan direset ke menunggu.
-- - Dihitung per menit; tarif per menit = tarif per jam ÷ 60.
-- ============================================================

alter table public.attendance
  add column overtime_morning_minutes integer not null default 0,
  add column overtime_night_minutes integer not null default 0,
  add column overtime_status text not null default 'none'
    check (overtime_status in ('none', 'pending', 'approved', 'rejected')),
  add column overtime_approved_minutes integer not null default 0 check (overtime_approved_minutes >= 0),
  add column overtime_reviewed_by uuid references public.employees(id),
  add column overtime_reviewed_at timestamptz,
  add column overtime_review_note text;

comment on column public.attendance.overtime_minutes is
  'Lembur yang dibayar (menit) = lembur pagi + lembur malam yang disetujui';

drop function public.calc_attendance_minutes(date, uuid[], timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.calc_attendance_minutes(p_date date, p_shift_pattern_ids uuid[], p_check_in timestamp with time zone, p_check_out timestamp with time zone)
 RETURNS TABLE(shift_label text, late_minutes integer, overtime_minutes integer, extra_shift_minutes integer, overtime_morning_minutes integer, overtime_night_minutes integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_open time;
  v_close time;
  v_in timestamp := p_check_in at time zone 'Asia/Jakarta';
  v_out timestamp := p_check_out at time zone 'Asia/Jakarta';
  v_open_ts timestamp;
  v_close_ts timestamp;
  v_label text;
  v_span_start timestamp;
  v_is_closing boolean;
  v_late numeric := 0;
  v_overtime numeric := 0;
  v_morning numeric := 0;
  v_night numeric := 0;
  v_extra numeric := 0;
  v_first_end timestamp;
  v_slot record;
  v_win_start timestamp;
  v_win_end timestamp;
begin
  select opening_time, closing_time into v_open, v_close from store_settings limit 1;
  v_open := coalesce(v_open, '08:00');
  v_close := coalesce(v_close, '23:00');
  v_open_ts := p_date + v_open;
  v_close_ts := p_date + v_close;

  -- Slot shift hari itu, urut dari yang paling awal; jam sudah kena Jam Khusus
  for v_slot in
    select
      sp.name,
      p_date + coalesce(o.start_time, sp.start_time) as start_ts,
      p_date + coalesce(o.end_time, sp.end_time) as end_ts,
      sp.end_time as std_end
    from shift_patterns sp
    left join shift_date_overrides o on o.shift_pattern_id = sp.id and o.override_date = p_date
    where sp.id = any (coalesce(p_shift_pattern_ids, '{}'))
    order by 2
  loop
    if v_first_end is null then
      -- Shift pertama
      v_label := v_slot.name;
      v_span_start := v_slot.start_ts;
      v_first_end := v_slot.end_ts;
      v_is_closing := v_slot.std_end >= v_close;
    else
      -- Shift ke-2: menit kerja di dalam jam operasional normal, tidak menumpuk dengan shift pertama
      v_label := v_label || ' + ' || v_slot.name;
      v_is_closing := v_is_closing or v_slot.std_end >= v_close;
      if v_in is not null and v_out is not null then
        v_win_start := greatest(v_slot.start_ts, v_open_ts, v_first_end, v_in);
        v_win_end := least(v_slot.end_ts, v_close_ts, v_out);
        v_extra := v_extra + greatest(0, extract(epoch from (v_win_end - v_win_start)) / 60);
      end if;
    end if;
  end loop;

  if v_first_end is null then
    -- Tanpa shift: tidak ada telat/lembur/shift ke-2
    return query select null::text, 0, 0, 0, 0, 0;
    return;
  end if;

  -- Telat: dari jam mulai shift paling awal
  if v_in is not null then
    v_late := greatest(0, extract(epoch from (v_in - v_span_start)) / 60);
  end if;

  if v_in is not null and v_out is not null then
    -- Lembur malam: lewat jam tutup normal, khusus kalau ada shift penutup
    if v_is_closing then
      v_night := greatest(0, extract(epoch from (v_out - v_close_ts)) / 60);
    end if;

    -- Lembur pagi: kerja sebelum jam buka normal karena Jam Khusus
    if v_span_start < v_open_ts then
      v_morning := greatest(0, extract(epoch from (
        least(v_out, v_open_ts) - greatest(v_in, v_span_start)
      )) / 60);
    end if;
  end if;

  -- overtime_minutes = total lembur terhitung (pagi + malam); yang dibayar ditentukan di tabel attendance
  v_overtime := floor(v_morning) + floor(v_night);
  return query select v_label, floor(v_late)::int, v_overtime::int, floor(v_extra)::int,
                      floor(v_morning)::int, floor(v_night)::int;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.record_attendance_scan(p_qr_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_employee record;
  v_now timestamptz := now();
  v_now_local timestamp := (v_now at time zone 'Asia/Jakarta');
  v_effective_date date;
  v_existing record;
  v_eff record;
  v_calc record;
  v_ids uuid[];
  v_window_open timestamp;
  v_window_close timestamp;
begin
  select id, full_name, is_active into v_employee
  from employees where qr_token = p_qr_token;

  if v_employee.id is null then
    raise exception 'QR tidak dikenali.';
  end if;
  if not v_employee.is_active then
    raise exception 'Akun karyawan ini nonaktif, tidak bisa absen.';
  end if;

  -- Jam 00.00–03.00 dihitung milik tanggal kemarin (shift penutup lewat tengah malam)
  if v_now_local::time < '03:00' then
    v_effective_date := v_now_local::date - 1;
  else
    v_effective_date := v_now_local::date;
  end if;

  select * into v_existing from attendance
  where employee_id = v_employee.id and attendance_date = v_effective_date;

  select * into v_eff from get_effective_shift(v_employee.id, v_effective_date);

  -- ----- Scan masuk -----
  if v_existing.id is null then
    if not v_eff.has_schedule then
      raise exception '% belum punya jadwal shift. Hubungi admin untuk mengatur jadwal di Shift Kerja.', v_employee.full_name;
    end if;
    if v_eff.is_libur then
      raise exception '% terjadwal Libur hari ini.', v_employee.full_name;
    end if;

    v_window_open := v_effective_date + v_eff.start_time - interval '1 hour';
    v_window_close := v_effective_date + v_eff.end_time;
    if v_now_local < v_window_open or v_now_local > v_window_close then
      raise exception '% terjadwal shift % (%–%). Absen masuk hanya bisa dilakukan mulai %.',
        v_employee.full_name, v_eff.shift_name,
        to_char(v_eff.start_time, 'HH24:MI'), to_char(v_eff.end_time, 'HH24:MI'),
        to_char(v_window_open, 'HH24:MI');
    end if;

    select * into v_calc from calc_attendance_minutes(v_effective_date, v_eff.shift_pattern_ids, v_now, null);

    insert into attendance
      (employee_id, attendance_date, check_in, shift, shift_pattern_ids, late_minutes, status, source)
    values
      (v_employee.id, v_effective_date, v_now, v_calc.shift_label, v_eff.shift_pattern_ids,
       v_calc.late_minutes, case when v_calc.late_minutes > 0 then 'telat' else 'hadir' end, 'qr');

    return jsonb_build_object(
      'employee_name', v_employee.full_name, 'action', 'masuk',
      'shift', v_calc.shift_label, 'late_minutes', v_calc.late_minutes
    );
  end if;

  -- ----- Scan pulang -----
  if v_existing.check_out is not null then
    raise exception '% sudah absen masuk dan pulang hari ini.', v_employee.full_name;
  end if;

  -- Pakai jadwal terbaru (kalau admin menambah shift setelah karyawan masuk, ikut terhitung);
  -- kalau jadwalnya sudah hilang, pakai shift yang dicatat saat masuk.
  v_ids := case when v_eff.slot_count > 0 then v_eff.shift_pattern_ids else v_existing.shift_pattern_ids end;

  select * into v_calc
  from calc_attendance_minutes(v_existing.attendance_date, v_ids, v_existing.check_in, v_now);

  update attendance set
    check_out = v_now,
    shift = coalesce(v_calc.shift_label, shift),
    shift_pattern_ids = v_ids,
    late_minutes = v_calc.late_minutes,
    overtime_morning_minutes = v_calc.overtime_morning_minutes,
    overtime_night_minutes = v_calc.overtime_night_minutes,
    extra_shift_minutes = v_calc.extra_shift_minutes,
    status = case when v_calc.late_minutes > 0 then 'telat' else 'hadir' end
  where id = v_existing.id;

  return jsonb_build_object(
    'employee_name', v_employee.full_name, 'action', 'pulang',
    'shift', v_calc.shift_label,
    'overtime_minutes', v_calc.overtime_minutes,
    -- lembur malam baru dibayar setelah disetujui admin
    'overtime_pending_minutes', v_calc.overtime_night_minutes,
    'extra_shift_minutes', v_calc.extra_shift_minutes
  );
end;
$function$

;

CREATE OR REPLACE FUNCTION public.correct_attendance(p_attendance_id uuid, p_check_in timestamp with time zone, p_check_out timestamp with time zone, p_reason text, p_shift_pattern_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_row record;
  v_ids uuid[];
  v_calc record;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengoreksi presensi.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Alasan koreksi wajib diisi.';
  end if;
  if p_check_out is not null and p_check_out <= p_check_in then
    raise exception 'Jam pulang harus setelah jam masuk.';
  end if;

  select * into v_row from attendance where id = p_attendance_id;
  if v_row.id is null then
    raise exception 'Data presensi tidak ditemukan.';
  end if;

  v_ids := nullif(p_shift_pattern_ids, '{}');
  if v_ids is null then
    select nullif(shift_pattern_ids, '{}') into v_ids
    from get_effective_shift(v_row.employee_id, v_row.attendance_date);
  end if;
  v_ids := coalesce(v_ids, v_row.shift_pattern_ids);

  select * into v_calc from calc_attendance_minutes(v_row.attendance_date, v_ids, p_check_in, p_check_out);

  update attendance set
    check_in = p_check_in,
    check_out = p_check_out,
    shift = coalesce(v_calc.shift_label, shift),
    shift_pattern_ids = v_ids,
    late_minutes = v_calc.late_minutes,
    overtime_morning_minutes = v_calc.overtime_morning_minutes,
    overtime_night_minutes = v_calc.overtime_night_minutes,
    extra_shift_minutes = v_calc.extra_shift_minutes,
    status = case when v_calc.late_minutes > 0 then 'telat' else 'hadir' end,
    source = 'manual',
    notes = p_reason,
    corrected_by = auth.uid(),
    corrected_at = now()
  where id = p_attendance_id;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.create_manual_attendance(p_employee_id uuid, p_attendance_date date, p_check_in timestamp with time zone, p_check_out timestamp with time zone, p_reason text, p_shift_pattern_ids uuid[] DEFAULT NULL::uuid[], p_shift text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_ids uuid[];
  v_calc record;
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menambah presensi manual.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Alasan wajib diisi.';
  end if;
  if p_check_out is not null and p_check_out <= p_check_in then
    raise exception 'Jam pulang harus setelah jam masuk.';
  end if;
  if exists (
    select 1 from attendance
    where employee_id = p_employee_id and attendance_date = p_attendance_date
  ) then
    raise exception 'Presensi tanggal ini sudah ada. Gunakan Koreksi, bukan Tambah Manual.';
  end if;

  v_ids := nullif(p_shift_pattern_ids, '{}');
  if v_ids is null and p_shift is not null then
    select array_agg(id) into v_ids from shift_patterns where lower(name) = lower(p_shift);
  end if;
  if v_ids is null then
    select nullif(shift_pattern_ids, '{}') into v_ids
    from get_effective_shift(p_employee_id, p_attendance_date);
  end if;
  if v_ids is null then
    raise exception 'Karyawan ini tidak punya jadwal di tanggal tersebut. Pilih shift-nya dulu.';
  end if;

  select * into v_calc from calc_attendance_minutes(p_attendance_date, v_ids, p_check_in, p_check_out);

  insert into attendance
    (employee_id, attendance_date, check_in, check_out, shift, shift_pattern_ids,
     late_minutes, overtime_morning_minutes, overtime_night_minutes, extra_shift_minutes, status, source, notes, corrected_by, corrected_at)
  values
    (p_employee_id, p_attendance_date, p_check_in, p_check_out, v_calc.shift_label, v_ids,
     v_calc.late_minutes, v_calc.overtime_morning_minutes, v_calc.overtime_night_minutes, v_calc.extra_shift_minutes,
     case when v_calc.late_minutes > 0 then 'telat' else 'hadir' end,
     'manual', p_reason, auth.uid(), now())
  returning id into v_id;

  return v_id;
end;
$function$

;

-- Data lama: pisahkan lembur pagi/malam; lembur yang sudah ada dianggap disetujui (gaji lama tidak berubah)
update public.attendance a set
  overtime_morning_minutes = c.overtime_morning_minutes,
  overtime_night_minutes = c.overtime_night_minutes,
  overtime_approved_minutes = c.overtime_night_minutes,
  overtime_status = case when c.overtime_night_minutes > 0 then 'approved' else 'none' end
from public.attendance x
cross join lateral public.calc_attendance_minutes(x.attendance_date, x.shift_pattern_ids, x.check_in, x.check_out) c
where x.id = a.id and a.check_out is not null;

-- Trigger: status persetujuan & lembur yang dibayar
create or replace function public.apply_overtime_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.overtime_night_minutes is distinct from old.overtime_night_minutes then
    -- Menit lembur malam baru / berubah → perlu diputuskan (ulang) oleh admin
    new.overtime_status := case when new.overtime_night_minutes > 0 then 'pending' else 'none' end;
    new.overtime_approved_minutes := 0;
    new.overtime_reviewed_by := null;
    new.overtime_reviewed_at := null;
    new.overtime_review_note := null;
  end if;
  new.overtime_approved_minutes := least(new.overtime_approved_minutes, new.overtime_night_minutes);
  new.overtime_minutes := new.overtime_morning_minutes
    + case when new.overtime_status = 'approved' then new.overtime_approved_minutes else 0 end;
  return new;
end;
$$;

create trigger attendance_overtime_approval
  before insert or update on public.attendance
  for each row execute function public.apply_overtime_approval();

-- Setujui / tolak lembur malam.
-- p_minutes hanya untuk 1 presensi (setujui sebagian); kosong = setujui semua menit yang terhitung.
create or replace function public.review_overtime(
  p_attendance_ids uuid[],
  p_action text,
  p_minutes integer default null,
  p_note text default null
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menyetujui lembur.' using errcode = '42501';
  end if;
  if p_action not in ('approve', 'reject') then
    raise exception 'Aksi tidak valid.';
  end if;
  if p_minutes is not null and (p_minutes < 0 or coalesce(array_length(p_attendance_ids, 1), 0) <> 1) then
    raise exception 'Menit lembur sebagian hanya untuk 1 presensi dan tidak boleh minus.';
  end if;

  update attendance set
    overtime_status = case when p_action = 'approve' and coalesce(p_minutes, overtime_night_minutes) > 0
                           then 'approved' else 'rejected' end,
    overtime_approved_minutes = case when p_action = 'approve'
                                     then least(coalesce(p_minutes, overtime_night_minutes), overtime_night_minutes)
                                     else 0 end,
    overtime_reviewed_by = auth.uid(),
    overtime_reviewed_at = now(),
    overtime_review_note = nullif(trim(p_note), '')
  where id = any (p_attendance_ids) and overtime_night_minutes > 0;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Tidak ada lembur yang bisa diputuskan.';
  end if;
  return v_count;
end;
$$;

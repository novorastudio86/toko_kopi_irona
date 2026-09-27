-- ============================================================
-- SHIFT KERJA v3 — jadwal per SLOT, shift ke-2, tukar antar slot,
-- aturan lembur baru, dan gaji dengan bonus shift ke-2.
--
-- Ringkasan aturan (disepakati dengan owner):
-- - Jam operasional normal toko 08:00–23:00 (store_settings).
-- - Satu karyawan boleh punya maksimal 2 shift (slot) per hari.
-- - Telat      = jam masuk − jam mulai shift paling awal hari itu.
-- - Lembur     = menit setelah jam tutup normal (khusus kalau salah satu
--                shift-nya shift penutup) + menit sebelum jam buka normal
--                (kalau Jam Khusus memajukan jam mulai). Dihitung per menit.
-- - Shift ke-2 = menit yang benar-benar dikerjakan di shift kedua hari itu,
--                di dalam jam operasional normal, dibayar sebagai bonus.
-- - Tarif/jam  = gaji pokok ÷ jam shift PERTAMA terjadwal sebulan penuh.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Jam operasional normal toko
-- ------------------------------------------------------------
insert into public.store_settings (id, opening_time, closing_time)
values (true, '08:00', '23:00')
on conflict (id) do update set
  opening_time = coalesce(public.store_settings.opening_time, excluded.opening_time),
  closing_time = coalesce(public.store_settings.closing_time, excluded.closing_time),
  updated_at = now();

-- Pola shift tidak boleh melewati tengah malam (jam selesai harus > jam mulai)
alter table public.shift_patterns
  add constraint shift_patterns_time_order check (end_time > start_time);


-- ------------------------------------------------------------
-- 2. Jadwal mingguan per slot: 1 baris = 1 karyawan, 1 hari, 1 shift.
--    Hari tanpa baris = Libur. Karyawan tanpa baris sama sekali = Belum diatur.
-- ------------------------------------------------------------
delete from public.employee_shift_defaults where shift_pattern_id is null;

alter table public.employee_shift_defaults
  drop constraint employee_shift_defaults_pkey,
  alter column shift_pattern_id set not null,
  add primary key (employee_id, day_of_week, shift_pattern_id);


-- ------------------------------------------------------------
-- 3. Perubahan jadwal per tanggal: setiap kejadian (tukar/gantikan/tambah/libur)
--    berisi beberapa baris "tambah slot" atau "lepas slot".
-- ------------------------------------------------------------
create table public.shift_change_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('tukar', 'gantikan', 'tambah', 'libur')),
  note text,
  created_by uuid references public.employees(id) default auth.uid(),
  created_at timestamptz not null default clock_timestamp()
);

create table public.shift_changes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.shift_change_events(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  change_date date not null,
  shift_pattern_id uuid not null references public.shift_patterns(id),
  action text not null check (action in ('tambah', 'lepas')),
  unique (event_id, employee_id, change_date, shift_pattern_id)
);

create index shift_changes_lookup_idx on public.shift_changes (change_date, employee_id);

alter table public.shift_change_events enable row level security;
alter table public.shift_changes enable row level security;
create policy "shift_change_events_select" on public.shift_change_events for select to authenticated using (true);
create policy "shift_change_events_admin_write" on public.shift_change_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "shift_changes_select" on public.shift_changes for select to authenticated using (true);
create policy "shift_changes_admin_write" on public.shift_changes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ------------------------------------------------------------
-- 4. Slot efektif per tanggal, sudah memperhitungkan:
--    jadwal mingguan → perubahan per tanggal (yang terbaru menang) → Jam Khusus.
-- ------------------------------------------------------------
create or replace function public.effective_shift_slots(p_start date, p_end date)
returns table (
  employee_id uuid,
  slot_date date,
  shift_pattern_id uuid,
  shift_name text,
  start_time time,        -- jam efektif (sudah kena Jam Khusus)
  end_time time,
  std_start_time time,    -- jam standar pola shift
  std_end_time time,
  is_special_hours boolean,
  is_changed boolean      -- slot ini hasil tukar/gantikan/tambah
)
language sql
stable
set search_path = public
as $$
  with days as (
    select d::date as slot_date
    from generate_series(p_start, p_end, interval '1 day') d
  ),
  latest as (
    select distinct on (sc.employee_id, sc.change_date, sc.shift_pattern_id)
      sc.employee_id, sc.change_date as slot_date, sc.shift_pattern_id, sc.action
    from shift_changes sc
    join shift_change_events ev on ev.id = sc.event_id
    where sc.change_date between p_start and p_end
    order by sc.employee_id, sc.change_date, sc.shift_pattern_id, ev.created_at desc
  ),
  slots as (
    select esd.employee_id, days.slot_date, esd.shift_pattern_id, false as is_changed
    from days
    join employee_shift_defaults esd on esd.day_of_week = extract(dow from days.slot_date)::int
    where not exists (
      select 1 from latest l
      where l.employee_id = esd.employee_id
        and l.slot_date = days.slot_date
        and l.shift_pattern_id = esd.shift_pattern_id
    )
    union all
    select l.employee_id, l.slot_date, l.shift_pattern_id, true
    from latest l
    where l.action = 'tambah'
  )
  select
    s.employee_id, s.slot_date, s.shift_pattern_id, sp.name,
    coalesce(o.start_time, sp.start_time),
    coalesce(o.end_time, sp.end_time),
    sp.start_time, sp.end_time,
    o.id is not null,
    s.is_changed
  from slots s
  join shift_patterns sp on sp.id = s.shift_pattern_id
  left join shift_date_overrides o
    on o.override_date = s.slot_date and o.shift_pattern_id = s.shift_pattern_id;
$$;


-- Ringkasan jadwal seorang karyawan di satu tanggal (dipakai scan & presensi).
drop function if exists public.list_employee_shifts(date);
drop function if exists public.get_effective_shift(uuid, date);

create or replace function public.get_effective_shift(p_employee_id uuid, p_date date)
returns table (
  has_schedule boolean,     -- punya jadwal mingguan / perubahan (false = Belum diatur)
  is_libur boolean,         -- punya jadwal tapi 0 slot di tanggal ini
  slot_count int,
  shift_pattern_ids uuid[],
  shift_name text,          -- mis. "Pagi" atau "Pagi + Sore"
  start_time time,          -- jam mulai paling awal
  end_time time,            -- jam selesai paling akhir
  is_special_hours boolean,
  is_changed boolean,
  slots jsonb
)
language sql
stable
set search_path = public
as $$
  with s as (
    select * from effective_shift_slots(p_date, p_date) where employee_id = p_employee_id
  ),
  sched as (
    select exists (select 1 from employee_shift_defaults where employee_id = p_employee_id)
        or exists (select 1 from shift_changes where employee_id = p_employee_id) as has_schedule
  )
  select
    sched.has_schedule,
    sched.has_schedule and count(s.*) = 0,
    count(s.*)::int,
    coalesce(array_agg(s.shift_pattern_id order by s.start_time) filter (where s.employee_id is not null), '{}'),
    string_agg(s.shift_name, ' + ' order by s.start_time),
    min(s.start_time),
    max(s.end_time),
    coalesce(bool_or(s.is_special_hours), false),
    coalesce(bool_or(s.is_changed), false),
    coalesce(
      jsonb_agg(jsonb_build_object(
        'shift_pattern_id', s.shift_pattern_id,
        'shift_name', s.shift_name,
        'start_time', s.start_time,
        'end_time', s.end_time,
        'is_special_hours', s.is_special_hours,
        'is_changed', s.is_changed
      ) order by s.start_time) filter (where s.employee_id is not null),
      '[]'::jsonb
    )
  from sched
  left join s on true
  group by sched.has_schedule;
$$;


-- Tabel utama Shift Kerja: semua karyawan aktif non-admin di satu tanggal.
-- Kolom lama (shift_name, start_time, is_swap, swap_with_name, ...) dipertahankan
-- supaya layar Shift Kerja yang sekarang tetap jalan.
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
  swap_with_name text,
  slot_count int,
  is_special_hours boolean,
  is_changed boolean,
  slots jsonb
)
language sql
stable
set search_path = public
as $$
  select
    e.id, e.full_name, e.username, r.name,
    eff.has_schedule, eff.is_libur,
    eff.shift_pattern_ids[1], eff.shift_name, eff.start_time, eff.end_time,
    partner.full_name is not null,
    partner.full_name,
    eff.slot_count, eff.is_special_hours, eff.is_changed, eff.slots
  from employees e
  join roles r on r.id = e.role_id
  cross join lateral get_effective_shift(e.id, p_date) eff
  left join lateral (
    select string_agg(distinct pe.full_name, ', ') as full_name
    from shift_changes mine
    join shift_change_events ev on ev.id = mine.event_id and ev.kind = 'tukar'
    join shift_changes other on other.event_id = ev.id and other.employee_id <> e.id
    join employees pe on pe.id = other.employee_id
    where mine.employee_id = e.id and mine.change_date = p_date
  ) partner on true
  where e.is_active and r.type <> 'admin'
  order by e.full_name;
$$;


-- ------------------------------------------------------------
-- 5. Validasi & aksi jadwal (dipanggil dari layar Shift Kerja)
-- ------------------------------------------------------------

-- Cek aturan satu karyawan di satu tanggal: maks 2 shift, tidak bertabrakan.
create or replace function public.assert_valid_shift_day(p_employee_id uuid, p_date date)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_name text;
  v_count int;
begin
  select full_name into v_name from employees where id = p_employee_id;

  select count(*) into v_count
  from effective_shift_slots(p_date, p_date)
  where employee_id = p_employee_id;

  if v_count > 2 then
    raise exception '% akan punya % shift di %. Maksimal 2 shift per hari.',
      v_name, v_count, to_char(p_date, 'DD/MM/YYYY');
  end if;

  if exists (
    select 1
    from effective_shift_slots(p_date, p_date) a
    join effective_shift_slots(p_date, p_date) b
      on a.employee_id = b.employee_id
     and a.shift_pattern_id < b.shift_pattern_id
     and a.std_start_time < b.std_end_time
     and b.std_start_time < a.std_end_time
    where a.employee_id = p_employee_id
  ) then
    raise exception 'Shift % di % bertabrakan jamnya.', v_name, to_char(p_date, 'DD/MM/YYYY');
  end if;
end;
$$;

create or replace function public.slot_exists(p_employee_id uuid, p_date date, p_pattern_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from effective_shift_slots(p_date, p_date)
    where employee_id = p_employee_id and shift_pattern_id = p_pattern_id
  );
$$;

-- Simpan jadwal mingguan sekaligus (atomik).
-- p_days: {"0": [], "1": ["<pola id>"], "2": ["<pola id>", "<pola id>"], ...}
-- Hari yang kosong/tidak ada = Libur.
create or replace function public.save_weekly_shifts(p_employee_id uuid, p_days jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_day int;
  v_ids uuid[];
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur jadwal.' using errcode = '42501';
  end if;

  delete from employee_shift_defaults where employee_id = p_employee_id;

  for v_day in 0..6 loop
    select coalesce(array_agg(distinct x::uuid), '{}')
      into v_ids
    from jsonb_array_elements_text(coalesce(p_days -> v_day::text, '[]'::jsonb)) x;

    if array_length(v_ids, 1) > 2 then
      raise exception 'Maksimal 2 shift per hari.';
    end if;

    if array_length(v_ids, 1) = 2 and exists (
      select 1 from shift_patterns a, shift_patterns b
      where a.id = v_ids[1] and b.id = v_ids[2]
        and a.start_time < b.end_time and b.start_time < a.end_time
    ) then
      raise exception 'Shift 1 dan Shift 2 di hari yang sama tidak boleh bertabrakan jamnya.';
    end if;

    insert into employee_shift_defaults (employee_id, day_of_week, shift_pattern_id)
    select p_employee_id, v_day, unnest(v_ids);
  end loop;
end;
$$;

-- Tukar satu slot milik A dengan satu slot milik B. Tanggal boleh berbeda.
create or replace function public.swap_shift_slots(
  p_employee_a uuid, p_date_a date, p_pattern_a uuid,
  p_employee_b uuid, p_date_b date, p_pattern_b uuid,
  p_note text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_event uuid;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menukar shift.' using errcode = '42501';
  end if;
  if p_employee_a = p_employee_b then
    raise exception 'Pilih dua karyawan yang berbeda.';
  end if;
  if not slot_exists(p_employee_a, p_date_a, p_pattern_a) then
    raise exception 'Shift pihak pertama tidak ada di jadwal tanggal itu.';
  end if;
  if not slot_exists(p_employee_b, p_date_b, p_pattern_b) then
    raise exception 'Shift pihak kedua tidak ada di jadwal tanggal itu.';
  end if;
  if p_date_a = p_date_b and p_pattern_a = p_pattern_b then
    raise exception 'Kedua shift sama persis, tidak ada yang ditukar.';
  end if;
  if slot_exists(p_employee_b, p_date_a, p_pattern_a) then
    raise exception 'Pihak kedua sudah punya shift itu di tanggal pihak pertama.';
  end if;
  if slot_exists(p_employee_a, p_date_b, p_pattern_b) then
    raise exception 'Pihak pertama sudah punya shift itu di tanggal pihak kedua.';
  end if;

  insert into shift_change_events (kind, note) values ('tukar', p_note) returning id into v_event;

  insert into shift_changes (event_id, employee_id, change_date, shift_pattern_id, action) values
    (v_event, p_employee_a, p_date_a, p_pattern_a, 'lepas'),
    (v_event, p_employee_b, p_date_a, p_pattern_a, 'tambah'),
    (v_event, p_employee_b, p_date_b, p_pattern_b, 'lepas'),
    (v_event, p_employee_a, p_date_b, p_pattern_b, 'tambah');

  perform assert_valid_shift_day(p_employee_a, p_date_a);
  perform assert_valid_shift_day(p_employee_b, p_date_a);
  perform assert_valid_shift_day(p_employee_a, p_date_b);
  perform assert_valid_shift_day(p_employee_b, p_date_b);

  return v_event;
end;
$$;

-- Satu slot milik karyawan lain diambil alih (mis. yang punya sedang sakit).
create or replace function public.cover_shift_slot(
  p_from_employee uuid, p_to_employee uuid, p_date date, p_pattern uuid, p_note text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_event uuid;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur jadwal.' using errcode = '42501';
  end if;
  if p_from_employee = p_to_employee then
    raise exception 'Pilih karyawan pengganti yang berbeda.';
  end if;
  if not slot_exists(p_from_employee, p_date, p_pattern) then
    raise exception 'Shift yang digantikan tidak ada di jadwal tanggal itu.';
  end if;
  if slot_exists(p_to_employee, p_date, p_pattern) then
    raise exception 'Karyawan pengganti sudah punya shift itu di tanggal tersebut.';
  end if;

  insert into shift_change_events (kind, note) values ('gantikan', p_note) returning id into v_event;
  insert into shift_changes (event_id, employee_id, change_date, shift_pattern_id, action) values
    (v_event, p_from_employee, p_date, p_pattern, 'lepas'),
    (v_event, p_to_employee, p_date, p_pattern, 'tambah');

  perform assert_valid_shift_day(p_to_employee, p_date);
  return v_event;
end;
$$;

-- Tambah shift untuk satu karyawan di satu tanggal (tanpa melepas milik orang lain).
create or replace function public.add_shift_slot(
  p_employee uuid, p_date date, p_pattern uuid, p_note text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_event uuid;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur jadwal.' using errcode = '42501';
  end if;
  if slot_exists(p_employee, p_date, p_pattern) then
    raise exception 'Karyawan ini sudah punya shift tersebut di tanggal itu.';
  end if;

  insert into shift_change_events (kind, note) values ('tambah', p_note) returning id into v_event;
  insert into shift_changes (event_id, employee_id, change_date, shift_pattern_id, action)
  values (v_event, p_employee, p_date, p_pattern, 'tambah');

  perform assert_valid_shift_day(p_employee, p_date);
  return v_event;
end;
$$;

-- Libur mendadak: lepas semua shift karyawan itu di satu tanggal.
create or replace function public.set_shift_day_off(p_employee uuid, p_date date, p_note text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_event uuid;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur jadwal.' using errcode = '42501';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'Alasan libur wajib diisi.';
  end if;
  if not exists (
    select 1 from effective_shift_slots(p_date, p_date) where employee_id = p_employee
  ) then
    raise exception 'Karyawan ini memang tidak punya shift di tanggal itu.';
  end if;

  insert into shift_change_events (kind, note) values ('libur', p_note) returning id into v_event;
  insert into shift_changes (event_id, employee_id, change_date, shift_pattern_id, action)
  select v_event, p_employee, p_date, shift_pattern_id, 'lepas'
  from effective_shift_slots(p_date, p_date)
  where employee_id = p_employee;

  return v_event;
end;
$$;

-- Batalkan satu kejadian perubahan (jadwal kembali seperti sebelum kejadian itu).
create or replace function public.undo_shift_change(p_event_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_emps uuid[];
  v_dates date[];
  i int;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur jadwal.' using errcode = '42501';
  end if;

  -- Karyawan & tanggal yang terdampak, dicatat sebelum dihapus
  select array_agg(employee_id), array_agg(change_date) into v_emps, v_dates
  from (select distinct employee_id, change_date from shift_changes where event_id = p_event_id) t;

  delete from shift_change_events where id = p_event_id;

  -- Membatalkan bisa membuat jadwal jadi melanggar aturan (mis. 3 shift) — cek ulang
  for i in 1 .. coalesce(array_length(v_emps, 1), 0) loop
    perform assert_valid_shift_day(v_emps[i], v_dates[i]);
  end loop;
end;
$$;


-- ------------------------------------------------------------
-- 6. Pindahkan data pengecualian lama (shift_schedules) ke format baru, lalu hapus tabelnya
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_event uuid;
  v_dow int;
begin
  for r in select * from public.shift_schedules order by created_at loop
    v_dow := extract(dow from r.schedule_date)::int;

    insert into public.shift_change_events (kind, note, created_at)
    values (
      case
        when r.swap_with_employee_id is not null then 'tukar'
        when r.shift_pattern_id is null then 'libur'
        else 'gantikan'
      end,
      r.note,
      r.created_at
    )
    returning id into v_event;

    -- lepas slot mingguan yang tidak sama dengan shift pengecualian
    insert into public.shift_changes (event_id, employee_id, change_date, shift_pattern_id, action)
    select v_event, r.employee_id, r.schedule_date, esd.shift_pattern_id, 'lepas'
    from public.employee_shift_defaults esd
    where esd.employee_id = r.employee_id
      and esd.day_of_week = v_dow
      and esd.shift_pattern_id is distinct from r.shift_pattern_id;

    -- tambah shift pengecualian kalau belum ada di jadwal mingguan
    if r.shift_pattern_id is not null and not exists (
      select 1 from public.employee_shift_defaults
      where employee_id = r.employee_id and day_of_week = v_dow and shift_pattern_id = r.shift_pattern_id
    ) then
      insert into public.shift_changes (event_id, employee_id, change_date, shift_pattern_id, action)
      values (v_event, r.employee_id, r.schedule_date, r.shift_pattern_id, 'tambah');
    end if;
  end loop;
end;
$$;

drop function if exists public.employee_scheduled_hours(uuid, date, date);
drop table public.shift_schedules;


-- ------------------------------------------------------------
-- 7. Presensi: kolom baru + satu fungsi hitung untuk semua jalur
-- ------------------------------------------------------------
alter table public.attendance
  drop constraint if exists attendance_shift_check,
  add column if not exists shift_pattern_ids uuid[] not null default '{}',
  add column if not exists extra_shift_minutes integer not null default 0;

comment on column public.attendance.shift is 'Nama shift saat presensi dicatat, mis. "Pagi" atau "Pagi + Sore"';
comment on column public.attendance.shift_pattern_ids is 'Pola shift yang dipakai untuk menghitung telat/lembur/shift ke-2';
comment on column public.attendance.extra_shift_minutes is 'Menit kerja di shift ke-2 (dibayar sebagai bonus)';

-- Hitung telat, lembur, dan menit shift ke-2 dari jam masuk/pulang + pola shift hari itu.
create or replace function public.calc_attendance_minutes(
  p_date date,
  p_shift_pattern_ids uuid[],
  p_check_in timestamptz,
  p_check_out timestamptz
)
returns table (
  shift_label text,
  late_minutes int,
  overtime_minutes int,
  extra_shift_minutes int
)
language plpgsql
stable
set search_path = public
as $$
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
    return query select null::text, 0, 0, 0;
    return;
  end if;

  -- Telat: dari jam mulai shift paling awal
  if v_in is not null then
    v_late := greatest(0, extract(epoch from (v_in - v_span_start)) / 60);
  end if;

  if v_in is not null and v_out is not null then
    -- Lembur malam: lewat jam tutup normal, khusus kalau ada shift penutup
    if v_is_closing then
      v_overtime := v_overtime + greatest(0, extract(epoch from (v_out - v_close_ts)) / 60);
    end if;

    -- Lembur pagi: kerja sebelum jam buka normal karena Jam Khusus
    if v_span_start < v_open_ts then
      v_overtime := v_overtime + greatest(0, extract(epoch from (
        least(v_out, v_open_ts) - greatest(v_in, v_span_start)
      )) / 60);
    end if;
  end if;

  return query select v_label, floor(v_late)::int, floor(v_overtime)::int, floor(v_extra)::int;
end;
$$;


-- Scan QR: scan pertama = masuk, scan kedua = pulang.
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
    overtime_minutes = v_calc.overtime_minutes,
    extra_shift_minutes = v_calc.extra_shift_minutes,
    status = case when v_calc.late_minutes > 0 then 'telat' else 'hadir' end
  where id = v_existing.id;

  return jsonb_build_object(
    'employee_name', v_employee.full_name, 'action', 'pulang',
    'shift', v_calc.shift_label,
    'overtime_minutes', v_calc.overtime_minutes,
    'extra_shift_minutes', v_calc.extra_shift_minutes
  );
end;
$$;


-- Koreksi presensi oleh admin.
-- p_shift_pattern_ids kosong = pakai jadwal Shift Kerja terbaru di tanggal itu.
drop function if exists public.correct_attendance(uuid, timestamptz, timestamptz, text);

create or replace function public.correct_attendance(
  p_attendance_id uuid,
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_reason text,
  p_shift_pattern_ids uuid[] default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
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
    overtime_minutes = v_calc.overtime_minutes,
    extra_shift_minutes = v_calc.extra_shift_minutes,
    status = case when v_calc.late_minutes > 0 then 'telat' else 'hadir' end,
    source = 'manual',
    notes = p_reason,
    corrected_by = auth.uid(),
    corrected_at = now()
  where id = p_attendance_id;
end;
$$;


-- Presensi manual untuk karyawan yang lupa scan.
-- Shift bisa dipilih admin (p_shift_pattern_ids); kosong = ikut jadwal Shift Kerja.
-- p_shift (teks 'pagi'/'sore') masih diterima supaya layar lama tetap jalan.
drop function if exists public.create_manual_attendance(uuid, date, text, timestamptz, timestamptz, text);

create or replace function public.create_manual_attendance(
  p_employee_id uuid,
  p_attendance_date date,
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_reason text,
  p_shift_pattern_ids uuid[] default null,
  p_shift text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
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
     late_minutes, overtime_minutes, extra_shift_minutes, status, source, notes, corrected_by, corrected_at)
  values
    (p_employee_id, p_attendance_date, p_check_in, p_check_out, v_calc.shift_label, v_ids,
     v_calc.late_minutes, v_calc.overtime_minutes, v_calc.extra_shift_minutes,
     case when v_calc.late_minutes > 0 then 'telat' else 'hadir' end,
     'manual', p_reason, auth.uid(), now())
  returning id into v_id;

  return v_id;
end;
$$;


-- Hitung ulang semua presensi lama dengan aturan baru
do $$
declare
  r record;
  v_ids uuid[];
  v_calc record;
begin
  for r in select * from public.attendance loop
    select nullif(shift_pattern_ids, '{}') into v_ids
    from public.get_effective_shift(r.employee_id, r.attendance_date);

    if v_ids is null then
      select array_agg(id) into v_ids from public.shift_patterns where lower(name) = lower(r.shift);
    end if;

    select * into v_calc
    from public.calc_attendance_minutes(r.attendance_date, v_ids, r.check_in, r.check_out);

    update public.attendance set
      shift = coalesce(v_calc.shift_label, shift),
      shift_pattern_ids = coalesce(v_ids, '{}'),
      late_minutes = v_calc.late_minutes,
      overtime_minutes = v_calc.overtime_minutes,
      extra_shift_minutes = v_calc.extra_shift_minutes,
      status = case when v_calc.late_minutes > 0 then 'telat' else 'hadir' end
    where id = r.id;
  end loop;
end;
$$;


-- ------------------------------------------------------------
-- 8. Gaji
-- ------------------------------------------------------------

-- Jam shift PERTAMA terjadwal dalam sebulan penuh (bulan dari p_month),
-- dipotong ke jam operasional normal. Shift ke-2 & jam di luar 08–23 tidak dihitung,
-- karena keduanya sudah dibayar terpisah sebagai bonus.
create or replace function public.employee_regular_hours(p_employee_id uuid, p_month date)
returns numeric
language sql
stable
set search_path = public
as $$
  with bounds as (
    select
      date_trunc('month', p_month)::date as m_start,
      (date_trunc('month', p_month) + interval '1 month - 1 day')::date as m_end,
      coalesce((select opening_time from store_settings limit 1), '08:00') as open_t,
      coalesce((select closing_time from store_settings limit 1), '23:00') as close_t
  ),
  first_slots as (
    select distinct on (s.slot_date) s.slot_date, s.start_time, s.end_time
    from bounds, effective_shift_slots(bounds.m_start, bounds.m_end) s
    where s.employee_id = p_employee_id
    order by s.slot_date, s.start_time
  )
  select coalesce(sum(greatest(0,
    extract(epoch from (least(f.end_time, b.close_t) - greatest(f.start_time, b.open_t))) / 3600
  )), 0)
  from first_slots f, bounds b;
$$;

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
  base as (
    select
      e.id,
      e.base_salary,
      e.delivery_bonus,
      coalesce(da.delivery_count, 0) as delivery_count,
      coalesce(da.delivery_bonus_total, 0) as delivery_bonus_total,
      coalesce(aa.overtime_minutes, 0) as overtime_minutes,
      coalesce(aa.extra_shift_minutes, 0) as extra_shift_minutes,
      -- Jaring pengaman kalau belum ada jadwal sama sekali: 26 hari × 7,5 jam
      coalesce(nullif(employee_regular_hours(e.id, p_start), 0), 26 * 7.5) as regular_hours
    from employees e
    left join delivery_agg da on da.id = e.id
    left join attendance_agg aa on aa.id = e.id
  ),
  priced as (
    select
      b.*,
      round(b.base_salary / b.regular_hours, 2) as hourly_rate,
      round(b.base_salary / b.regular_hours * b.overtime_minutes / 60.0, 2) as overtime_bonus_total,
      round(b.base_salary / b.regular_hours * b.extra_shift_minutes / 60.0, 2) as extra_shift_bonus_total
    from base b
  )
  select
    p.id,
    p.base_salary,
    p.delivery_bonus,
    p.delivery_count,
    p.delivery_bonus_total,
    round(p.regular_hours, 2),
    p.hourly_rate,
    p.overtime_minutes,
    p.overtime_bonus_total,
    p.extra_shift_minutes,
    p.extra_shift_bonus_total,
    p.delivery_bonus_total + p.overtime_bonus_total + p.extra_shift_bonus_total,
    p.base_salary + p.delivery_bonus_total + p.overtime_bonus_total + p.extra_shift_bonus_total
  from priced p;
$$;

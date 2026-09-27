-- ============================================================
-- PENJUALAN > JAM BUKA
--
-- - Jam Operasional Offline (toko) & Jam Layanan Online, per hari (Senin–Minggu).
-- - Take Away ikut jam Offline; checkout Online diblokir total di luar jam Online.
-- - TERPISAH dari hitungan lembur: lembur tetap memakai jam normal tetap di store_settings (08:00–23:00).
-- - Setiap simpan tercatat di Riwayat Perubahan.
-- ============================================================

create table public.store_hours (
  channel text not null check (channel in ('offline', 'online')),
  day_of_week smallint not null check (day_of_week between 0 and 6),  -- 0 = Minggu
  is_open boolean not null default true,
  open_time time,
  close_time time,
  primary key (channel, day_of_week),
  constraint store_hours_times_check check (
    not is_open or (open_time is not null and close_time is not null and close_time > open_time)
  )
);

-- Nilai awal: buka setiap hari 08:00–23:00 (bisa diubah admin)
insert into public.store_hours (channel, day_of_week, is_open, open_time, close_time)
select c, d, true, '08:00', '23:00'
from unnest(array['offline', 'online']) c, generate_series(0, 6) d;

create table public.store_hours_history (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('offline', 'online')),
  before_data jsonb,
  after_data jsonb not null,
  changed_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);

create index store_hours_history_created_idx on public.store_hours_history (created_at desc);

alter table public.store_hours enable row level security;
create policy "store_hours_select" on public.store_hours for select to authenticated using (true);
create policy "store_hours_admin_write" on public.store_hours for all to authenticated
  using (is_admin()) with check (is_admin());

alter table public.store_hours_history enable row level security;
create policy "store_hours_history_admin_all" on public.store_hours_history for all to authenticated
  using (is_admin()) with check (is_admin());

create or replace function public.store_hours_snapshot(p_channel text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'day_of_week', day_of_week, 'is_open', is_open,
    'open_time', to_char(open_time, 'HH24:MI'), 'close_time', to_char(close_time, 'HH24:MI')
  ) order by day_of_week), '[]'::jsonb)
  from store_hours where channel = p_channel;
$$;

-- Simpan 7 hari satu channel sekaligus.
-- p_days: [{"day_of_week":1,"is_open":true,"open_time":"08:00","close_time":"23:00"}, ...]
create or replace function public.save_store_hours(p_channel text, p_days jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_before jsonb;
  v_day record;
  v_label text;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengubah jam buka.' using errcode = '42501';
  end if;
  if p_channel not in ('offline', 'online') then
    raise exception 'Channel tidak valid.';
  end if;
  if (select count(distinct (d ->> 'day_of_week')::int) from jsonb_array_elements(p_days) d) <> 7 then
    raise exception 'Isi ketujuh hari.';
  end if;

  v_before := store_hours_snapshot(p_channel);

  for v_day in
    select (d ->> 'day_of_week')::int as dow,
           coalesce((d ->> 'is_open')::boolean, false) as is_open,
           nullif(d ->> 'open_time', '')::time as open_t,
           nullif(d ->> 'close_time', '')::time as close_t
    from jsonb_array_elements(p_days) d
  loop
    v_label := (array['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'])[v_day.dow + 1];
    if v_day.is_open and (v_day.open_t is null or v_day.close_t is null) then
      raise exception '%: isi jam buka dan jam tutup.', v_label;
    end if;
    if v_day.is_open and v_day.close_t <= v_day.open_t then
      raise exception '%: jam tutup harus setelah jam buka.', v_label;
    end if;

    update store_hours set
      is_open = v_day.is_open,
      open_time = case when v_day.is_open then v_day.open_t end,
      close_time = case when v_day.is_open then v_day.close_t end
    where channel = p_channel and day_of_week = v_day.dow;
  end loop;

  insert into store_hours_history (channel, before_data, after_data, changed_by)
  values (p_channel, v_before, store_hours_snapshot(p_channel), auth.uid());
end;
$$;

-- Dipakai Kasir/Web Customer: apakah toko/online sedang buka pada waktu tertentu (default: sekarang, WIB)
create or replace function public.is_store_open(p_channel text, p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((
    select h.is_open
       and (p_at at time zone 'Asia/Jakarta')::time >= h.open_time
       and (p_at at time zone 'Asia/Jakarta')::time < h.close_time
    from store_hours h
    where h.channel = p_channel
      and h.day_of_week = extract(dow from (p_at at time zone 'Asia/Jakarta'))::int
  ), false);
$$;

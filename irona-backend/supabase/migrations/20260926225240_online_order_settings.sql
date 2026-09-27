-- ============================================================
-- PENJUALAN > ORDER ONLINE
--
-- 1. Jeda Tayang Online: sembunyikan produk dari Web Customer sementara.
--    Tidak mengubah status Aktif/Nonaktif produk; Dine In/Take Away tetap bisa dipesan.
-- 2. Skema Ongkir (versi owner, semua angka diatur admin):
--    - Jarak ≤ radius gratis → Rp0
--    - Sisa jarak di luar radius: tiap kelipatan penuh dikenai tarif per kelipatan,
--      sisa yang belum genap satu kelipatan dikenai tarif per 100 m (dibulatkan ke atas per 100 m)
--    - Di atas jarak maksimal → tidak bisa pesan antar
--    Contoh (gratis 2 km, Rp5.000/2 km, Rp500/100 m, maks 11 km):
--      4 km → Rp5.000 · 4,5 km → Rp7.500 · 6 km → Rp10.000 · 11 km → Rp25.000 · 11,3 km → ditolak
--    Gratis ongkir/potongan ongkir lain dibuat lewat Promosi > Diskon (sasaran Ongkir).
-- 3. Biaya Layanan: 1 nominal per checkout online.
-- 4. Payment gateway: MDR 0,7% + PPN 11% dari MDR (info read-only).
-- Semua perubahan tercatat di Riwayat Perubahan.
-- ============================================================

create table public.online_order_settings (
  id boolean primary key default true check (id),
  free_radius_km numeric(6,2) not null default 2 check (free_radius_km >= 0),
  fee_per_step numeric(14,2) not null default 5000 check (fee_per_step >= 0),
  step_km numeric(6,2) not null default 2 check (step_km > 0),
  fee_per_100m numeric(14,2) not null default 500 check (fee_per_100m >= 0),
  max_distance_km numeric(6,2) not null default 11 check (max_distance_km > 0),
  service_fee numeric(14,2) not null default 1000 check (service_fee >= 0),
  mdr_percent numeric(5,2) not null default 0.7,
  ppn_percent numeric(5,2) not null default 11,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.employees(id)
);

insert into public.online_order_settings (id) values (true);

create table public.online_product_pauses (
  product_id uuid primary key references public.products(id) on delete cascade,
  paused_at timestamptz not null default now(),
  paused_by uuid references public.employees(id)
);

create table public.online_order_history (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('jeda', 'ongkir', 'biaya_layanan')),
  description text not null,
  before_data jsonb,
  after_data jsonb,
  changed_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);

create index online_order_history_created_idx on public.online_order_history (created_at desc);

alter table public.online_order_settings enable row level security;
alter table public.online_product_pauses enable row level security;
alter table public.online_order_history enable row level security;
create policy "online_order_settings_select" on public.online_order_settings for select to authenticated using (true);
create policy "online_order_settings_admin_write" on public.online_order_settings for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "online_product_pauses_select" on public.online_product_pauses for select to authenticated using (true);
create policy "online_product_pauses_admin_write" on public.online_product_pauses for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "online_order_history_admin_all" on public.online_order_history for all to authenticated
  using (is_admin()) with check (is_admin());


-- ------------------------------------------------------------
-- Hitung ongkir dari jarak (km)
-- ------------------------------------------------------------
create or replace function public.calc_delivery_fee(p_distance_km numeric)
returns table (
  is_deliverable boolean,
  fee numeric,
  free_km numeric,
  full_steps integer,
  step_fee numeric,
  remainder_m integer,
  remainder_fee numeric
)
language plpgsql
stable
set search_path = public
as $$
declare
  s record;
  v_beyond_m integer;
  v_step_m integer;
  v_steps integer;
  v_rem_m integer;
  v_units integer;
begin
  select * into s from online_order_settings;

  if p_distance_km is null or p_distance_km < 0 then
    raise exception 'Jarak tidak valid.';
  end if;
  if p_distance_km > s.max_distance_km then
    return query select false, null::numeric, s.free_radius_km, 0, 0::numeric, 0, 0::numeric;
    return;
  end if;
  if p_distance_km <= s.free_radius_km then
    return query select true, 0::numeric, s.free_radius_km, 0, 0::numeric, 0, 0::numeric;
    return;
  end if;

  -- Hitung dalam meter supaya tidak ada selisih pembulatan desimal
  v_beyond_m := round((p_distance_km - s.free_radius_km) * 1000);
  v_step_m := round(s.step_km * 1000);
  v_steps := v_beyond_m / v_step_m;
  v_rem_m := v_beyond_m - v_steps * v_step_m;
  v_units := ceil(v_rem_m / 100.0);

  return query select
    true,
    v_steps * s.fee_per_step + v_units * s.fee_per_100m,
    s.free_radius_km,
    v_steps,
    v_steps * s.fee_per_step,
    v_rem_m,
    v_units * s.fee_per_100m;
end;
$$;

-- Produk tampil di Web Customer: aktif, tersedia online, tidak sedang dijeda
create or replace function public.is_product_visible_online(p_product_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from products p
    where p.id = p_product_id and p.is_active and p.available_online
      and not exists (select 1 from online_product_pauses op where op.product_id = p.id)
  );
$$;


-- ------------------------------------------------------------
-- Aksi admin
-- ------------------------------------------------------------
create or replace function public.pause_product_online(p_product_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_name text;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur order online.' using errcode = '42501';
  end if;
  select name into v_name from products where id = p_product_id;
  if v_name is null then raise exception 'Produk tidak ditemukan.'; end if;
  if exists (select 1 from online_product_pauses where product_id = p_product_id) then
    raise exception 'Produk ini sudah dijeda.';
  end if;

  insert into online_product_pauses (product_id, paused_by) values (p_product_id, auth.uid());
  insert into online_order_history (section, description, changed_by)
  values ('jeda', 'Menjeda tayang online: ' || v_name, auth.uid());
end;
$$;

create or replace function public.resume_product_online(p_product_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_name text;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur order online.' using errcode = '42501';
  end if;
  select name into v_name from products where id = p_product_id;
  delete from online_product_pauses where product_id = p_product_id;
  if not found then raise exception 'Produk ini tidak sedang dijeda.'; end if;

  insert into online_order_history (section, description, changed_by)
  values ('jeda', 'Menampilkan kembali di online: ' || coalesce(v_name, '—'), auth.uid());
end;
$$;

create or replace function public.save_delivery_settings(
  p_free_radius_km numeric,
  p_fee_per_step numeric,
  p_step_km numeric,
  p_fee_per_100m numeric,
  p_max_distance_km numeric
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur order online.' using errcode = '42501';
  end if;
  if p_free_radius_km is null or p_free_radius_km < 0 then raise exception 'Radius gratis tidak boleh kosong/minus.'; end if;
  if p_fee_per_step is null or p_fee_per_step < 0 then raise exception 'Tarif per kelipatan tidak boleh kosong/minus.'; end if;
  if coalesce(p_step_km, 0) <= 0 then raise exception 'Kelipatan jarak harus lebih dari 0 km.'; end if;
  if p_fee_per_100m is null or p_fee_per_100m < 0 then raise exception 'Tarif per 100 m tidak boleh kosong/minus.'; end if;
  if coalesce(p_max_distance_km, 0) <= 0 then raise exception 'Jarak maksimal harus lebih dari 0 km.'; end if;
  if p_max_distance_km < p_free_radius_km then
    raise exception 'Jarak maksimal tidak boleh lebih kecil dari radius gratis.';
  end if;

  select jsonb_build_object('free_radius_km', free_radius_km, 'fee_per_step', fee_per_step, 'step_km', step_km,
                            'fee_per_100m', fee_per_100m, 'max_distance_km', max_distance_km)
    into v_before from online_order_settings;

  update online_order_settings set
    free_radius_km = p_free_radius_km, fee_per_step = p_fee_per_step, step_km = p_step_km,
    fee_per_100m = p_fee_per_100m, max_distance_km = p_max_distance_km,
    updated_at = now(), updated_by = auth.uid();

  v_after := jsonb_build_object('free_radius_km', p_free_radius_km, 'fee_per_step', p_fee_per_step, 'step_km', p_step_km,
                                'fee_per_100m', p_fee_per_100m, 'max_distance_km', p_max_distance_km);

  insert into online_order_history (section, description, before_data, after_data, changed_by)
  values ('ongkir', 'Mengubah skema ongkir', v_before, v_after, auth.uid());
end;
$$;

create or replace function public.save_service_fee(p_service_fee numeric)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_before numeric;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur order online.' using errcode = '42501';
  end if;
  if p_service_fee is null or p_service_fee < 0 then raise exception 'Biaya layanan tidak boleh kosong/minus.'; end if;

  select service_fee into v_before from online_order_settings;
  update online_order_settings set service_fee = p_service_fee, updated_at = now(), updated_by = auth.uid();

  insert into online_order_history (section, description, before_data, after_data, changed_by)
  values ('biaya_layanan', 'Mengubah biaya layanan',
          jsonb_build_object('service_fee', v_before), jsonb_build_object('service_fee', p_service_fee), auth.uid());
end;
$$;

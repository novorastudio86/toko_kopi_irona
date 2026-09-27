-- ============================================================
-- PROMOSI > DISKON
--
-- Aturan (PRD + keputusan owner):
-- - Channel Online/Offline. Tipe Otomatis/Manual; Online + Manual = voucher (diklaim dulu di Web Customer).
-- - Jenis potongan: nominal (Rp) / persen (opsional maksimal potongan) / gratis ongkir
--   (khusus online, tanpa pilih produk, gratis penuh atau sampai batas maksimal).
-- - Potongan dikenakan SEKALI per transaksi; "Berlaku Kelipatan" = dikali kelipatan syarat minimal.
-- - Kalau beberapa diskon memenuhi syarat, hanya 1 yang dipakai (potongan terbesar) — dieksekusi di Kasir/Web Customer.
-- - Hari & jam kosong = setiap hari, sepanjang jam buka.
-- - Status: aktif / nonaktif (manual) / kedaluwarsa (otomatis setelah tanggal selesai, terkunci permanen).
-- - Hapus hanya kalau belum pernah dipakai transaksi / diklaim.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Struktur promotions (tabel masih kosong, aman diubah)
-- ------------------------------------------------------------
alter table public.promotions
  drop column product_id,
  drop column criteria_min_qty,
  drop column criteria_repeatable,
  drop column bonus_amount,
  add column channel_offline boolean not null default true,
  add column channel_online boolean not null default false,
  add column discount_kind text not null default 'nominal'
    check (discount_kind in ('nominal', 'persen', 'gratis_ongkir')),
  add column discount_value numeric(14,2),           -- Rp untuk nominal, % untuk persen, null untuk gratis ongkir
  add column max_discount numeric(14,2),             -- batas maksimal (persen / gratis ongkir), opsional
  add column applies_to_all_products boolean not null default false,
  add column target_customer text not null default 'semua'
    check (target_customer in ('semua', 'member', 'non_member', 'member_baru')),
  add column min_purchase_type text not null default 'none'
    check (min_purchase_type in ('none', 'qty', 'nominal')),
  add column min_purchase_value numeric(14,2),
  add column is_repeatable boolean not null default false,          -- Berlaku Kelipatan
  add column max_one_claim_per_customer boolean not null default false,
  add column valid_days smallint[] not null default '{}',           -- 0=Minggu..6=Sabtu, kosong = setiap hari
  add column valid_start_time time,
  add column valid_end_time time,
  add column created_by uuid references public.employees(id),
  add constraint promotions_channel_check check (channel_offline or channel_online),
  add constraint promotions_dates_check check (end_date >= start_date);

comment on column public.promotions.promo_type is
  'otomatis = diterapkan otomatis bila syarat terpenuhi; manual = offline dipilih kasir, online jadi voucher yang diklaim';

-- Produk yang kena diskon (kalau tidak applies_to_all_products)
create table public.promotion_products (
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  primary key (promotion_id, product_id)
);

-- Diskon per transaksi (bukan per item) — dicatat di level transaksi
alter table public.transactions
  add column promotion_id uuid references public.promotions(id);

-- Riwayat Perubahan: siapa mengubah apa & kapan (before/after berupa snapshot)
create table public.promotion_history (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  action text not null check (action in ('dibuat', 'diubah', 'diaktifkan', 'dinonaktifkan')),
  before_data jsonb,
  after_data jsonb,
  changed_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);

create index promotion_history_promotion_idx on public.promotion_history (promotion_id, created_at desc);

-- Riwayat Klaim voucher (Online + Manual) — diisi dari Web Customer nanti
create table public.promotion_claims (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id),
  customer_id uuid not null references public.customers(id),
  claimed_at timestamptz not null default now(),
  used_at timestamptz,
  transaction_id uuid references public.transactions(id)
);

create index promotion_claims_promotion_idx on public.promotion_claims (promotion_id, claimed_at desc);


-- ------------------------------------------------------------
-- 2. RLS
-- ------------------------------------------------------------
alter table public.promotion_products enable row level security;
create policy "promotion_products_select" on public.promotion_products for select to authenticated using (true);
create policy "promotion_products_admin_write" on public.promotion_products for all to authenticated
  using (is_admin()) with check (is_admin());

alter table public.promotion_history enable row level security;
create policy "promotion_history_admin_all" on public.promotion_history for all to authenticated
  using (is_admin()) with check (is_admin());

alter table public.promotion_claims enable row level security;
create policy "promotion_claims_admin_all" on public.promotion_claims for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "promotion_claims_employee_select" on public.promotion_claims for select to authenticated
  using (is_employee());
create policy "promotion_claims_self_select" on public.promotion_claims for select to authenticated
  using (customer_id = current_customer_id());


-- ------------------------------------------------------------
-- 3. Ringkasan (status otomatis, jumlah dipakai/diklaim)
-- ------------------------------------------------------------
create or replace view public.promotion_overview
with (security_invoker = true)
as
select
  p.*,
  case
    when p.end_date < jakarta_today() then 'kedaluwarsa'
    when not p.is_active then 'nonaktif'
    else 'aktif'
  end as status,
  p.start_date > jakarta_today() as is_upcoming,
  (select count(*) from promotion_products pp where pp.promotion_id = p.id) as product_count,
  (
    (select count(*) from transactions t where t.promotion_id = p.id)
    + (select count(*) from transaction_items ti where ti.promotion_id = p.id)
  ) as used_count,
  (select count(*) from promotion_claims c where c.promotion_id = p.id) as claim_count
from public.promotions p;


-- ------------------------------------------------------------
-- 4. Simpan (tambah/ubah) dengan validasi lengkap + riwayat
-- ------------------------------------------------------------
create or replace function public.promotion_snapshot(p_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select to_jsonb(p) - 'created_at' - 'updated_at' - 'created_by'
         || jsonb_build_object(
              'product_names',
              coalesce((select jsonb_agg(pr.name order by pr.name)
                        from promotion_products pp join products pr on pr.id = pp.product_id
                        where pp.promotion_id = p.id), '[]'::jsonb)
            )
  from promotions p where p.id = p_id;
$$;

-- p_data: { name, channel_offline, channel_online, promo_type, discount_kind, discount_value, max_discount,
--           applies_to_all_products, target_customer, min_purchase_type, min_purchase_value, is_repeatable,
--           max_one_claim_per_customer, start_date, end_date, valid_days, valid_start_time, valid_end_time }
create or replace function public.save_promotion(
  p_id uuid,
  p_data jsonb,
  p_product_ids uuid[] default '{}'
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_before jsonb;
  v_existing record;
  v_name text := trim(p_data ->> 'name');
  v_offline boolean := coalesce((p_data ->> 'channel_offline')::boolean, false);
  v_online boolean := coalesce((p_data ->> 'channel_online')::boolean, false);
  v_type text := coalesce(p_data ->> 'promo_type', 'otomatis');
  v_kind text := coalesce(p_data ->> 'discount_kind', 'nominal');
  v_value numeric := nullif(p_data ->> 'discount_value', '')::numeric;
  v_max numeric := nullif(p_data ->> 'max_discount', '')::numeric;
  v_all boolean := coalesce((p_data ->> 'applies_to_all_products')::boolean, false);
  v_target text := coalesce(p_data ->> 'target_customer', 'semua');
  v_min_type text := coalesce(p_data ->> 'min_purchase_type', 'none');
  v_min_value numeric := nullif(p_data ->> 'min_purchase_value', '')::numeric;
  v_repeat boolean := coalesce((p_data ->> 'is_repeatable')::boolean, false);
  v_one_claim boolean := coalesce((p_data ->> 'max_one_claim_per_customer')::boolean, false);
  v_start date := nullif(p_data ->> 'start_date', '')::date;
  v_end date := nullif(p_data ->> 'end_date', '')::date;
  v_days smallint[] := coalesce(
    (select array_agg(distinct x::smallint order by x::smallint) from jsonb_array_elements_text(p_data -> 'valid_days') x),
    '{}'
  );
  v_t_start time := nullif(p_data ->> 'valid_start_time', '')::time;
  v_t_end time := nullif(p_data ->> 'valid_end_time', '')::time;
  v_products uuid[] := coalesce(p_product_ids, '{}');
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur diskon.' using errcode = '42501';
  end if;

  if v_id is not null then
    select * into v_existing from promotions where id = v_id for update;
    if v_existing.id is null then
      raise exception 'Diskon tidak ditemukan.';
    end if;
    if v_existing.end_date < jakarta_today() then
      raise exception 'Diskon ini sudah kedaluwarsa dan terkunci, tidak bisa diubah. Buat diskon baru.';
    end if;
    v_before := promotion_snapshot(v_id);
  end if;

  -- ----- Validasi -----
  if coalesce(v_name, '') = '' then raise exception 'Nama diskon wajib diisi.'; end if;
  if v_type not in ('otomatis', 'manual') then raise exception 'Tipe diskon tidak valid.'; end if;

  if v_kind = 'gratis_ongkir' then
    -- Ongkir hanya ada di pesanan online; tidak pakai pilihan produk
    v_offline := false;
    v_online := true;
    v_value := null;
    v_all := true;
    v_products := '{}';
    if v_max is not null and v_max <= 0 then raise exception 'Maksimal potongan ongkir harus lebih dari 0.'; end if;
  elsif v_kind = 'nominal' then
    if coalesce(v_value, 0) <= 0 then raise exception 'Nominal potongan harus lebih dari 0.'; end if;
    v_max := null;
  elsif v_kind = 'persen' then
    if coalesce(v_value, 0) <= 0 or v_value > 100 then
      raise exception 'Persentase potongan harus antara 1 dan 100.';
    end if;
    if v_max is not null and v_max <= 0 then raise exception 'Maksimal potongan harus lebih dari 0.'; end if;
  else
    raise exception 'Jenis potongan tidak valid.';
  end if;

  if not (v_offline or v_online) then raise exception 'Pilih minimal satu channel (Online/Offline).'; end if;

  if v_kind <> 'gratis_ongkir' and not v_all and coalesce(array_length(v_products, 1), 0) = 0 then
    raise exception 'Pilih produk yang kena diskon, atau centang Semua Produk.';
  end if;
  if v_all then v_products := '{}'; end if;

  if v_target not in ('semua', 'member', 'non_member', 'member_baru') then
    raise exception 'Target pelanggan tidak valid.';
  end if;

  if v_min_type = 'none' then
    v_min_value := null;
    v_repeat := false;
  elsif v_min_type = 'qty' then
    if coalesce(v_min_value, 0) < 1 or v_min_value <> floor(v_min_value) then
      raise exception 'Minimal pembelian (jumlah) harus bilangan bulat ≥ 1.';
    end if;
  elsif v_min_type = 'nominal' then
    if coalesce(v_min_value, 0) <= 0 then raise exception 'Minimal pembelian (Rp) harus lebih dari 0.'; end if;
  else
    raise exception 'Jenis minimal pembelian tidak valid.';
  end if;

  -- "Maks 1x klaim" hanya bermakna untuk voucher (Online + Manual)
  if not (v_online and v_type = 'manual') then v_one_claim := false; end if;

  if v_start is null or v_end is null then raise exception 'Periode berlaku wajib diisi.'; end if;
  if v_end < v_start then raise exception 'Tanggal selesai tidak boleh sebelum tanggal mulai.'; end if;
  if v_end < jakarta_today() then raise exception 'Tanggal selesai sudah lewat.'; end if;

  if exists (select 1 from unnest(v_days) d where d not between 0 and 6) then
    raise exception 'Hari berlaku tidak valid.';
  end if;
  if (v_t_start is null) <> (v_t_end is null) then
    raise exception 'Isi jam mulai dan jam selesai, atau kosongkan keduanya.';
  end if;
  if v_t_start is not null and v_t_end <= v_t_start then
    raise exception 'Jam selesai harus setelah jam mulai.';
  end if;

  -- ----- Simpan -----
  if v_id is null then
    insert into promotions (
      name, promo_type, channel_offline, channel_online, discount_kind, discount_value, max_discount,
      applies_to_all_products, target_customer, min_purchase_type, min_purchase_value, is_repeatable,
      max_one_claim_per_customer, start_date, end_date, valid_days, valid_start_time, valid_end_time,
      is_active, created_by
    ) values (
      v_name, v_type, v_offline, v_online, v_kind, v_value, v_max,
      v_all, v_target, v_min_type, v_min_value, v_repeat,
      v_one_claim, v_start, v_end, v_days, v_t_start, v_t_end,
      true, auth.uid()
    ) returning id into v_id;
  else
    update promotions set
      name = v_name, promo_type = v_type, channel_offline = v_offline, channel_online = v_online,
      discount_kind = v_kind, discount_value = v_value, max_discount = v_max,
      applies_to_all_products = v_all, target_customer = v_target,
      min_purchase_type = v_min_type, min_purchase_value = v_min_value, is_repeatable = v_repeat,
      max_one_claim_per_customer = v_one_claim, start_date = v_start, end_date = v_end,
      valid_days = v_days, valid_start_time = v_t_start, valid_end_time = v_t_end
    where id = v_id;
    delete from promotion_products where promotion_id = v_id;
  end if;

  insert into promotion_products (promotion_id, product_id)
  select v_id, x from unnest(v_products) x;

  insert into promotion_history (promotion_id, action, before_data, after_data, changed_by)
  values (v_id, case when v_before is null then 'dibuat' else 'diubah' end, v_before, promotion_snapshot(v_id), auth.uid());

  return v_id;
end;
$$;

create or replace function public.set_promotion_active(p_id uuid, p_active boolean)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_row record;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur diskon.' using errcode = '42501';
  end if;

  select * into v_row from promotions where id = p_id for update;
  if v_row.id is null then raise exception 'Diskon tidak ditemukan.'; end if;
  if v_row.end_date < jakarta_today() then
    raise exception 'Diskon ini sudah kedaluwarsa dan terkunci, statusnya tidak bisa diubah.';
  end if;
  if v_row.is_active = p_active then
    raise exception 'Diskon ini sudah %.', case when p_active then 'aktif' else 'nonaktif' end;
  end if;

  update promotions set is_active = p_active where id = p_id;

  insert into promotion_history (promotion_id, action, changed_by)
  values (p_id, case when p_active then 'diaktifkan' else 'dinonaktifkan' end, auth.uid());
end;
$$;

create or replace function public.delete_promotion(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menghapus diskon.' using errcode = '42501';
  end if;
  if exists (select 1 from transactions where promotion_id = p_id)
     or exists (select 1 from transaction_items where promotion_id = p_id)
     or exists (select 1 from promotion_claims where promotion_id = p_id) then
    raise exception 'Diskon ini sudah pernah dipakai/diklaim, tidak bisa dihapus. Nonaktifkan saja.';
  end if;

  delete from promotions where id = p_id;
end;
$$;

-- ============================================================
-- DISKON — REVISI SESUAI PRD TERBARU
--
-- - Channel: pilih SATU (Offline / Online).
-- - Online punya Sasaran: Harga Produk / Ongkir. Offline selalu Harga Produk.
--   Ongkir: Jarak Maksimal (km) opsional, kosong = semua jarak.
-- - Nilai: Nominal (Rp) / Persentase (%) — berlaku untuk produk maupun ongkir
--   (100% ongkir = gratis ongkir). Tidak ada lagi "maksimal potongan".
-- - Target: Semua / Member.
-- - Minimal pembelian WAJIB (Rp atau pcs); tidak ada "tanpa minimal".
-- - Deskripsi; "Berlaku juga untuk Take Away" (khusus Offline, default ya).
-- - Maks 1x klaim per pelanggan hanya untuk Online.
-- - Tetap: 1 diskon per transaksi (potongan terbesar), kelipatan, kedaluwarsa terkunci permanen.
-- Tabel promotions masih kosong saat revisi ini dibuat.
-- ============================================================

drop view if exists public.promotion_overview;

alter table public.promotions
  drop constraint promotions_channel_check,
  drop constraint promotions_discount_kind_check,
  drop constraint promotions_target_customer_check,
  drop constraint promotions_min_purchase_type_check,
  drop column channel_offline,
  drop column channel_online,
  drop column max_discount,
  add column channel text not null default 'offline' check (channel in ('offline', 'online')),
  add column discount_target text not null default 'produk' check (discount_target in ('produk', 'ongkir')),
  add column description text,
  add column max_distance_km numeric(6,2) check (max_distance_km > 0),
  add column applies_to_take_away boolean not null default true,
  add constraint promotions_discount_kind_check check (discount_kind in ('nominal', 'persen')),
  add constraint promotions_target_customer_check check (target_customer in ('semua', 'member')),
  add constraint promotions_min_purchase_type_check check (min_purchase_type in ('qty', 'nominal')),
  add constraint promotions_target_channel_check check (channel = 'online' or discount_target = 'produk');

alter table public.promotions
  alter column min_purchase_type set default 'nominal',
  alter column target_customer set default 'semua';

comment on column public.promotions.discount_target is 'produk = potong harga produk; ongkir = potong ongkir (khusus Online)';
comment on column public.promotions.applies_to_take_away is 'Khusus Offline: diskon juga berlaku untuk pesanan Take Away';

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


-- p_data: { name, description, channel, discount_target, discount_kind, discount_value, max_distance_km,
--           applies_to_all_products, promo_type, target_customer, min_purchase_type, min_purchase_value,
--           is_repeatable, max_one_claim_per_customer, applies_to_take_away,
--           start_date, end_date, valid_days, valid_start_time, valid_end_time }
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
  v_desc text := nullif(trim(p_data ->> 'description'), '');
  v_channel text := coalesce(p_data ->> 'channel', 'offline');
  v_target_kind text := coalesce(p_data ->> 'discount_target', 'produk');
  v_kind text := coalesce(p_data ->> 'discount_kind', 'nominal');
  v_value numeric := nullif(p_data ->> 'discount_value', '')::numeric;
  v_max_km numeric := nullif(p_data ->> 'max_distance_km', '')::numeric;
  v_all boolean := coalesce((p_data ->> 'applies_to_all_products')::boolean, false);
  v_type text := coalesce(p_data ->> 'promo_type', 'otomatis');
  v_target text := coalesce(p_data ->> 'target_customer', 'semua');
  v_min_type text := coalesce(p_data ->> 'min_purchase_type', 'nominal');
  v_min_value numeric := nullif(p_data ->> 'min_purchase_value', '')::numeric;
  v_repeat boolean := coalesce((p_data ->> 'is_repeatable')::boolean, false);
  v_one_claim boolean := coalesce((p_data ->> 'max_one_claim_per_customer')::boolean, false);
  v_take_away boolean := coalesce((p_data ->> 'applies_to_take_away')::boolean, true);
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
  if v_channel not in ('offline', 'online') then raise exception 'Pilih channel Offline atau Online.'; end if;
  if v_type not in ('otomatis', 'manual') then raise exception 'Tipe diskon tidak valid.'; end if;

  -- Offline selalu potong harga produk
  if v_channel = 'offline' then v_target_kind := 'produk'; end if;
  if v_target_kind not in ('produk', 'ongkir') then raise exception 'Sasaran diskon tidak valid.'; end if;

  if v_kind = 'nominal' then
    if coalesce(v_value, 0) <= 0 then raise exception 'Nilai potongan harus lebih dari 0.'; end if;
  elsif v_kind = 'persen' then
    if coalesce(v_value, 0) <= 0 or v_value > 100 then
      raise exception 'Persentase potongan harus antara 1 dan 100.';
    end if;
  else
    raise exception 'Jenis nilai tidak valid.';
  end if;

  if v_target_kind = 'ongkir' then
    v_all := true;
    v_products := '{}';
    if v_max_km is not null and v_max_km <= 0 then raise exception 'Jarak maksimal harus lebih dari 0 km.'; end if;
  else
    v_max_km := null;
    if not v_all and coalesce(array_length(v_products, 1), 0) = 0 then
      raise exception 'Pilih produk yang kena diskon, atau centang Semua Produk.';
    end if;
    if v_all then v_products := '{}'; end if;
  end if;

  if v_target not in ('semua', 'member') then raise exception 'Target pelanggan tidak valid.'; end if;

  if v_min_type = 'qty' then
    if coalesce(v_min_value, 0) < 1 or v_min_value <> floor(v_min_value) then
      raise exception 'Minimal pembelian (jumlah produk) harus bilangan bulat ≥ 1.';
    end if;
  elsif v_min_type = 'nominal' then
    if coalesce(v_min_value, 0) <= 0 then raise exception 'Minimal pembelian (Rp) wajib diisi.'; end if;
  else
    raise exception 'Jenis minimal pembelian tidak valid.';
  end if;

  -- Maks 1x klaim hanya relevan untuk Online; Take Away hanya relevan untuk Offline
  if v_channel <> 'online' then v_one_claim := false; end if;
  if v_channel <> 'offline' then v_take_away := false; end if;

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
      name, description, channel, discount_target, discount_kind, discount_value, max_distance_km,
      applies_to_all_products, promo_type, target_customer, min_purchase_type, min_purchase_value,
      is_repeatable, max_one_claim_per_customer, applies_to_take_away,
      start_date, end_date, valid_days, valid_start_time, valid_end_time, is_active, created_by
    ) values (
      v_name, v_desc, v_channel, v_target_kind, v_kind, v_value, v_max_km,
      v_all, v_type, v_target, v_min_type, v_min_value,
      v_repeat, v_one_claim, v_take_away,
      v_start, v_end, v_days, v_t_start, v_t_end, true, auth.uid()
    ) returning id into v_id;
  else
    update promotions set
      name = v_name, description = v_desc, channel = v_channel, discount_target = v_target_kind,
      discount_kind = v_kind, discount_value = v_value, max_distance_km = v_max_km,
      applies_to_all_products = v_all, promo_type = v_type, target_customer = v_target,
      min_purchase_type = v_min_type, min_purchase_value = v_min_value, is_repeatable = v_repeat,
      max_one_claim_per_customer = v_one_claim, applies_to_take_away = v_take_away,
      start_date = v_start, end_date = v_end, valid_days = v_days,
      valid_start_time = v_t_start, valid_end_time = v_t_end
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

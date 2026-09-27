-- ============================================================
-- PROMOSI > POINT REWARD
--
-- A. Aturan Dapat Poin (permintaan owner):
--    - Tingkat bebas ditambah: nominal minimal → poin (mis. 10rb = 1, 30rb = 5).
--    - Nominal dipecah mulai dari tingkat terbesar yang muat (greedy): 50rb = 30+10+10 = 7 poin.
--    - Sisa ≥ batas pembulatan dihitung 1 tingkat terkecil lagi; sisa di bawahnya dibuang.
--      16rb = 10 + sisa 6 → 2 poin; 13rb = 10 + sisa 3 → 1 poin. Batas pembulatan diatur admin (default 5rb).
--    - Perubahan aturan hanya berlaku untuk transaksi baru, tercatat di riwayat.
-- B. Katalog Reward + kode klaim (PRD):
--    - Member klaim di Web Customer → poin terpotong, dapat kode unik, berlaku 1 hari (24 jam).
--    - Kasir tukar kode → Sudah Ditukar. Lewat 24 jam → Hangus otomatis, poin tidak kembali.
--    - Admin bisa MEMBATALKAN klaim yang masih Menunggu Ditukar (member tidak jadi pesan),
--      alasan wajib, poin dikembalikan. Kode yang sudah ditukar / hangus tidak bisa dibatalkan.
--    - Menonaktifkan reward tidak menghanguskan kode yang sudah diklaim.
--    - Stok penukaran (wajib, diatur admin lewat form Ubah): berkurang saat kode DITUKAR di kasir.
--      Klaim yang masih menunggu MENCADANGKAN stok, supaya tidak ada member yang poinnya terpotong
--      untuk hadiah yang sudah habis. Sisa bisa diklaim = stok − kode menunggu. Batal/hangus = cadangan kembali.
-- ============================================================


-- ------------------------------------------------------------
-- A. Aturan Dapat Poin
-- ------------------------------------------------------------
create table public.point_earning_settings (
  id boolean primary key default true check (id),
  rounding_threshold numeric(14,2) not null default 5000 check (rounding_threshold >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.employees(id)
);

create table public.point_earning_tiers (
  id uuid primary key default gen_random_uuid(),
  min_amount numeric(14,2) not null unique check (min_amount > 0),
  points integer not null check (points > 0)
);

create table public.point_rule_history (
  id uuid primary key default gen_random_uuid(),
  before_data jsonb,
  after_data jsonb not null,
  changed_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);

-- Nilai awal sesuai contoh owner (bisa diubah admin)
insert into public.point_earning_settings (id, rounding_threshold) values (true, 5000);
insert into public.point_earning_tiers (min_amount, points) values (10000, 1), (30000, 5);

alter table public.point_earning_settings enable row level security;
alter table public.point_earning_tiers enable row level security;
alter table public.point_rule_history enable row level security;
create policy "point_earning_settings_select" on public.point_earning_settings for select to authenticated using (true);
create policy "point_earning_settings_admin_write" on public.point_earning_settings for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "point_earning_tiers_select" on public.point_earning_tiers for select to authenticated using (true);
create policy "point_earning_tiers_admin_write" on public.point_earning_tiers for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "point_rule_history_admin_all" on public.point_rule_history for all to authenticated
  using (is_admin()) with check (is_admin());

create or replace function public.point_rules_snapshot()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'rounding_threshold', (select rounding_threshold from point_earning_settings),
    'tiers', coalesce((select jsonb_agg(jsonb_build_object('min_amount', min_amount, 'points', points) order by min_amount)
                       from point_earning_tiers), '[]'::jsonb)
  );
$$;

-- Hitung poin dari nominal belanja (nilai produk setelah diskon, tanpa ongkir/biaya layanan).
-- breakdown: [{min_amount, points, count}] + baris pembulatan kalau ada.
create or replace function public.calc_points(p_amount numeric)
returns table (points integer, breakdown jsonb)
language plpgsql
stable
set search_path = public
as $$
declare
  v_remaining numeric := greatest(coalesce(p_amount, 0), 0);
  v_points integer := 0;
  v_breakdown jsonb := '[]'::jsonb;
  v_threshold numeric;
  v_tier record;
  v_n integer;
  v_smallest record;
begin
  select rounding_threshold into v_threshold from point_earning_settings;

  for v_tier in select * from point_earning_tiers order by min_amount desc loop
    v_n := floor(v_remaining / v_tier.min_amount);
    if v_n > 0 then
      v_points := v_points + v_n * v_tier.points;
      v_remaining := v_remaining - v_n * v_tier.min_amount;
      v_breakdown := v_breakdown || jsonb_build_object('min_amount', v_tier.min_amount, 'points', v_tier.points, 'count', v_n);
    end if;
  end loop;

  -- Pembulatan sisa: dihitung sebagai 1 tingkat terkecil lagi
  select * into v_smallest from point_earning_tiers order by min_amount limit 1;
  if v_smallest.id is not null and coalesce(v_threshold, 0) > 0 and v_remaining >= v_threshold then
    v_points := v_points + v_smallest.points;
    v_breakdown := v_breakdown || jsonb_build_object(
      'min_amount', v_smallest.min_amount, 'points', v_smallest.points, 'count', 1, 'rounded_from', v_remaining
    );
    v_remaining := 0;
  end if;

  return query select v_points, v_breakdown;
end;
$$;

-- Simpan seluruh aturan sekaligus. p_tiers: [{"min_amount":10000,"points":1}, ...]
create or replace function public.save_point_rules(p_tiers jsonb, p_rounding_threshold numeric)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_before jsonb := point_rules_snapshot();
  v_count int;
  v_distinct int;
  v_smallest numeric;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengubah aturan poin.' using errcode = '42501';
  end if;

  select count(*), count(distinct (t ->> 'min_amount')::numeric), min((t ->> 'min_amount')::numeric)
    into v_count, v_distinct, v_smallest
  from jsonb_array_elements(coalesce(p_tiers, '[]'::jsonb)) t;

  if v_count = 0 then
    raise exception 'Minimal harus ada 1 tingkat poin.';
  end if;
  if v_count <> v_distinct then
    raise exception 'Nominal tiap tingkat tidak boleh sama.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_tiers) t
    where coalesce((t ->> 'min_amount')::numeric, 0) <= 0 or coalesce((t ->> 'points')::numeric, 0) <= 0
       or (t ->> 'points')::numeric <> floor((t ->> 'points')::numeric)
  ) then
    raise exception 'Nominal dan poin setiap tingkat harus lebih dari 0 (poin bilangan bulat).';
  end if;
  if coalesce(p_rounding_threshold, 0) < 0 or coalesce(p_rounding_threshold, 0) >= v_smallest then
    raise exception 'Batas pembulatan harus di bawah nominal tingkat terkecil (%). Isi 0 kalau tanpa pembulatan.',
      replace(to_char(v_smallest, 'FM999G999G999'), ',', '.');
  end if;

  delete from point_earning_tiers where true;
  insert into point_earning_tiers (min_amount, points)
  select (t ->> 'min_amount')::numeric, (t ->> 'points')::integer from jsonb_array_elements(p_tiers) t;

  update point_earning_settings
  set rounding_threshold = coalesce(p_rounding_threshold, 0), updated_at = now(), updated_by = auth.uid();

  insert into point_rule_history (before_data, after_data, changed_by)
  values (v_before, point_rules_snapshot(), auth.uid());
end;
$$;


-- ------------------------------------------------------------
-- B. Katalog Reward & kode klaim
-- ------------------------------------------------------------
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product_id uuid not null references public.products(id),
  points_required integer not null check (points_required > 0),
  stock integer not null check (stock >= 0),      -- sisa stok fisik; berkurang saat kode ditukar di kasir
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger rewards_set_updated_at before update on public.rewards
  for each row execute function public.set_updated_at();

create table public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards(id),
  customer_id uuid not null references public.customers(id),
  code text not null unique,
  points_used integer not null check (points_used > 0),
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references public.employees(id),
  transaction_id uuid references public.transactions(id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.employees(id),
  cancel_reason text
);

create index reward_claims_reward_idx on public.reward_claims (reward_id, claimed_at desc);
create index reward_claims_customer_idx on public.reward_claims (customer_id, claimed_at desc);

-- Riwayat poin "redeem" menunjuk ke klaimnya
alter table public.point_transactions
  add column reward_claim_id uuid references public.reward_claims(id),
  drop constraint point_transactions_point_type_check,
  add constraint point_transactions_point_type_check
    check (point_type in ('earn', 'redeem', 'redeem_cancel', 'adjust', 'refund_reversal'));

alter table public.rewards enable row level security;
create policy "rewards_select" on public.rewards for select to authenticated using (true);
create policy "rewards_admin_write" on public.rewards for all to authenticated
  using (is_admin()) with check (is_admin());

alter table public.reward_claims enable row level security;
create policy "reward_claims_admin_all" on public.reward_claims for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "reward_claims_employee_select" on public.reward_claims for select to authenticated
  using (is_employee());
create policy "reward_claims_self_select" on public.reward_claims for select to authenticated
  using (customer_id = current_customer_id());

create or replace view public.reward_claim_overview
with (security_invoker = true)
as
select
  c.*,
  case
    when c.cancelled_at is not null then 'dibatalkan'
    when c.redeemed_at is not null then 'sudah_ditukar'
    when now() > c.expires_at then 'hangus'
    else 'menunggu'
  end as status
from public.reward_claims c;

create or replace view public.reward_overview
with (security_invoker = true)
as
select
  r.*,
  (select count(*) from reward_claims c where c.reward_id = r.id) as claim_count,
  p.pending_count,
  greatest(r.stock - p.pending_count, 0) as available_stock,
  (select count(*) from reward_claims c where c.reward_id = r.id and c.redeemed_at is not null) as redeemed_count
from public.rewards r
cross join lateral (
  select count(*)::int as pending_count
  from reward_claims c
  where c.reward_id = r.id and c.redeemed_at is null and c.cancelled_at is null and now() <= c.expires_at
) p;

-- Admin: simpan reward
-- Kode yang masih menunggu ditukar (mencadangkan stok)
create or replace function public.reward_pending_count(p_reward_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::int from reward_claims
  where reward_id = p_reward_id and redeemed_at is null and cancelled_at is null and now() <= expires_at;
$$;

create or replace function public.save_reward(
  p_id uuid,
  p_name text,
  p_product_id uuid,
  p_points_required integer,
  p_stock integer,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_pending integer;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur reward.' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Nama reward wajib diisi.'; end if;
  if p_product_id is null then raise exception 'Pilih produk reward.'; end if;
  if coalesce(p_points_required, 0) <= 0 then raise exception 'Poin diperlukan harus lebih dari 0.'; end if;
  if p_stock is null or p_stock < 0 then raise exception 'Stok penukaran wajib diisi (0 atau lebih).'; end if;

  if v_id is null then
    insert into rewards (name, product_id, points_required, stock, notes, created_by)
    values (trim(p_name), p_product_id, p_points_required, p_stock, nullif(trim(p_notes), ''), auth.uid())
    returning id into v_id;
  else
    v_pending := reward_pending_count(v_id);
    if p_stock < v_pending then
      raise exception 'Masih ada % kode yang menunggu ditukar, stok minimal %.', v_pending, v_pending;
    end if;
    update rewards set
      name = trim(p_name), product_id = p_product_id, points_required = p_points_required,
      stock = p_stock, notes = nullif(trim(p_notes), '')
    where id = v_id;
    if not found then raise exception 'Reward tidak ditemukan.'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.set_reward_active(p_id uuid, p_active boolean)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur reward.' using errcode = '42501';
  end if;
  -- Kode yang sudah diklaim tetap berlaku sampai ditukar / hangus
  update rewards set is_active = p_active where id = p_id;
  if not found then raise exception 'Reward tidak ditemukan.'; end if;
end;
$$;

create or replace function public.delete_reward(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menghapus reward.' using errcode = '42501';
  end if;
  if exists (select 1 from reward_claims where reward_id = p_id) then
    raise exception 'Reward ini sudah pernah diklaim, tidak bisa dihapus. Nonaktifkan saja.';
  end if;
  delete from rewards where id = p_id;
end;
$$;

-- Web Customer: member klaim reward → poin terpotong, dapat kode berlaku 24 jam
create or replace function public.claim_reward(p_reward_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer record;
  v_reward record;
  v_code text;
  v_claim uuid;
  v_expires timestamptz := now() + interval '1 day';
begin
  select * into v_customer from customers where id = current_customer_id() for update;
  if v_customer.id is null then raise exception 'Silakan login sebagai member.'; end if;
  if not v_customer.is_active then raise exception 'Akun member ini nonaktif.'; end if;

  -- Kunci baris reward supaya dua member tidak mengambil stok terakhir bersamaan
  select * into v_reward from rewards where id = p_reward_id for update;
  if v_reward.id is null or not v_reward.is_active then
    raise exception 'Reward tidak tersedia.';
  end if;
  if v_reward.stock - reward_pending_count(v_reward.id) <= 0 then
    raise exception 'Stok reward ini sudah habis.';
  end if;
  if v_customer.points_balance < v_reward.points_required then
    raise exception 'Poin tidak cukup. Butuh % poin, saldo %.', v_reward.points_required, v_customer.points_balance;
  end if;

  -- Kode 8 karakter tanpa huruf/angka yang mirip (0/O, 1/I)
  loop
    v_code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      from generate_series(1, 8)
    );
    exit when not exists (select 1 from reward_claims where reward_claims.code = v_code);
  end loop;

  insert into reward_claims (reward_id, customer_id, code, points_used, expires_at)
  values (v_reward.id, v_customer.id, v_code, v_reward.points_required, v_expires)
  returning id into v_claim;

  update customers set points_balance = points_balance - v_reward.points_required where id = v_customer.id;

  insert into point_transactions (customer_id, points_change, point_type, notes, balance_after, reward_claim_id)
  values (v_customer.id, -v_reward.points_required, 'redeem', 'Klaim reward: ' || v_reward.name,
          v_customer.points_balance - v_reward.points_required, v_claim);

  return query select v_code, v_expires;
end;
$$;

-- Aplikasi Kasir: tukar kode klaim
create or replace function public.redeem_reward_code(p_code text, p_transaction_id uuid default null)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_claim record;
begin
  if not is_employee() then
    raise exception 'Hanya karyawan yang boleh menukar kode reward.' using errcode = '42501';
  end if;

  select c.*, r.name as reward_name, r.product_id, cu.name as customer_name
    into v_claim
  from reward_claims c
  join rewards r on r.id = c.reward_id
  join customers cu on cu.id = c.customer_id
  where c.code = upper(trim(p_code))
  for update of c;

  if v_claim.id is null then raise exception 'Kode tidak ditemukan.'; end if;
  if v_claim.cancelled_at is not null then raise exception 'Kode ini sudah dibatalkan.'; end if;
  if v_claim.redeemed_at is not null then raise exception 'Kode ini sudah ditukar.'; end if;
  if now() > v_claim.expires_at then raise exception 'Kode ini sudah hangus (lewat 1 hari).'; end if;

  update reward_claims
  set redeemed_at = now(), redeemed_by = auth.uid(), transaction_id = p_transaction_id
  where id = v_claim.id;

  -- Stok fisik berkurang saat ditukar (cadangan klaim ini otomatis ikut lepas)
  update rewards set stock = greatest(stock - 1, 0) where id = v_claim.reward_id;

  return jsonb_build_object(
    'reward_name', v_claim.reward_name, 'product_id', v_claim.product_id, 'customer_name', v_claim.customer_name
  );
end;
$$;

-- Admin: batalkan klaim yang masih Menunggu Ditukar (member tidak jadi pesan) → poin dikembalikan
create or replace function public.cancel_reward_claim(p_claim_id uuid, p_reason text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_claim record;
  v_balance integer;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh membatalkan klaim.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Alasan pembatalan wajib diisi.';
  end if;

  select c.*, r.name as reward_name into v_claim
  from reward_claims c join rewards r on r.id = c.reward_id
  where c.id = p_claim_id
  for update of c;

  if v_claim.id is null then raise exception 'Klaim tidak ditemukan.'; end if;
  if v_claim.cancelled_at is not null then raise exception 'Klaim ini sudah dibatalkan.'; end if;
  if v_claim.redeemed_at is not null then raise exception 'Kode ini sudah ditukar di kasir, tidak bisa dibatalkan.'; end if;
  if now() > v_claim.expires_at then
    raise exception 'Kode ini sudah hangus (lewat 1 hari), poin tidak bisa dikembalikan.';
  end if;

  update reward_claims
  set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = trim(p_reason)
  where id = p_claim_id;

  update customers set points_balance = points_balance + v_claim.points_used
  where id = v_claim.customer_id
  returning points_balance into v_balance;

  insert into point_transactions (customer_id, points_change, point_type, notes, balance_after, created_by, reward_claim_id)
  values (v_claim.customer_id, v_claim.points_used, 'redeem_cancel',
          'Pembatalan klaim ' || v_claim.reward_name || ': ' || trim(p_reason), v_balance, auth.uid(), p_claim_id);

  return v_balance;
end;
$$;

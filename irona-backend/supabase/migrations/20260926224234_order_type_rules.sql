-- ============================================================
-- PENJUALAN > TIPE ORDER
--
-- 3 tipe tetap: Dine In (tanpa biaya tambahan), Take Away, Online.
-- Aturan bahan tambahan (cup, kresek, sedotan, dll):
--   - Scope: take_away / online / keduanya.
--   - Cakupan: semua produk atau produk tertentu. 1 produk boleh kena banyak aturan (valid, bukan konflik).
--   - Bahan tambahan: bahan baku × jumlah per order; biaya = harga per satuan bahan × jumlah,
--     atau "custom harga" (override manual).
-- Harga final (additive):
--   Take Away = Harga Dine In (harga jual produk) + Σ total biaya semua aturan take_away/keduanya yang kena produk itu.
--   Online    = Harga Dine In + Σ total biaya semua aturan online/keduanya yang kena produk itu.
-- Saat transaksi Take Away/Online (di Kasir/Web Customer): biaya ditambahkan ke tagihan dan stok bahan
-- tambahan dipotong — dieksekusi di aplikasi tersebut memakai fungsi di bawah.
-- ============================================================

create table public.order_type_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('take_away', 'online', 'keduanya')),
  applies_to_all_products boolean not null default false,
  created_by uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger order_type_rules_set_updated_at before update on public.order_type_rules
  for each row execute function public.set_updated_at();

create table public.order_type_rule_products (
  rule_id uuid not null references public.order_type_rules(id) on delete cascade,
  product_id uuid not null references public.products(id),
  primary key (rule_id, product_id)
);

create table public.order_type_rule_items (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.order_type_rules(id) on delete cascade,
  raw_material_id uuid not null references public.raw_materials(id),
  quantity numeric(12,3) not null check (quantity > 0),
  custom_cost numeric(14,2) check (custom_cost >= 0),   -- diisi kalau "Custom Harga"
  sort_order integer not null default 0
);

-- Riwayat Perubahan (rule_id tanpa FK supaya riwayat aturan yang dihapus tetap ada)
create table public.order_type_rule_history (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null,
  action text not null check (action in ('dibuat', 'diubah', 'dihapus')),
  before_data jsonb,
  after_data jsonb,
  changed_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);

create index order_type_rule_history_created_idx on public.order_type_rule_history (created_at desc);

alter table public.order_type_rules enable row level security;
alter table public.order_type_rule_products enable row level security;
alter table public.order_type_rule_items enable row level security;
alter table public.order_type_rule_history enable row level security;
create policy "order_type_rules_select" on public.order_type_rules for select to authenticated using (true);
create policy "order_type_rules_admin_write" on public.order_type_rules for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "order_type_rule_products_select" on public.order_type_rule_products for select to authenticated using (true);
create policy "order_type_rule_products_admin_write" on public.order_type_rule_products for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "order_type_rule_items_select" on public.order_type_rule_items for select to authenticated using (true);
create policy "order_type_rule_items_admin_write" on public.order_type_rule_items for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "order_type_rule_history_admin_all" on public.order_type_rule_history for all to authenticated
  using (is_admin()) with check (is_admin());


-- Biaya tiap bahan (live dari harga bahan baku terkini, kecuali custom)
create or replace view public.order_type_rule_item_costs
with (security_invoker = true)
as
select
  i.id,
  i.rule_id,
  i.raw_material_id,
  rm.name as raw_material_name,
  u.name as unit_name,
  i.quantity,
  i.custom_cost,
  rm.unit_price,
  coalesce(i.custom_cost, round(coalesce(rm.unit_price, 0) * i.quantity, 2)) as cost,
  i.sort_order
from public.order_type_rule_items i
join public.raw_materials rm on rm.id = i.raw_material_id
join public.units u on u.id = rm.base_unit_id;

create or replace view public.order_type_rule_overview
with (security_invoker = true)
as
select
  r.*,
  coalesce((select sum(c.cost) from order_type_rule_item_costs c where c.rule_id = r.id), 0) as total_cost
from public.order_type_rules r;


create or replace function public.order_type_rule_snapshot(p_rule_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'scope', r.scope,
    'applies_to_all_products', r.applies_to_all_products,
    'product_names', coalesce((select jsonb_agg(p.name order by p.name)
                               from order_type_rule_products rp join products p on p.id = rp.product_id
                               where rp.rule_id = r.id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                          'name', c.raw_material_name, 'quantity', c.quantity, 'unit', c.unit_name,
                          'custom_cost', c.custom_cost, 'cost', c.cost) order by c.sort_order)
                       from order_type_rule_item_costs c where c.rule_id = r.id), '[]'::jsonb),
    'total_cost', (select total_cost from order_type_rule_overview o where o.id = r.id)
  )
  from order_type_rules r where r.id = p_rule_id;
$$;

-- p_items: [{"raw_material_id":"…","quantity":1,"custom_cost":null}, ...]
create or replace function public.save_order_type_rule(
  p_id uuid,
  p_scope text,
  p_applies_to_all boolean,
  p_product_ids uuid[],
  p_items jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_before jsonb;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur tipe order.' using errcode = '42501';
  end if;
  if p_scope not in ('take_away', 'online', 'keduanya') then
    raise exception 'Pilih berlaku untuk Take Away, Online, atau Keduanya.';
  end if;
  if not coalesce(p_applies_to_all, false) and coalesce(array_length(p_product_ids, 1), 0) = 0 then
    raise exception 'Pilih produk yang kena aturan ini, atau centang Semua Produk.';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Tambahkan minimal 1 bahan tambahan.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) x
    where nullif(x ->> 'raw_material_id', '') is null
       or coalesce((x ->> 'quantity')::numeric, 0) <= 0
       or (nullif(x ->> 'custom_cost', '') is not null and (x ->> 'custom_cost')::numeric < 0)
  ) then
    raise exception 'Setiap bahan wajib dipilih dengan jumlah lebih dari 0.';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct x ->> 'raw_material_id') from jsonb_array_elements(p_items) x) then
    raise exception 'Bahan yang sama tidak boleh dimasukkan dua kali dalam satu aturan.';
  end if;

  if v_id is null then
    insert into order_type_rules (scope, applies_to_all_products, created_by)
    values (p_scope, coalesce(p_applies_to_all, false), auth.uid())
    returning id into v_id;
  else
    if not exists (select 1 from order_type_rules where id = v_id) then
      raise exception 'Aturan tidak ditemukan.';
    end if;
    v_before := order_type_rule_snapshot(v_id);
    update order_type_rules set scope = p_scope, applies_to_all_products = coalesce(p_applies_to_all, false)
    where id = v_id;
    delete from order_type_rule_products where rule_id = v_id;
    delete from order_type_rule_items where rule_id = v_id;
  end if;

  if not coalesce(p_applies_to_all, false) then
    insert into order_type_rule_products (rule_id, product_id)
    select distinct v_id, x from unnest(p_product_ids) x;
  end if;

  insert into order_type_rule_items (rule_id, raw_material_id, quantity, custom_cost, sort_order)
  select v_id, (x ->> 'raw_material_id')::uuid, (x ->> 'quantity')::numeric,
         nullif(x ->> 'custom_cost', '')::numeric, ord
  from jsonb_array_elements(p_items) with ordinality as t(x, ord);

  insert into order_type_rule_history (rule_id, action, before_data, after_data, changed_by)
  values (v_id, case when v_before is null then 'dibuat' else 'diubah' end, v_before,
          order_type_rule_snapshot(v_id), auth.uid());

  return v_id;
end;
$$;

create or replace function public.delete_order_type_rule(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur tipe order.' using errcode = '42501';
  end if;
  v_before := order_type_rule_snapshot(p_id);
  if v_before is null then raise exception 'Aturan tidak ditemukan.'; end if;

  delete from order_type_rules where id = p_id;

  insert into order_type_rule_history (rule_id, action, before_data, changed_by)
  values (p_id, 'dihapus', v_before, auth.uid());
end;
$$;


-- Aturan yang berlaku untuk 1 produk di 1 tipe order ('take_away' / 'online')
create or replace function public.applicable_order_type_rules(p_product_id uuid, p_order_type text)
returns table (rule_id uuid, scope text, applies_to_all_products boolean, total_cost numeric)
language sql
stable
set search_path = public
as $$
  select o.id, o.scope, o.applies_to_all_products, o.total_cost
  from order_type_rule_overview o
  where (o.scope = p_order_type or o.scope = 'keduanya')
    and p_order_type in ('take_away', 'online')
    and (o.applies_to_all_products
         or exists (select 1 from order_type_rule_products rp where rp.rule_id = o.id and rp.product_id = p_product_id))
  order by o.applies_to_all_products desc, o.created_at;
$$;

-- Rincian harga 1 produk per tipe order (dipakai popup "Cari Menu" & Kasir/Web Customer)
create or replace function public.product_order_type_prices(p_product_id uuid)
returns table (
  product_name text,
  dine_in_price numeric,
  take_away_extra numeric,
  take_away_price numeric,
  online_extra numeric,
  online_price numeric,
  take_away_rules jsonb,
  online_rules jsonb
)
language sql
stable
set search_path = public
as $$
  with p as (select name, coalesce(selling_price, 0) as price from products where id = p_product_id),
  ta as (select coalesce(sum(total_cost), 0) as extra,
                coalesce(jsonb_agg(jsonb_build_object('rule_id', rule_id, 'all', applies_to_all_products, 'total_cost', total_cost)), '[]') as rules
         from applicable_order_type_rules(p_product_id, 'take_away')),
  onl as (select coalesce(sum(total_cost), 0) as extra,
                 coalesce(jsonb_agg(jsonb_build_object('rule_id', rule_id, 'all', applies_to_all_products, 'total_cost', total_cost)), '[]') as rules
          from applicable_order_type_rules(p_product_id, 'online'))
  select p.name, p.price, ta.extra, p.price + ta.extra, onl.extra, p.price + onl.extra, ta.rules, onl.rules
  from p, ta, onl;
$$;

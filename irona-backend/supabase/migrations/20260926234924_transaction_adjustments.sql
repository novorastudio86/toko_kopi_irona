-- ============================================================
-- PENJUALAN > PENYESUAIAN TRANSAKSI
--
-- A. Refund Transaksi (selalu 1 transaksi utuh)
--    - Nominal refund = total transaksi. Status transaksi → refund_penuh.
--    - Status Produk:
--        Salah Order (Belum Dibuat) → stok yang terpotong saat transaksi dikembalikan
--        Sudah Dibuat              → stok tidak dikembalikan (bahan sudah terpakai)
--    - Kalau transaksi milik member: poin dari transaksi ditarik balik (tidak sampai minus);
--      Total Transaksi/Belanja otomatis turun (view ringkasan member mengabaikan refund penuh).
-- B. Try & Error Produk
--    - Dari Resep Existing (Produk / Racikan): stok bahan terpotong sesuai resep × porsi,
--      Total Cost = total cost per porsi resep × porsi.
--    - Racikan Baru (Brainstorm): bahan baku bebas + takaran; Add Cost terkunci 10%.
--    - Tidak pernah menambah stok hasil apa pun.
-- Semua catatan final (append-only): tidak bisa diubah/dihapus.
-- Efek ke Keuangan (pendapatan kotor / Fixed Cost) menyusul di modul Keuangan.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Pergerakan stok: jenis baru + tautan ke sumbernya
-- ------------------------------------------------------------
alter table public.stock_movements
  drop constraint stock_movements_movement_type_check,
  add constraint stock_movements_movement_type_check
    check (movement_type in ('stok_masuk', 'penyesuaian', 'produksi_racikan', 'penjualan', 'refund', 'try_error')),
  add column transaction_id uuid references public.transactions(id);

create index stock_movements_transaction_idx on public.stock_movements (transaction_id) where transaction_id is not null;


-- ------------------------------------------------------------
-- 2. Penguraian resep → pemakaian stok
--    Bahan baku langsung; racikan Batch → stok racikan; racikan Made to Order → diurai ke bahan penyusunnya.
-- ------------------------------------------------------------

-- Uraikan komponen 1 racikan untuk p_units satuan hasil (dipakai membuat racikan itu dari awal)
create or replace function public.expand_racikan_components(p_racikan_id uuid, p_units numeric, p_depth integer default 0)
returns table (item_type text, raw_material_id uuid, racikan_id uuid, quantity numeric, unit_id uuid)
language plpgsql
stable
set search_path = public
as $$
declare
  v_output numeric;
  comp record;
  v_sub record;
begin
  if p_depth > 10 then
    raise exception 'Resep racikan terlalu dalam atau melingkar.';
  end if;
  select total_output_qty into v_output from racikan where id = p_racikan_id;
  if coalesce(v_output, 0) = 0 then return; end if;

  for comp in select * from racikan_components rc where rc.racikan_id = p_racikan_id loop
    if comp.component_type = 'bahan_baku' then
      return query select 'bahan_baku'::text, comp.raw_material_id, null::uuid,
                          comp.quantity * p_units / v_output, comp.unit_id;
    else
      select production_mode, unit_id as u into v_sub from racikan where id = comp.component_racikan_id;
      if v_sub.production_mode = 'batch' then
        return query select 'racikan'::text, null::uuid, comp.component_racikan_id,
                            comp.quantity * p_units / v_output, v_sub.u;
      else
        return query select * from expand_racikan_components(comp.component_racikan_id,
                                                              comp.quantity * p_units / v_output, p_depth + 1);
      end if;
    end if;
  end loop;
end;
$$;

-- Pemakaian stok untuk p_qty porsi 1 produk (dipakai Kasir saat penjualan & Try & Error)
create or replace function public.expand_product_usage(p_product_id uuid, p_qty numeric)
returns table (item_type text, raw_material_id uuid, racikan_id uuid, quantity numeric, unit_id uuid)
language plpgsql
stable
set search_path = public
as $$
declare
  comp record;
  v_mode text;
begin
  for comp in select * from product_recipe_components prc where prc.product_id = p_product_id loop
    if comp.component_type = 'bahan_baku' then
      return query select 'bahan_baku'::text, comp.raw_material_id, null::uuid, comp.quantity * p_qty, comp.unit_id;
    else
      select production_mode into v_mode from racikan where id = comp.racikan_id;
      if v_mode = 'batch' then
        return query select 'racikan'::text, null::uuid, comp.racikan_id, comp.quantity * p_qty, comp.unit_id;
      else
        return query select * from expand_racikan_components(comp.racikan_id, comp.quantity * p_qty);
      end if;
    end if;
  end loop;
end;
$$;


-- ------------------------------------------------------------
-- 3. Refund
-- ------------------------------------------------------------
alter table public.refunds
  add column product_status text check (product_status in ('belum_dibuat', 'sudah_dibuat'));

comment on column public.refunds.product_status is
  'belum_dibuat = salah order, stok dikembalikan; sudah_dibuat = stok tidak dikembalikan';

create or replace function public.create_refund(
  p_transaction_id uuid,
  p_product_status text,
  p_reason text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_tx record;
  v_refund uuid;
  v_earned integer;
  v_reversed integer;
  v_take integer;
  v_balance integer;
  mv record;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mencatat refund.' using errcode = '42501';
  end if;
  if p_product_status not in ('belum_dibuat', 'sudah_dibuat') then
    raise exception 'Pilih status produk: Salah Order (Belum Dibuat) atau Sudah Dibuat.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Alasan refund wajib diisi.';
  end if;

  select * into v_tx from transactions where id = p_transaction_id for update;
  if v_tx.id is null then raise exception 'Transaksi tidak ditemukan.'; end if;
  if v_tx.status <> 'selesai' then
    raise exception 'Transaksi % tidak bisa direfund (status: %).', v_tx.transaction_number, v_tx.status;
  end if;

  update transactions set status = 'refund_penuh' where id = v_tx.id;

  insert into refunds (transaction_id, refund_amount, reason, refunded_by, product_status)
  values (v_tx.id, v_tx.total_amount, trim(p_reason), auth.uid(), p_product_status)
  returning id into v_refund;

  -- Salah order: kembalikan stok yang terpotong saat penjualan
  if p_product_status = 'belum_dibuat' then
    for mv in
      select item_type, raw_material_id, racikan_id, unit_id, sum(quantity) as qty
      from stock_movements
      where transaction_id = v_tx.id and movement_type in ('penjualan', 'refund')
      group by item_type, raw_material_id, racikan_id, unit_id
      having sum(quantity) <> 0
    loop
      insert into stock_movements (movement_type, item_type, raw_material_id, racikan_id, quantity, unit_id,
                                   notes, transaction_id, created_by)
      values ('refund', mv.item_type, mv.raw_material_id, mv.racikan_id, -mv.qty, mv.unit_id,
              'Refund ' || v_tx.transaction_number || ' (salah order)', v_tx.id, auth.uid());
    end loop;
  end if;

  -- Member: tarik balik poin dari transaksi ini (tidak sampai minus)
  if v_tx.customer_id is not null then
    select coalesce(sum(points_change) filter (where point_type = 'earn'), 0),
           coalesce(-sum(points_change) filter (where point_type = 'refund_reversal'), 0)
      into v_earned, v_reversed
    from point_transactions where transaction_id = v_tx.id;

    select points_balance into v_balance from customers where id = v_tx.customer_id for update;
    v_take := least(greatest(v_earned - v_reversed, 0), v_balance);

    if v_take > 0 then
      update customers set points_balance = points_balance - v_take where id = v_tx.customer_id;
      insert into point_transactions (customer_id, transaction_id, points_change, point_type, notes, balance_after, created_by)
      values (v_tx.customer_id, v_tx.id, -v_take, 'refund_reversal',
              'Penyesuaian akibat refund ' || v_tx.transaction_number, v_balance - v_take, auth.uid());
    end if;
  end if;

  return v_refund;
end;
$$;


-- ------------------------------------------------------------
-- 4. Try & Error
-- ------------------------------------------------------------
create table public.try_error_records (
  id uuid primary key default gen_random_uuid(),
  tne_type text not null check (tne_type in ('resep_produk', 'resep_racikan', 'racikan_baru')),
  product_id uuid references public.products(id),
  racikan_id uuid references public.racikan(id),
  quantity numeric(12,3) not null check (quantity > 0),     -- porsi dibuat (resep); 1 untuk racikan baru
  cost numeric(14,2) not null,                              -- sebelum add cost
  add_cost_percentage numeric(5,2) not null,
  total_cost numeric(14,2) not null,
  notes text,
  created_by uuid references public.employees(id),
  created_at timestamptz not null default now(),
  constraint try_error_source_check check (
    (tne_type = 'resep_produk' and product_id is not null and racikan_id is null)
    or (tne_type = 'resep_racikan' and racikan_id is not null and product_id is null)
    or (tne_type = 'racikan_baru' and product_id is null and racikan_id is null)
  )
);

create table public.try_error_items (
  id uuid primary key default gen_random_uuid(),
  try_error_id uuid not null references public.try_error_records(id) on delete cascade,
  item_type text not null check (item_type in ('bahan_baku', 'racikan')),
  raw_material_id uuid references public.raw_materials(id),
  racikan_id uuid references public.racikan(id),
  quantity numeric(14,3) not null,
  unit_id uuid references public.units(id),
  unit_price numeric(14,4) not null default 0,
  subtotal numeric(14,2) not null default 0
);

alter table public.stock_movements
  add column try_error_id uuid references public.try_error_records(id);

alter table public.try_error_records enable row level security;
alter table public.try_error_items enable row level security;
create policy "try_error_records_admin_all" on public.try_error_records for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "try_error_items_admin_all" on public.try_error_items for all to authenticated
  using (is_admin()) with check (is_admin());

-- Rincian pemakaian bahan + biaya untuk 1 catatan Try & Error (dipakai pratinjau form & saat simpan)
-- p_type: resep_produk | resep_racikan | racikan_baru
-- p_items (khusus racikan_baru): [{"raw_material_id":"…","quantity":50}, ...]
create or replace function public.try_error_usage(
  p_type text,
  p_product_id uuid,
  p_racikan_id uuid,
  p_quantity numeric,
  p_items jsonb
)
returns table (item_type text, raw_material_id uuid, racikan_id uuid, item_name text, unit_id uuid,
               unit_name text, quantity numeric, current_stock numeric, unit_price numeric, subtotal numeric)
language sql
stable
set search_path = public
as $$
  with usage as (
    select * from expand_product_usage(p_product_id, p_quantity)
    where p_type = 'resep_produk'
    union all
    select u.* from racikan r,
      lateral expand_racikan_components(r.id, p_quantity * r.total_output_qty / nullif(r.yield_qty, 0)) u
    where p_type = 'resep_racikan' and r.id = p_racikan_id
    union all
    select 'bahan_baku', rm.id, null::uuid, (x ->> 'quantity')::numeric, rm.base_unit_id
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
    join raw_materials rm on rm.id = nullif(x ->> 'raw_material_id', '')::uuid
    where p_type = 'racikan_baru' and coalesce((x ->> 'quantity')::numeric, 0) > 0
  ),
  grouped as (
    select g.item_type, g.raw_material_id, g.racikan_id, g.unit_id, sum(g.quantity) as quantity
    from usage g group by 1, 2, 3, 4
  )
  select g.item_type, g.raw_material_id, g.racikan_id,
         coalesce(rm.name, rk.name), g.unit_id, un.name, g.quantity,
         coalesce(rm.current_stock, rk.current_stock, 0),
         case when g.item_type = 'bahan_baku' then coalesce(rm.unit_price, 0) else racikan_unit_cost(g.racikan_id) end,
         round(g.quantity * case when g.item_type = 'bahan_baku' then coalesce(rm.unit_price, 0)
                                 else racikan_unit_cost(g.racikan_id) end, 2)
  from grouped g
  left join raw_materials rm on rm.id = g.raw_material_id
  left join racikan rk on rk.id = g.racikan_id
  left join units un on un.id = g.unit_id
  order by 4;
$$;

-- Pilihan resep di form (cost per porsi = angka di Master Resep)
create or replace view public.try_error_recipe_options
with (security_invoker = true)
as
select 'resep_produk'::text as tne_type, p.id, p.name, pc.name as group_name,
       pwc.live_total_cost as cost_per_porsi, coalesce(p.add_cost_percentage, 0) as add_cost_percentage
from public.products p
join public.products_with_cost pwc on pwc.id = p.id
left join public.categories pc on pc.id = p.category_id
where p.recipe_status = 'lengkap'
union all
select 'resep_racikan', r.id, r.name, case r.production_mode when 'batch' then 'Racikan Batch' else 'Racikan Made to Order' end,
       round(public.racikan_unit_cost(r.id) * r.total_output_qty / nullif(r.yield_qty, 0), 2),
       coalesce(r.add_cost_percentage, 0)
from public.racikan r
where r.is_active and coalesce(r.yield_qty, 0) > 0
  and exists (select 1 from public.racikan_components rc where rc.racikan_id = r.id);

create or replace function public.create_try_error(
  p_type text,
  p_product_id uuid,
  p_racikan_id uuid,
  p_quantity numeric,
  p_items jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_qty numeric := coalesce(p_quantity, 0);
  v_add numeric;
  v_cost numeric;
  v_total numeric;
  v_racikan record;
  u record;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mencatat try & error.' using errcode = '42501';
  end if;

  if p_type = 'resep_produk' then
    if v_qty <= 0 then raise exception 'Jumlah porsi harus lebih dari 0.'; end if;
    select coalesce(add_cost_percentage, 0) into v_add from products
    where id = p_product_id and recipe_status = 'lengkap';
    if v_add is null then raise exception 'Pilih produk yang sudah punya resep lengkap.'; end if;
    v_cost := product_recipe_cost(p_product_id) * v_qty;
    v_total := round(v_cost * (1 + v_add / 100), 2);

  elsif p_type = 'resep_racikan' then
    if v_qty <= 0 then raise exception 'Jumlah porsi harus lebih dari 0.'; end if;
    select * into v_racikan from racikan where id = p_racikan_id;
    if v_racikan.id is null then raise exception 'Racikan tidak ditemukan.'; end if;
    if coalesce(v_racikan.yield_qty, 0) = 0 then raise exception 'Yield racikan belum diatur.'; end if;
    v_add := coalesce(v_racikan.add_cost_percentage, 0);
    -- racikan_unit_cost sudah termasuk add cost racikan
    v_total := round(racikan_unit_cost(p_racikan_id) * v_qty * v_racikan.total_output_qty / v_racikan.yield_qty, 2);
    v_cost := v_total / (1 + v_add / 100);

  elsif p_type = 'racikan_baru' then
    v_qty := 1;
    v_add := 10;   -- terkunci 10% (PRD)
    if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
      raise exception 'Tambahkan minimal 1 bahan.';
    end if;
    if exists (select 1 from jsonb_array_elements(p_items) x
               where nullif(x ->> 'raw_material_id', '') is null or coalesce((x ->> 'quantity')::numeric, 0) <= 0) then
      raise exception 'Setiap bahan wajib dipilih dengan takaran lebih dari 0.';
    end if;
    select coalesce(sum(t.subtotal), 0) into v_cost
    from try_error_usage(p_type, null, null, 1, p_items) t;
    v_total := round(v_cost * (1 + v_add / 100), 2);
  else
    raise exception 'Tipe try & error tidak valid.';
  end if;

  if not exists (select 1 from try_error_usage(p_type, p_product_id, p_racikan_id, v_qty, p_items)) then
    raise exception 'Resep ini tidak punya bahan, tidak ada yang bisa dicatat.';
  end if;

  -- Stok harus cukup
  for u in select * from try_error_usage(p_type, p_product_id, p_racikan_id, v_qty, p_items) loop
    if u.current_stock < u.quantity then
      raise exception 'Stok % tidak cukup (butuh %, tersedia %).',
        u.item_name, round(u.quantity, 3), round(u.current_stock, 3);
    end if;
  end loop;

  insert into try_error_records (tne_type, product_id, racikan_id, quantity, cost, add_cost_percentage, total_cost, notes, created_by)
  values (p_type,
          case when p_type = 'resep_produk' then p_product_id end,
          case when p_type = 'resep_racikan' then p_racikan_id end,
          v_qty, round(v_cost, 2), v_add, v_total, nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;

  insert into try_error_items (try_error_id, item_type, raw_material_id, racikan_id, quantity, unit_id, unit_price, subtotal)
  select v_id, t.item_type, t.raw_material_id, t.racikan_id, t.quantity, t.unit_id, t.unit_price, t.subtotal
  from try_error_usage(p_type, p_product_id, p_racikan_id, v_qty, p_items) t;

  -- Hanya memotong stok bahan; tidak ada stok hasil yang bertambah
  insert into stock_movements (movement_type, item_type, raw_material_id, racikan_id, quantity, unit_id, notes, try_error_id, created_by)
  select 'try_error', t.item_type, t.raw_material_id, t.racikan_id, -t.quantity, t.unit_id, 'Try & Error', v_id, auth.uid()
  from try_error_usage(p_type, p_product_id, p_racikan_id, v_qty, p_items) t;

  return v_id;
end;
$$;


-- ------------------------------------------------------------
-- 5. Daftar gabungan (layar Penyesuaian Transaksi)
-- ------------------------------------------------------------
create or replace view public.transaction_adjustment_overview
with (security_invoker = true)
as
select
  r.id,
  'refund'::text as adjustment_type,
  r.refunded_at as created_at,
  t.transaction_number as reference,
  case when t.order_type = 'online' then 'online' else 'offline' end as channel,
  r.product_status,
  r.reason as notes,
  r.refund_amount as amount,
  t.id as transaction_id,
  null::text as tne_type,
  t.customer_id,
  t.customer_name,
  e.full_name as recorded_by_name
from public.refunds r
left join public.employees e on e.id = r.refunded_by
join public.transactions t on t.id = r.transaction_id
where r.product_status is not null      -- refund versi baru (1 transaksi utuh)

union all

select
  te.id,
  'try_error',
  te.created_at,
  case te.tne_type
    when 'resep_produk' then (select name from products where id = te.product_id)
    when 'resep_racikan' then (select name from racikan where id = te.racikan_id)
    else 'Racikan Baru (Brainstorm)'
  end,
  null,
  null,
  te.notes,
  te.total_cost,
  null,
  te.tne_type,
  null,
  null,
  e.full_name
from public.try_error_records te
left join public.employees e on e.id = te.created_by;


-- ------------------------------------------------------------
-- 6. Kelola Stok: isi kolom Terjual (penjualan − refund), Try & Error masuk Penyesuaian
-- ------------------------------------------------------------
create or replace function public.stock_card(p_start date, p_end date)
returns table (item_type text, item_id uuid, item_name text, unit_name text, opening numeric, incoming numeric,
               sold numeric, adjustment numeric, production numeric, closing numeric, min_stock numeric)
language sql
stable
as $$
  with items as (
    select 'bahan_baku'::text as item_type, rm.id, rm.name, u.name as unit_name,
           rm.current_stock, rm.min_stock_alert
    from public.raw_materials rm
    left join public.units u on u.id = rm.base_unit_id
    where rm.is_active

    union all

    select 'racikan', r.id, r.name, u.name, r.current_stock, coalesce(r.min_stock_alert, 0)
    from public.racikan r
    left join public.units u on u.id = r.unit_id
    where r.is_active and r.production_mode = 'batch'
  ),
  mv as (
    select
      coalesce(sm.raw_material_id, sm.racikan_id) as item_id,
      sum(case when sm.movement_date between p_start and p_end
               and sm.movement_type = 'stok_masuk' then sm.quantity else 0 end) as incoming,
      -sum(case when sm.movement_date between p_start and p_end
               and sm.movement_type in ('penjualan', 'refund') then sm.quantity else 0 end) as sold,
      sum(case when sm.movement_date between p_start and p_end
               and sm.movement_type in ('penyesuaian', 'try_error') then sm.quantity else 0 end) as adjustment,
      sum(case when sm.movement_date between p_start and p_end
               and sm.movement_type = 'produksi_racikan' then sm.quantity else 0 end) as production,
      sum(case when sm.movement_date between p_start and p_end then sm.quantity else 0 end) as in_period,
      sum(case when sm.movement_date > p_end then sm.quantity else 0 end) as after_period
    from public.stock_movements sm
    group by 1
  )
  select
    i.item_type,
    i.id,
    i.name,
    coalesce(i.unit_name, '-'),
    i.current_stock - coalesce(mv.in_period, 0) - coalesce(mv.after_period, 0),
    coalesce(mv.incoming, 0),
    coalesce(mv.sold, 0),
    coalesce(mv.adjustment, 0),
    coalesce(mv.production, 0),
    i.current_stock - coalesce(mv.after_period, 0),
    i.min_stock_alert
  from items i
  left join mv on mv.item_id = i.id
  order by i.name;
$$;

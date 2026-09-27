-- ============================================================
-- MASTER RESEP — perhitungan biaya, peringatan stok, dan simpan racikan
-- ============================================================

-- Cost satu batch racikan (sebelum Add Cost), selalu dari harga bahan terkini
create or replace function public.racikan_batch_cost(p_racikan_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(
    case
      when rc.component_type = 'bahan_baku' then rc.quantity * coalesce(rm.unit_price, 0)
      else rc.quantity * public.racikan_unit_cost(rc.component_racikan_id)
    end
  ), 0)
  from public.racikan_components rc
  left join public.raw_materials rm on rm.id = rc.raw_material_id
  where rc.racikan_id = p_racikan_id;
$$;

-- Tabel ringkas Master Resep: Produk (Isi Sekarang/Isi Nanti) + semua Racikan.
-- Produk "Tanpa Resep" sengaja tidak masuk (dikelola di Daftar Produk).
create or replace view public.recipe_list
with (security_invoker = true)
as
select
  p.id,
  'produk'::text                                    as recipe_type,
  p.name,
  c.name                                            as category_name,
  (select count(*) from public.product_recipe_components prc where prc.product_id = p.id) as component_count,
  round(public.product_recipe_cost(p.id), 2)        as cost,
  p.add_cost_percentage,
  round(public.product_recipe_cost(p.id) * (1 + coalesce(p.add_cost_percentage, 0) / 100), 2) as total_cost,
  p.recipe_status,
  p.is_active,
  p.unit,
  p.desired_cost_percentage,
  p.selling_price,
  null::text    as production_mode,
  null::numeric as yield_qty,
  null::numeric as total_output_qty,
  null::numeric as current_stock,
  null::numeric as min_stock_alert
from public.products p
join public.categories c on c.id = p.category_id
where p.recipe_status in ('lengkap', 'belum_lengkap')

union all

select
  r.id,
  'racikan',
  r.name,
  null,
  (select count(*) from public.racikan_components rc where rc.racikan_id = r.id),
  round(public.racikan_batch_cost(r.id), 2),
  r.add_cost_percentage,
  round(public.racikan_batch_cost(r.id) * (1 + coalesce(r.add_cost_percentage, 0) / 100), 2),
  case when exists (select 1 from public.racikan_components rc where rc.racikan_id = r.id)
       then 'lengkap' else 'belum_lengkap' end,
  r.is_active,
  u.name,
  null, null,
  r.production_mode,
  r.yield_qty,
  r.total_output_qty,
  r.current_stock,
  r.min_stock_alert
from public.racikan r
left join public.units u on u.id = r.unit_id;

-- Bahan menipis untuk setiap RACIKAN — ditelusuri mulai 1 level di bawah racikan
-- (status stok racikan itu sendiri tidak dihitung di sini)
create or replace view public.racikan_low_stock
with (security_invoker = true)
as
with recursive expanded as (
  select
    rc.racikan_id as root_id,
    rc.component_type,
    rc.raw_material_id,
    rc.component_racikan_id,
    rc.quantity::numeric as qty,
    0 as depth
  from public.racikan_components rc

  union all

  -- Racikan Made to Order dipecah ke komponennya, takaran proporsional
  select
    e.root_id,
    rc.component_type,
    rc.raw_material_id,
    rc.component_racikan_id,
    e.qty * rc.quantity / nullif(r.total_output_qty, 0),
    e.depth + 1
  from expanded e
  join public.racikan r on r.id = e.component_racikan_id and r.production_mode = 'made_to_order'
  join public.racikan_components rc on rc.racikan_id = r.id
  where e.component_type = 'racikan' and e.depth < 10
),
items as (
  select
    e.root_id,
    'bahan_baku'::text as item_type,
    rm.id   as item_id,
    rm.name as item_name,
    u.name  as unit_name,
    rm.current_stock,
    rm.min_stock_alert,
    e.qty
  from expanded e
  join public.raw_materials rm on rm.id = e.raw_material_id
  left join public.units u on u.id = rm.base_unit_id
  where e.component_type = 'bahan_baku'
    and rm.is_active
    and rm.min_stock_alert > 0
    and rm.current_stock <= rm.min_stock_alert

  union all

  select
    e.root_id,
    'racikan',
    r.id,
    r.name,
    u.name,
    r.current_stock,
    r.min_stock_alert,
    e.qty
  from expanded e
  join public.racikan r on r.id = e.component_racikan_id
  left join public.units u on u.id = r.unit_id
  where e.component_type = 'racikan'
    and r.production_mode = 'batch'
    and r.is_active
    and coalesce(r.min_stock_alert, 0) > 0
    and r.current_stock <= r.min_stock_alert
)
select
  root_id as racikan_id,
  item_type,
  item_id,
  item_name,
  unit_name,
  current_stock,
  min_stock_alert,
  sum(qty) as qty_per_batch
from items
group by root_id, item_type, item_id, item_name, unit_name, current_stock, min_stock_alert;

-- Apakah p_target dipakai (langsung/tidak langsung) di dalam resep p_source?
-- Dipakai untuk mencegah racikan mereferensikan dirinya sendiri secara melingkar.
create or replace function public.racikan_references(p_source uuid, p_target uuid)
returns boolean
language sql
stable
as $$
  with recursive walk as (
    select rc.component_racikan_id as id, 0 as depth
    from public.racikan_components rc
    where rc.racikan_id = p_source and rc.component_type = 'racikan'

    union all

    select rc.component_racikan_id, w.depth + 1
    from walk w
    join public.racikan_components rc on rc.racikan_id = w.id and rc.component_type = 'racikan'
    where w.depth < 10
  )
  select exists (select 1 from walk where id = p_target);
$$;

-- Simpan racikan + komponennya dalam satu transaksi.
-- p_racikan_id null = racikan baru. Semua angka biaya dihitung ulang di sini.
create or replace function public.save_racikan(
  p_racikan_id uuid,
  p_data jsonb,
  p_components jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
  v_mode text := p_data->>'production_mode';
  v_yield numeric := (p_data->>'yield_qty')::numeric;
  v_output numeric := (p_data->>'total_output_qty')::numeric;
  v_add numeric := coalesce((p_data->>'add_cost_percentage')::numeric, 0);
  v_cost numeric;
  v_total numeric;
begin
  if not public.is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menyimpan racikan.' using errcode = '42501';
  end if;

  if coalesce(v_yield, 0) <= 0 then
    raise exception 'Yield (jumlah porsi per batch) harus lebih dari 0.';
  end if;
  if coalesce(v_output, 0) <= 0 then
    raise exception 'Total hasil produksi harus lebih dari 0.';
  end if;

  if p_racikan_id is null then
    insert into public.racikan (
      name, unit_id, production_mode, yield_qty, total_output_qty,
      add_cost_percentage, min_stock_alert, is_active
    ) values (
      p_data->>'name',
      (p_data->>'unit_id')::uuid,
      v_mode,
      v_yield,
      v_output,
      v_add,
      case when v_mode = 'batch' then (p_data->>'min_stock_alert')::numeric end,
      coalesce((p_data->>'is_active')::boolean, true)
    )
    returning id into v_id;
  else
    update public.racikan set
      name = p_data->>'name',
      unit_id = (p_data->>'unit_id')::uuid,
      production_mode = v_mode,
      yield_qty = v_yield,
      total_output_qty = v_output,
      add_cost_percentage = v_add,
      min_stock_alert = case when v_mode = 'batch' then (p_data->>'min_stock_alert')::numeric end,
      is_active = coalesce((p_data->>'is_active')::boolean, is_active)
    where id = p_racikan_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Racikan tidak ditemukan.';
    end if;
  end if;

  -- Komponen diganti utuh
  delete from public.racikan_components where racikan_id = v_id;

  if jsonb_array_length(coalesce(p_components, '[]'::jsonb)) > 0 then
    insert into public.racikan_components
      (racikan_id, component_type, raw_material_id, component_racikan_id, quantity, unit_id)
    select
      v_id,
      c->>'component_type',
      nullif(c->>'raw_material_id', '')::uuid,
      nullif(c->>'racikan_id', '')::uuid,
      (c->>'quantity')::numeric,
      (c->>'unit_id')::uuid
    from jsonb_array_elements(p_components) as c;
  end if;

  -- Cegah referensi melingkar (A pakai B, B pakai A)
  if public.racikan_references(v_id, v_id) then
    raise exception 'Racikan tidak boleh memakai dirinya sendiri, baik langsung maupun lewat racikan lain.';
  end if;

  -- Hitung ulang & simpan angka biaya
  v_cost := public.racikan_batch_cost(v_id);
  v_total := v_cost * (1 + v_add / 100);

  update public.racikan set
    cost_per_batch = round(v_cost, 2),
    total_cost_per_batch = round(v_total, 2),
    cost_per_porsi = round(v_total / v_yield, 2),
    price_per_unit = round(v_total / v_output, 4)
  where id = v_id;

  return v_id;
end;
$$;
-- Produk & racikan yang memakai sebuah bahan baku, termasuk lewat racikan (berantai).
-- qty untuk produk = takaran bahan per 1 porsi produk.
create or replace view public.raw_material_usage
with (security_invoker = true)
as
with recursive racikan_material as (
  -- Bahan langsung di dalam racikan → takaran per 1 satuan hasil racikan
  select
    rc.racikan_id,
    rc.raw_material_id,
    rc.quantity / nullif(r.total_output_qty, 0) as qty_per_unit,
    0 as depth
  from public.racikan_components rc
  join public.racikan r on r.id = rc.racikan_id
  where rc.component_type = 'bahan_baku'

  union all

  -- Racikan di dalam racikan
  select
    rc.racikan_id,
    child.raw_material_id,
    (rc.quantity / nullif(r.total_output_qty, 0)) * child.qty_per_unit,
    child.depth + 1
  from public.racikan_components rc
  join public.racikan r on r.id = rc.racikan_id
  join racikan_material child on child.racikan_id = rc.component_racikan_id
  where rc.component_type = 'racikan' and child.depth < 10
)
-- Produk yang memakai bahan secara langsung
select
  prc.raw_material_id,
  'produk'::text as usage_type,
  p.id           as item_id,
  p.name         as item_name,
  c.name         as category_name,
  null::text     as via_name,
  prc.quantity::numeric as quantity,
  u.name         as unit_name
from public.product_recipe_components prc
join public.products p on p.id = prc.product_id
join public.categories c on c.id = p.category_id
join public.raw_materials rm on rm.id = prc.raw_material_id
left join public.units u on u.id = rm.base_unit_id
where prc.component_type = 'bahan_baku'

union all

-- Produk yang memakai bahan lewat racikan
select
  child.raw_material_id,
  'produk',
  p.id,
  p.name,
  c.name,
  r.name,
  prc.quantity * child.qty_per_unit,
  u.name
from public.product_recipe_components prc
join public.racikan r on r.id = prc.racikan_id
join racikan_material child on child.racikan_id = r.id
join public.products p on p.id = prc.product_id
join public.categories c on c.id = p.category_id
join public.raw_materials rm on rm.id = child.raw_material_id
left join public.units u on u.id = rm.base_unit_id
where prc.component_type = 'racikan'

union all

-- Racikan yang memakai bahan secara langsung
select
  rc.raw_material_id,
  'racikan',
  r.id,
  r.name,
  null,
  null,
  rc.quantity::numeric,
  u.name
from public.racikan_components rc
join public.racikan r on r.id = rc.racikan_id
join public.raw_materials rm on rm.id = rc.raw_material_id
left join public.units u on u.id = rm.base_unit_id
where rc.component_type = 'bahan_baku';
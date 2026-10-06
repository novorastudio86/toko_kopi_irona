-- Master Resep: tampilkan SKU produk (sama seperti Daftar Produk), bukan potongan UUID.
-- Racikan belum punya kode, jadi kolomnya null. Kolom baru ditaruh paling akhir agar create or replace view tetap valid.
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
  null::numeric as min_stock_alert,
  p.sku         as code
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
  r.min_stock_alert,
  null::text
from public.racikan r
left join public.units u on u.id = r.unit_id;

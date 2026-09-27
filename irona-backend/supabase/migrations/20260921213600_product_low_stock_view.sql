-- Bahan baku / racikan yang menipis untuk setiap produk.
-- Aturan penelusuran:
--   - Bahan baku           → cek stoknya sendiri
--   - Racikan Batch        → cek stok hasil produksinya sendiri (tidak ditelusuri ke bahannya)
--   - Racikan Made to Order → tidak punya stok, ditelusuri ke bahan penyusunnya
-- "Menipis" = stok <= alert stok minimum, dan alert minimum sudah diisi (> 0)
create or replace view public.product_low_stock
with (security_invoker = true)
as
with recursive expanded as (
  -- Komponen langsung dari resep produk
  select
    prc.product_id,
    prc.component_type,
    prc.raw_material_id,
    prc.racikan_id,
    prc.quantity::numeric as qty,
    0 as depth
  from public.product_recipe_components prc

  union all

  -- Racikan Made to Order dipecah ke komponennya, takaran dihitung proporsional
  select
    e.product_id,
    rc.component_type,
    rc.raw_material_id,
    rc.component_racikan_id,
    e.qty * rc.quantity / nullif(r.total_output_qty, 0),
    e.depth + 1
  from expanded e
  join public.racikan r on r.id = e.racikan_id and r.production_mode = 'made_to_order'
  join public.racikan_components rc on rc.racikan_id = r.id
  where e.component_type = 'racikan' and e.depth < 10
),
items as (
  select
    e.product_id,
    'bahan_baku'::text as item_type,
    rm.id as item_id,
    rm.name as item_name,
    u.name as unit_name,
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
    e.product_id,
    'racikan'::text,
    r.id,
    r.name,
    u.name,
    r.current_stock,
    r.min_stock_alert,
    e.qty
  from expanded e
  join public.racikan r on r.id = e.racikan_id
  left join public.units u on u.id = r.unit_id
  where e.component_type = 'racikan'
    and r.production_mode = 'batch'
    and r.is_active
    and coalesce(r.min_stock_alert, 0) > 0
    and r.current_stock <= r.min_stock_alert
)
select
  product_id,
  item_type,
  item_id,
  item_name,
  unit_name,
  current_stock,
  min_stock_alert,
  sum(qty) as qty_per_portion
from items
group by product_id, item_type, item_id, item_name, unit_name, current_stock, min_stock_alert;
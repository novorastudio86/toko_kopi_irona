-- Produk tanpa resep sekarang juga punya Add Cost (penyusutan), sama seperti produk resep:
-- base_cost = Cost manual, Total Cost = base_cost × (1 + add_cost_percentage).
-- Produk tanpa resep yang sudah ada tersimpan dengan add_cost_percentage 0, jadi Total Cost-nya tidak berubah.
-- Kolom ditulis eksplisit (bukan p.*) agar urutannya sama dengan view lama; view ini dipakai view lain
-- sehingga tidak bisa di-drop, dan p.* sekarang ikut membawa kolom baru (deactivation_reason).
create or replace view public.products_with_cost
with (security_invoker = true)
as
select
  p.id, p.name, p.description, p.photo_url, p.category_id, p.unit, p.sku,
  p.available_offline, p.available_online, p.recipe_status, p.base_cost, p.selling_price,
  p.is_active, p.deactivated_manually, p.created_at, p.updated_at,
  p.cost, p.add_cost_percentage, p.desired_cost_percentage, p.recommended_selling_price,
  case
    when p.recipe_status = 'tanpa_resep' then p.base_cost
    when p.recipe_status = 'lengkap' then round(public.product_recipe_cost(p.id), 2)
  end as live_cost,
  case
    when p.recipe_status = 'tanpa_resep' then
      round(p.base_cost * (1 + coalesce(p.add_cost_percentage, 0) / 100), 2)
    when p.recipe_status = 'lengkap' then
      round(public.product_recipe_cost(p.id) * (1 + coalesce(p.add_cost_percentage, 0) / 100), 2)
  end as live_total_cost
from public.products p;

comment on column public.products.base_cost is
  'Cost manual (sebelum Add Cost), HANYA dipakai untuk produk tanpa_resep';

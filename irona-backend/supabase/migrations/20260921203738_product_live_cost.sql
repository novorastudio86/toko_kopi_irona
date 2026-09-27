-- Biaya per satuan hasil sebuah racikan (rekursif untuk racikan di dalam racikan)
-- Asumsi: satuan takaran di resep = satuan dasar bahannya (belum ada konversi satuan)
create or replace function public.racikan_unit_cost(p_racikan_id uuid, p_depth int default 0)
returns numeric
language plpgsql
stable
as $$
declare
  v_batch numeric := 0;
  v_add numeric;
  v_output numeric;
  comp record;
begin
  if p_depth > 10 then
    raise exception 'Resep racikan terlalu dalam atau melingkar (racikan %).', p_racikan_id;
  end if;

  select add_cost_percentage, total_output_qty
    into v_add, v_output
  from public.racikan
  where id = p_racikan_id;

  if v_output is null or v_output = 0 then
    return 0;
  end if;

  for comp in
    select * from public.racikan_components where racikan_id = p_racikan_id
  loop
    if comp.component_type = 'bahan_baku' then
      v_batch := v_batch + comp.quantity *
        coalesce((select unit_price from public.raw_materials where id = comp.raw_material_id), 0);
    else
      v_batch := v_batch + comp.quantity *
        public.racikan_unit_cost(comp.component_racikan_id, p_depth + 1);
    end if;
  end loop;

  return v_batch * (1 + coalesce(v_add, 0) / 100) / v_output;
end;
$$;

-- Cost resep produk (sebelum Add Cost), selalu dari harga bahan terkini
create or replace function public.product_recipe_cost(p_product_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(
    case
      when prc.component_type = 'bahan_baku' then prc.quantity * coalesce(rm.unit_price, 0)
      else prc.quantity * public.racikan_unit_cost(prc.racikan_id)
    end
  ), 0)
  from public.product_recipe_components prc
  left join public.raw_materials rm on rm.id = prc.raw_material_id
  where prc.product_id = p_product_id;
$$;

-- View yang dipakai Daftar Produk: Cost, Total Cost, dan Harga Rekomendasi selalu terkini
create or replace view public.products_with_cost
with (security_invoker = true)
as
select
  p.*,
  case
    when p.recipe_status = 'lengkap' then round(public.product_recipe_cost(p.id), 2)
  end as live_cost,
  case
    when p.recipe_status = 'tanpa_resep' then p.base_cost
    when p.recipe_status = 'lengkap' then
      round(public.product_recipe_cost(p.id) * (1 + coalesce(p.add_cost_percentage, 0) / 100), 2)
  end as live_total_cost
from public.products p;

-- Kolom lama ini tidak lagi jadi acuan (masih dipertahankan supaya seed tidak rusak)
comment on column public.products.cost is
  'DEPRECATED — pakai products_with_cost.live_cost';
comment on column public.products.recommended_selling_price is
  'DEPRECATED — hitung dari live_total_cost / (desired_cost_percentage / 100)';
comment on column public.products.base_cost is
  'Total Cost manual, HANYA dipakai untuk produk tanpa_resep';
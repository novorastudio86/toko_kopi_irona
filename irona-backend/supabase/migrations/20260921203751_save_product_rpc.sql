-- Simpan produk beserta resepnya sekaligus. p_product_id null = produk baru.
-- p_data  : field produk (snake_case) dalam bentuk JSON
-- p_recipe: array komponen [{component_type, raw_material_id, racikan_id, quantity, unit_id}]
create or replace function public.save_product(
  p_product_id uuid,
  p_data jsonb,
  p_recipe jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
  v_status text := p_data->>'recipe_status';
  v_active boolean;
begin
  if not public.is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menyimpan produk.' using errcode = '42501';
  end if;

  if v_status = 'tanpa_resep' and (p_data->>'base_cost') is null then
    raise exception 'Produk tanpa resep wajib punya Total Cost manual.';
  end if;

  -- Produk "Isi Nanti" selalu nonaktif sampai resepnya dilengkapi
  v_active := case
    when v_status = 'belum_lengkap' then false
    else coalesce((p_data->>'is_active')::boolean, true)
  end;

  if p_product_id is null then
    insert into public.products (
      name, description, photo_url, category_id, unit, sku,
      available_offline, available_online, recipe_status,
      base_cost, add_cost_percentage, desired_cost_percentage, selling_price, is_active
    ) values (
      p_data->>'name',
      nullif(p_data->>'description', ''),
      nullif(p_data->>'photo_url', ''),
      (p_data->>'category_id')::uuid,
      p_data->>'unit',
      nullif(p_data->>'sku', ''),
      coalesce((p_data->>'available_offline')::boolean, true),
      coalesce((p_data->>'available_online')::boolean, false),
      v_status,
      (p_data->>'base_cost')::numeric,
      coalesce((p_data->>'add_cost_percentage')::numeric, 0),
      (p_data->>'desired_cost_percentage')::numeric,
      (p_data->>'selling_price')::numeric,
      v_active
    )
    returning id into v_id;
  else
    update public.products set
      name = p_data->>'name',
      description = nullif(p_data->>'description', ''),
      photo_url = nullif(p_data->>'photo_url', ''),
      category_id = (p_data->>'category_id')::uuid,
      unit = p_data->>'unit',
      sku = nullif(p_data->>'sku', ''),
      available_offline = coalesce((p_data->>'available_offline')::boolean, true),
      available_online = coalesce((p_data->>'available_online')::boolean, false),
      recipe_status = v_status,
      base_cost = (p_data->>'base_cost')::numeric,
      add_cost_percentage = coalesce((p_data->>'add_cost_percentage')::numeric, 0),
      desired_cost_percentage = (p_data->>'desired_cost_percentage')::numeric,
      selling_price = (p_data->>'selling_price')::numeric,
      is_active = v_active
    where id = p_product_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Produk tidak ditemukan.';
    end if;
  end if;

  -- Resep diganti utuh: hapus komponen lama, masukkan yang baru
  delete from public.product_recipe_components where product_id = v_id;

  if v_status <> 'tanpa_resep' and jsonb_array_length(coalesce(p_recipe, '[]'::jsonb)) > 0 then
    insert into public.product_recipe_components
      (product_id, component_type, raw_material_id, racikan_id, quantity, unit_id)
    select
      v_id,
      r->>'component_type',
      nullif(r->>'raw_material_id', '')::uuid,
      nullif(r->>'racikan_id', '')::uuid,
      (r->>'quantity')::numeric,
      (r->>'unit_id')::uuid
    from jsonb_array_elements(p_recipe) as r;
  end if;

  return v_id;
end;
$$;
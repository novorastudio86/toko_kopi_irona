-- ============ Try & Error: Add Cost racikan baru bisa dipilih ============
-- Sebelumnya racikan_baru terkunci 10%. Sekarang admin memilih (10/20/30% atau custom) lewat p_add_cost.
-- Resep produk / racikan tetap memakai add cost dari Master Resep (p_add_cost diabaikan).
drop function if exists public.create_try_error(text, uuid, uuid, numeric, jsonb, text);

create or replace function public.create_try_error(
  p_type text,
  p_product_id uuid,
  p_racikan_id uuid,
  p_quantity numeric,
  p_items jsonb,
  p_notes text default null,
  p_add_cost numeric default 10
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
    v_add := coalesce(p_add_cost, 10);
    if v_add < 0 or v_add > 100 then
      raise exception 'Add Cost harus antara 0 dan 100%%.';
    end if;
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

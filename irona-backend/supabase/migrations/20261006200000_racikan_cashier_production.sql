-- Racikan Batch tertentu boleh diproduksi (update stok) oleh Kasir lewat Kasir App.
-- Manajer mencentang izinnya per racikan; kasir wajib mengisi alasan saat mencatat.

alter table public.racikan
  add column cashier_can_produce boolean not null default false;

-- ============ Simpan racikan (+ izin kasir) ============
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
  -- Izin kasir hanya berlaku untuk racikan Batch
  v_cashier boolean := v_mode = 'batch' and coalesce((p_data->>'cashier_can_produce')::boolean, false);
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
      add_cost_percentage, min_stock_alert, cashier_can_produce, is_active
    ) values (
      p_data->>'name',
      (p_data->>'unit_id')::uuid,
      v_mode,
      v_yield,
      v_output,
      v_add,
      case when v_mode = 'batch' then (p_data->>'min_stock_alert')::numeric end,
      v_cashier,
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
      cashier_can_produce = v_cashier,
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

-- ============ Produksi Racikan (Batch) ============
-- Admin: semua racikan Batch. Karyawan lain (Kasir): hanya racikan yang diizinkan,
-- wajib alasan (disimpan di notes), dan tanggal selalu hari ini.
-- Security definer karena tulis stock_movements dibatasi RLS untuk admin.
create or replace function public.record_racikan_production(
  p_racikan_id uuid,
  p_batch_qty numeric,
  p_movement_date date default current_date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := public.is_admin();
  v_mode text;
  v_output numeric;
  v_unit uuid;
  v_name text;
  v_cashier boolean;
  comp record;
  v_needed numeric;
  v_stock numeric;
  v_id uuid;
begin
  if not v_is_admin and not public.is_employee() then
    raise exception 'Tidak punya akses mencatat produksi racikan.' using errcode = '42501';
  end if;
  if coalesce(p_batch_qty, 0) <= 0 then
    raise exception 'Jumlah batch harus lebih dari 0.';
  end if;

  select production_mode, total_output_qty, unit_id, name, cashier_can_produce
    into v_mode, v_output, v_unit, v_name, v_cashier
  from public.racikan where id = p_racikan_id
  for update; -- antre per racikan supaya cek stok tidak balapan

  if v_mode is null then
    raise exception 'Racikan tidak ditemukan.';
  end if;
  if v_mode <> 'batch' then
    raise exception 'Hanya racikan Batch yang punya stok produksi.';
  end if;

  if not v_is_admin then
    if not v_cashier then
      raise exception 'Racikan ini tidak diizinkan diproduksi oleh kasir.' using errcode = '42501';
    end if;
    if nullif(trim(p_notes), '') is null then
      raise exception 'Alasan update stok wajib diisi.';
    end if;
    p_movement_date := current_date;
  end if;

  -- Potong bahan penyusun
  for comp in
    select rc.component_type, rc.raw_material_id, rc.component_racikan_id, rc.quantity, rc.unit_id
    from public.racikan_components rc
    where rc.racikan_id = p_racikan_id
  loop
    v_needed := comp.quantity * p_batch_qty;

    if comp.component_type = 'bahan_baku' then
      select current_stock into v_stock from public.raw_materials where id = comp.raw_material_id;
    else
      select current_stock into v_stock from public.racikan where id = comp.component_racikan_id;
    end if;

    if coalesce(v_stock, 0) < v_needed then
      raise exception 'Stok bahan tidak cukup untuk % batch (butuh %, tersedia %).',
        p_batch_qty, v_needed, coalesce(v_stock, 0);
    end if;

    insert into public.stock_movements (
      movement_type, item_type, raw_material_id, racikan_id, quantity, unit_id,
      batch_qty, notes, movement_date, created_by
    ) values (
      'produksi_racikan', comp.component_type, comp.raw_material_id, comp.component_racikan_id,
      -v_needed, comp.unit_id, p_batch_qty,
      coalesce(p_notes, '') || ' (produksi ' || v_name || ')', p_movement_date, auth.uid()
    );
  end loop;

  -- Tambah stok racikan
  insert into public.stock_movements (
    movement_type, item_type, racikan_id, quantity, unit_id,
    batch_qty, notes, movement_date, created_by
  ) values (
    'produksi_racikan', 'racikan', p_racikan_id, v_output * p_batch_qty, v_unit,
    p_batch_qty, p_notes, p_movement_date, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ============ Riwayat resep ikut mencatat izin kasir ============
create or replace function public.recipe_snapshot(p_type text, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with comps as (
    select coalesce(rm.name, rk.name) || ' ' || trim_scale(c.quantity)::text || ' ' || u.name as item
    from (
      select raw_material_id, racikan_id, quantity, unit_id
      from public.product_recipe_components
      where p_type = 'produk' and product_id = p_id
      union all
      select raw_material_id, component_racikan_id, quantity, unit_id
      from public.racikan_components
      where p_type = 'racikan' and racikan_id = p_id
    ) c
    left join public.raw_materials rm on rm.id = c.raw_material_id
    left join public.racikan rk on rk.id = c.racikan_id
    join public.units u on u.id = c.unit_id
  ),
  comp_list as (
    select coalesce(jsonb_agg(item order by item), '[]'::jsonb) as items from comps
  )
  select case p_type
    when 'produk' then (
      select jsonb_build_object('components', cl.items)
      from public.products p, comp_list cl
      where p.id = p_id
    )
    else (
      select jsonb_build_object(
        'name', r.name,
        'unit', u.name,
        'production_mode', r.production_mode,
        'yield_qty', r.yield_qty,
        'total_output_qty', r.total_output_qty,
        'add_cost_percentage', r.add_cost_percentage,
        'min_stock_alert', r.min_stock_alert,
        'cashier_can_produce', r.cashier_can_produce,
        'components', cl.items
      )
      from public.racikan r
      join public.units u on u.id = r.unit_id
      cross join comp_list cl
      where r.id = p_id
    )
  end;
$$;

-- Snapshot lama dianggap "tidak diizinkan" supaya simpan berikutnya tidak tercatat sebagai perubahan palsu
update public.recipe_history
set snapshot = snapshot || '{"cashier_can_produce": false}'::jsonb
where recipe_type = 'racikan' and snapshot is not null;

drop trigger racikan_log_history on public.racikan;
create constraint trigger racikan_log_history
after insert or delete or update of
  name, unit_id, production_mode, yield_qty, total_output_qty, add_cost_percentage, min_stock_alert,
  cashier_can_produce
on public.racikan
deferrable initially deferred
for each row execute function public.log_recipe_history('racikan', 'id');

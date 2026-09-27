-- ============================================================
-- KELOLA STOK — kartu stok periode + pencatatan mutasi
-- ============================================================

-- Kartu stok: mutasi setiap bahan baku & racikan batch dalam satu periode.
-- Stok awal dihitung mundur dari stok saat ini, supaya selalu konsisten.
create or replace function public.stock_card(p_start date, p_end date)
returns table (
  item_type   text,
  item_id     uuid,
  item_name   text,
  unit_name   text,
  opening     numeric,
  incoming    numeric,
  sold        numeric,
  adjustment  numeric,
  production  numeric,
  closing     numeric,
  min_stock   numeric
)
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
      sum(case when sm.movement_date between p_start and p_end
               and sm.movement_type = 'penyesuaian' then sm.quantity else 0 end) as adjustment,
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
    0::numeric,  -- Terjual: diisi setelah modul Penjualan memotong stok
    coalesce(mv.adjustment, 0),
    coalesce(mv.production, 0),
    i.current_stock - coalesce(mv.after_period, 0),
    i.min_stock_alert
  from items i
  left join mv on mv.item_id = i.id
  order by i.name;
$$;

-- ============ Stok Masuk ============
-- Qty & harga diinput dalam satuan pembelian, dikonversi ke satuan dasar di sini.
create or replace function public.record_stock_in(
  p_raw_material_id uuid,
  p_purchase_unit_id uuid,
  p_purchase_qty numeric,
  p_qty_per_package numeric,
  p_total_price numeric,
  p_movement_date date default current_date,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_base_qty numeric;
  v_unit_price numeric;
  v_base_unit uuid;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mencatat stok masuk.' using errcode = '42501';
  end if;
  if coalesce(p_purchase_qty, 0) <= 0 or coalesce(p_qty_per_package, 0) <= 0 then
    raise exception 'Jumlah pembelian dan isi per kemasan harus lebih dari 0.';
  end if;
  if coalesce(p_total_price, 0) <= 0 then
    raise exception 'Total harga pembelian harus lebih dari 0.';
  end if;

  select base_unit_id into v_base_unit from public.raw_materials where id = p_raw_material_id;
  if v_base_unit is null then
    raise exception 'Bahan baku tidak ditemukan.';
  end if;

  v_base_qty := p_purchase_qty * p_qty_per_package;
  v_unit_price := p_total_price / v_base_qty;  -- harga pembelian terakhir

  insert into public.stock_movements (
    movement_type, item_type, raw_material_id, quantity, unit_id,
    purchase_unit_id, purchase_qty, qty_per_package, total_price, unit_price,
    notes, movement_date, created_by
  ) values (
    'stok_masuk', 'bahan_baku', p_raw_material_id, v_base_qty, v_base_unit,
    p_purchase_unit_id, p_purchase_qty, p_qty_per_package, p_total_price, v_unit_price,
    p_notes, p_movement_date, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ============ Penyesuaian (stok opname) ============
-- Yang diinput adalah stok fisik hasil hitung; sistem mencatat selisihnya.
create or replace function public.record_stock_adjustment(
  p_item_type text,
  p_item_id uuid,
  p_physical_qty numeric,
  p_reason text,
  p_notes text default null,
  p_movement_date date default current_date
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_current numeric;
  v_unit uuid;
  v_delta numeric;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mencatat penyesuaian stok.' using errcode = '42501';
  end if;
  if p_physical_qty is null or p_physical_qty < 0 then
    raise exception 'Stok fisik tidak boleh kosong atau negatif.';
  end if;

  if p_item_type = 'bahan_baku' then
    select current_stock, base_unit_id into v_current, v_unit from public.raw_materials where id = p_item_id;
  else
    select current_stock, unit_id into v_current, v_unit from public.racikan where id = p_item_id;
  end if;

  if v_current is null then
    raise exception 'Item tidak ditemukan.';
  end if;

  v_delta := p_physical_qty - v_current;
  if v_delta = 0 then
    raise exception 'Stok fisik sama dengan stok sistem, tidak ada yang perlu disesuaikan.';
  end if;

  insert into public.stock_movements (
    movement_type, item_type, raw_material_id, racikan_id, quantity, unit_id,
    adjustment_reason, notes, movement_date, created_by
  ) values (
    'penyesuaian', p_item_type,
    case when p_item_type = 'bahan_baku' then p_item_id end,
    case when p_item_type = 'racikan' then p_item_id end,
    v_delta, v_unit, p_reason, p_notes, p_movement_date, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ============ Produksi Racikan (Batch) ============
-- Memotong stok bahan penyusun dan menambah stok racikan dalam satu transaksi.
create or replace function public.record_racikan_production(
  p_racikan_id uuid,
  p_batch_qty numeric,
  p_movement_date date default current_date,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_mode text;
  v_output numeric;
  v_unit uuid;
  v_name text;
  comp record;
  v_needed numeric;
  v_stock numeric;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mencatat produksi racikan.' using errcode = '42501';
  end if;
  if coalesce(p_batch_qty, 0) <= 0 then
    raise exception 'Jumlah batch harus lebih dari 0.';
  end if;

  select production_mode, total_output_qty, unit_id, name
    into v_mode, v_output, v_unit, v_name
  from public.racikan where id = p_racikan_id;

  if v_mode is null then
    raise exception 'Racikan tidak ditemukan.';
  end if;
  if v_mode <> 'batch' then
    raise exception 'Hanya racikan Batch yang punya stok produksi.';
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
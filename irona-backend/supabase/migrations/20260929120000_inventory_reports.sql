-- ============================================================
-- LAPORAN PERSEDIAAN
--
-- Penyesuaian terhadap PRD (model data kita):
-- - PRD membagi Jenis "Produk Jadi / Bahan Baku". Di sistem ini persediaan = Bahan Baku
--   (raw_materials) + Racikan (bahan setengah jadi, mis. sirup). Barang seperti air botol dicatat
--   sebagai bahan baku. Jadi Jenis = Bahan Baku / Racikan, dan "Kategori" = jenis bahan
--   (Barang Tetap / Bahan Menyusut) karena bahan baku tidak punya kategori.
-- - Ringkasan per tanggal snapshot: stok = stok sekarang − semua pergerakan setelah tanggal itu.
--   Harga modal bahan = harga stok masuk terakhir s.d. tanggal itu (fallback harga sekarang).
--   Harga racikan = biaya per satuan racikan (dari harga bahan terkini).
-- - Nilai penyesuaian stok = jumlah × harga per satuan saat itu.
-- ============================================================

-- Harga per satuan dasar bahan baku yang berlaku pada suatu tanggal
create or replace function public.raw_material_price_at(p_raw_material_id uuid, p_date date)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select sm.unit_price
     from stock_movements sm
     where sm.raw_material_id = p_raw_material_id
       and sm.movement_type = 'stok_masuk'
       and sm.unit_price is not null
       and sm.movement_date <= p_date
     order by sm.movement_date desc, sm.created_at desc
     limit 1),
    (select unit_price from raw_materials where id = p_raw_material_id),
    0);
$$;

-- ------------------------------------------------------------
-- Ringkasan Persediaan (snapshot)
-- ------------------------------------------------------------
create or replace function public.report_stock_summary(p_date date)
returns table (
  item_type text,          -- 'bahan_baku' | 'racikan'
  item_id uuid,
  name text,
  material_type text,      -- 'tetap' | 'menyusut' (bahan baku); null untuk racikan
  unit_name text,
  quantity numeric,
  unit_price numeric,
  total_value numeric,
  is_active boolean
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh melihat laporan.' using errcode = '42501';
  end if;
  return query
  with after_date as (
    select sm.raw_material_id, sm.racikan_id, sum(sm.quantity) as qty
    from stock_movements sm
    where sm.movement_date > p_date
    group by sm.raw_material_id, sm.racikan_id
  ), items as (
    select 'bahan_baku'::text as item_type, rm.id, rm.name, rm.material_type, u.name as unit_name,
           rm.current_stock - coalesce(a.qty, 0) as qty,
           raw_material_price_at(rm.id, p_date) as price,
           rm.is_active, rm.created_at
    from raw_materials rm
    join units u on u.id = rm.base_unit_id
    left join after_date a on a.raw_material_id = rm.id
    union all
    select 'racikan', r.id, r.name, null, u.name,
           r.current_stock - coalesce(a.qty, 0),
           racikan_unit_cost(r.id),
           r.is_active, r.created_at
    from racikan r
    join units u on u.id = r.unit_id
    left join after_date a on a.racikan_id = r.id
    where r.production_mode = 'batch' or r.current_stock <> 0
  )
  select i.item_type, i.id, i.name, i.material_type, i.unit_name,
         round(i.qty, 3), round(i.price, 4), round(greatest(i.qty, 0) * i.price, 2), i.is_active
  from items i
  -- Item yang dibuat setelah tanggal snapshot (dan belum punya stok saat itu) belum ada
  where (i.created_at at time zone 'Asia/Jakarta')::date <= p_date or i.qty <> 0
  order by i.item_type, i.name;
end;
$$;

-- ------------------------------------------------------------
-- Laporan Pembelian (stok masuk bahan baku)
-- ------------------------------------------------------------
create or replace function public.report_stock_purchases(p_start date, p_end date)
returns table (
  movement_id uuid,
  movement_date date,
  raw_material_id uuid,
  name text,
  quantity numeric,          -- dalam satuan dasar
  base_unit text,
  purchase_qty numeric,      -- dalam satuan beli (mis. 2 pack)
  purchase_unit text,
  qty_per_package numeric,
  total_price numeric,
  unit_price numeric,
  notes text,
  created_by_name text,
  created_at timestamptz
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh melihat laporan.' using errcode = '42501';
  end if;
  return query
  select sm.id, sm.movement_date, rm.id, rm.name, sm.quantity, bu.name,
         sm.purchase_qty, pu.name, sm.qty_per_package, coalesce(sm.total_price, 0), sm.unit_price,
         sm.notes, e.full_name, sm.created_at
  from stock_movements sm
  join raw_materials rm on rm.id = sm.raw_material_id
  join units bu on bu.id = rm.base_unit_id
  left join units pu on pu.id = sm.purchase_unit_id
  left join employees e on e.id = sm.created_by
  where sm.movement_type = 'stok_masuk'
    and sm.movement_date between p_start and p_end
  order by sm.movement_date desc, sm.created_at desc;
end;
$$;

-- ------------------------------------------------------------
-- Laporan Penyesuaian Stok (Kelola Stok → Penyesuaian)
-- ------------------------------------------------------------
create or replace function public.report_stock_adjustments(p_start date, p_end date)
returns table (
  movement_id uuid,
  movement_date date,
  item_type text,
  item_id uuid,
  name text,
  reason text,               -- opname | penyusutan | rusak | hilang | lainnya
  quantity numeric,          -- + penambahan, − pengurangan (satuan dasar)
  unit_name text,
  unit_price numeric,
  value numeric,             -- quantity × harga per satuan saat itu
  notes text,
  created_by_name text,
  created_at timestamptz
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh melihat laporan.' using errcode = '42501';
  end if;
  return query
  select sm.id, sm.movement_date, sm.item_type,
         coalesce(sm.raw_material_id, sm.racikan_id),
         coalesce(rm.name, r.name),
         coalesce(sm.adjustment_reason, 'lainnya'),
         sm.quantity, u.name, x.price, round(sm.quantity * x.price, 2),
         sm.notes, e.full_name, sm.created_at
  from stock_movements sm
  left join raw_materials rm on rm.id = sm.raw_material_id
  left join racikan r on r.id = sm.racikan_id
  join units u on u.id = sm.unit_id
  left join employees e on e.id = sm.created_by
  cross join lateral (
    select coalesce(sm.unit_price,
                    case when sm.item_type = 'bahan_baku'
                         then raw_material_price_at(sm.raw_material_id, sm.movement_date)
                         else racikan_unit_cost(sm.racikan_id) end) as price
  ) x
  where sm.movement_type = 'penyesuaian'
    and sm.movement_date between p_start and p_end
  order by sm.movement_date desc, sm.created_at desc;
end;
$$;

-- ============================================================
-- ANALISA TREN & MARGIN
--
-- - Waktu Teramai Produk: jumlah unit terjual per (hari, jam) WIB, bisa per produk/kategori.
-- - Waktu Teramai Penjualan: jumlah transaksi & nilai penjualan (setelah refund) per (hari, jam).
--   Transaksi dibatalkan & refund penuh tidak dihitung.
-- - Perputaran Stok per bahan baku:
--     Stok Awal  = stok di awal tanggal mulai (stok sekarang − pergerakan sejak tanggal mulai)
--     Stok Akhir = stok di akhir tanggal selesai
--     Terpakai   = pemakaian dari Kelola Stok: penjualan (dikurangi refund), bahan untuk produksi
--                  racikan, dan Try & Error. Penyesuaian (opname/rusak/dll.) tidak dihitung.
--     Rasio      = Terpakai ÷ rata-rata stok ((awal + akhir) / 2)
--     Estimasi Hari Bertahan = jumlah hari periode ÷ rasio
-- Hari: 0 = Minggu … 6 = Sabtu (extract dow).
-- ============================================================

create or replace function public.report_peak_products(
  p_start timestamptz,
  p_end timestamptz,
  p_product_id uuid default null,
  p_category_id uuid default null
)
returns table (dow integer, hour integer, quantity numeric)
language plpgsql
stable
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh melihat laporan.' using errcode = '42501';
  end if;
  return query
  select extract(dow from t.transaction_date at time zone 'Asia/Jakarta')::int,
         extract(hour from t.transaction_date at time zone 'Asia/Jakarta')::int,
         sum(i.quantity)::numeric
  from transactions t
  join transaction_items i on i.transaction_id = t.id
  join products p on p.id = i.product_id
  where t.status not in ('dibatalkan', 'refund_penuh')
    and t.transaction_date >= p_start and t.transaction_date < p_end
    and (p_product_id is null or i.product_id = p_product_id)
    and (p_category_id is null or p.category_id = p_category_id)
  group by 1, 2;
end;
$$;

create or replace function public.report_peak_transactions(
  p_start timestamptz,
  p_end timestamptz,
  p_channel text default null,
  p_order_type text default null
)
returns table (dow integer, hour integer, transactions bigint, sales numeric)
language plpgsql
stable
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh melihat laporan.' using errcode = '42501';
  end if;
  return query
  select extract(dow from s.order_time at time zone 'Asia/Jakarta')::int,
         extract(hour from s.order_time at time zone 'Asia/Jakarta')::int,
         count(*),
         sum(s.total_amount - s.refund_amount)
  from sales_report_filtered(p_start, p_end, 'order', p_channel, p_order_type, null, null) s
  where s.status <> 'refund_penuh'
  group by 1, 2;
end;
$$;

create or replace function public.report_stock_cycle(p_start date, p_end date)
returns table (
  raw_material_id uuid,
  name text,
  material_type text,
  unit_name text,
  is_active boolean,
  opening_stock numeric,
  closing_stock numeric,
  used numeric,
  avg_stock numeric,
  turnover numeric,          -- null bila rata-rata stok ≤ 0
  days_cover numeric         -- null bila tidak ada pemakaian
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_days int := p_end - p_start + 1;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh melihat laporan.' using errcode = '42501';
  end if;
  return query
  with mv as (
    select sm.raw_material_id,
           sum(sm.quantity) filter (where sm.movement_date >= p_start) as since_start,
           sum(sm.quantity) filter (where sm.movement_date > p_end) as after_end,
           -sum(sm.quantity) filter (
             where sm.movement_date between p_start and p_end
               and (sm.movement_type in ('penjualan', 'refund', 'try_error')
                    or (sm.movement_type = 'produksi_racikan' and sm.quantity < 0))
           ) as used
    from stock_movements sm
    where sm.item_type = 'bahan_baku' and sm.movement_date >= p_start
    group by sm.raw_material_id
  ), x as (
    select rm.id, rm.name, rm.material_type, u.name as unit_name, rm.is_active,
           rm.current_stock - coalesce(mv.since_start, 0) as opening,
           rm.current_stock - coalesce(mv.after_end, 0) as closing,
           greatest(coalesce(mv.used, 0), 0) as used
    from raw_materials rm
    join units u on u.id = rm.base_unit_id
    left join mv on mv.raw_material_id = rm.id
  )
  select x.id, x.name, x.material_type, x.unit_name, x.is_active,
         round(x.opening, 3), round(x.closing, 3), round(x.used, 3),
         round((x.opening + x.closing) / 2, 3),
         case when (x.opening + x.closing) / 2 > 0
              then round(x.used / ((x.opening + x.closing) / 2), 3) end,
         case when x.used > 0 and (x.opening + x.closing) / 2 > 0
              then round(v_days / (x.used / ((x.opening + x.closing) / 2)), 1) end
  from x
  order by x.name;
end;
$$;

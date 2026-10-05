-- ============================================================
-- LAPORAN PRODUK (Penjualan Produk + Penjualan Kategori)
--
-- - HPP per item disimpan saat transaksi (transaction_items.unit_cost), diambil otomatis dari
--   Total Cost produk (products_with_cost.live_total_cost) saat item dibuat. Laporan lama tetap
--   akurat walau harga bahan baku berubah. Produk yang resepnya belum lengkap → unit_cost NULL
--   (laporan menandai "HPP belum lengkap").
-- - Item lama diisi dengan HPP saat migration ini dijalankan.
-- - Penjualan per item = line_total dikurangi porsi diskon transaksi & porsi refund (proporsional).
--   Transaksi dibatalkan / refund penuh tidak dihitung.
-- - Laba Kotor produk = Penjualan − HPP (tanpa biaya gateway, karena tidak bisa dipecah per produk).
-- ============================================================

alter table public.transaction_items
  add column unit_cost numeric(14,2);

comment on column public.transaction_items.unit_cost is
  'HPP per unit saat transaksi (snapshot Total Cost produk). NULL = resep belum lengkap';

create or replace function public.set_transaction_item_cost()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.unit_cost is null then
    select live_total_cost into new.unit_cost from products_with_cost where id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger transaction_items_set_cost
  before insert on public.transaction_items
  for each row execute function public.set_transaction_item_cost();

update public.transaction_items i
set unit_cost = p.live_total_cost
from public.products_with_cost p
where p.id = i.product_id
  and i.unit_cost is null;

-- ------------------------------------------------------------
-- Baris penjualan per item (dasar kedua laporan)
-- ------------------------------------------------------------
create or replace function public.product_sales_lines(
  p_start timestamptz,
  p_end timestamptz,
  p_channel text default null,
  p_order_type text default null
)
returns table (
  sale_date date,
  product_id uuid,
  category_id uuid,
  quantity numeric,
  sales numeric,
  hpp numeric,
  missing_cost boolean
)
language sql
stable
set search_path = public
as $$
  with t as (
    select t.id, t.transaction_date, t.total_amount,
           coalesce((select sum(r.refund_amount) from refunds r where r.transaction_id = t.id), 0) as refund,
           (select sum(i.line_total) from transaction_items i where i.transaction_id = t.id) as items_total
    from transactions t
    where t.status not in ('dibatalkan', 'refund_penuh')
      and t.transaction_date >= p_start
      and t.transaction_date < p_end
      and (p_channel is null
           or (p_channel = 'online') = (t.order_type = 'online'))
      and (p_order_type is null or t.order_type = p_order_type)
  )
  select
    (t.transaction_date at time zone 'Asia/Jakarta')::date,
    i.product_id,
    p.category_id,
    i.quantity::numeric,
    coalesce(i.line_total * greatest(t.total_amount - t.refund, 0) / nullif(t.items_total, 0), 0),
    coalesce(i.unit_cost, 0) * i.quantity,
    i.unit_cost is null
  from t
  join transaction_items i on i.transaction_id = t.id
  join products p on p.id = i.product_id;
$$;

-- ------------------------------------------------------------
-- Penjualan Produk: rincian per produk + tren harian 5 produk terlaris
-- ------------------------------------------------------------
create or replace function public.report_product_sales(
  p_start timestamptz,
  p_end timestamptz,
  p_category_id uuid default null,
  p_channel text default null,
  p_order_type text default null
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v jsonb;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh melihat laporan.' using errcode = '42501';
  end if;

  with l as (
    select * from product_sales_lines(p_start, p_end, p_channel, p_order_type)
    where p_category_id is null or category_id = p_category_id
  ), per_product as (
    select l.product_id, p.name, c.name as category_name,
           sum(l.quantity) as quantity, sum(l.sales) as sales, sum(l.hpp) as hpp,
           bool_or(l.missing_cost) as missing_cost
    from l
    join products p on p.id = l.product_id
    join categories c on c.id = l.category_id
    group by l.product_id, p.name, c.name
  ), top5 as (
    select product_id from per_product order by sales desc, quantity desc limit 5
  )
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', product_id, 'name', name, 'category_name', category_name,
        'quantity', quantity, 'sales', round(sales, 2), 'hpp', round(hpp, 2),
        'missing_cost', missing_cost) order by sales desc, quantity desc)
      from per_product), '[]'),
    'series', coalesce((
      select jsonb_agg(x order by x.date) from (
        select l.sale_date as date, l.product_id, round(sum(l.sales), 2) as sales,
               sum(l.quantity) as quantity
        from l where l.product_id in (select product_id from top5)
        group by 1, 2
      ) x), '[]')
  ) into v;
  return v;
end;
$$;

-- ------------------------------------------------------------
-- Penjualan Kategori: rincian per kategori + tren per hari/bulan
-- ------------------------------------------------------------
create or replace function public.report_category_sales(
  p_start timestamptz,
  p_end timestamptz,
  p_channel text default null,
  p_group text default 'day'
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v jsonb;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh melihat laporan.' using errcode = '42501';
  end if;

  with l as (
    select * from product_sales_lines(p_start, p_end, p_channel, null)
  )
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(x order by x.sales desc) from (
        select l.category_id, c.name, count(distinct l.product_id) as product_count,
               sum(l.quantity) as quantity, round(sum(l.sales), 2) as sales,
               round(sum(l.hpp), 2) as hpp, bool_or(l.missing_cost) as missing_cost
        from l join categories c on c.id = l.category_id
        group by l.category_id, c.name
      ) x), '[]'),
    'series', coalesce((
      select jsonb_agg(x order by x.period) from (
        select date_trunc(case when p_group = 'month' then 'month' else 'day' end,
                          l.sale_date)::date as period,
               l.category_id, round(sum(l.sales), 2) as sales, sum(l.quantity) as quantity
        from l group by 1, 2
      ) x), '[]')
  ) into v;
  return v;
end;
$$;

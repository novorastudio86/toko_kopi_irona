-- ============================================================
-- DASHBOARD
--
-- Satu RPC mengembalikan semua angka dashboard (jsonb) untuk periode terpilih + periode pembanding.
-- Definisi (default, bisa direvisi):
-- - Penjualan dihitung dari transaksi berstatus selesai / refund sebagian (refund penuh & batal tidak
--   dihitung); refund sebagian dikurangkan. Nilai = total yang dibayar pelanggan (setelah diskon).
-- - Penjualan Terbayar = transaksi kasir + pesanan online yang sudah settlement di payment gateway.
-- - Biaya Promosi = total potongan diskon.
-- - Online = order_type 'online'; lainnya offline.
-- - Target penjualan harian & bulanan diatur Admin/Owner (mingguan = harian × 7).
-- - p_end = akhir periode penuh; p_prev_end = pembanding dipotong sepanjang periode ini yang sudah berjalan
--   (angka KPI adil), sedangkan grafik pembanding ditampilkan penuh.
-- ============================================================

create table public.sales_targets (
  id boolean primary key default true check (id),
  daily_target numeric(14,2) not null default 0 check (daily_target >= 0),
  monthly_target numeric(14,2) not null default 0 check (monthly_target >= 0),
  updated_by uuid references public.employees(id),
  updated_at timestamptz not null default now()
);
insert into public.sales_targets default values;

alter table public.sales_targets enable row level security;
create policy "sales_targets_admin_all" on public.sales_targets for all to authenticated
  using (is_admin()) with check (is_admin());

create or replace function public.save_sales_targets(p_daily numeric, p_monthly numeric)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur target penjualan.' using errcode = '42501';
  end if;
  if coalesce(p_daily, 0) < 0 or coalesce(p_monthly, 0) < 0 then
    raise exception 'Target tidak boleh minus.';
  end if;
  update sales_targets set daily_target = coalesce(p_daily, 0), monthly_target = coalesce(p_monthly, 0),
         updated_by = auth.uid(), updated_at = now()
  where id;
end;
$$;


-- Ringkasan 1 periode (dipakai untuk periode ini & pembanding)
create or replace function public.dashboard_period_stats(p_start timestamptz, p_end timestamptz)
returns jsonb
language sql
stable
set search_path = public
as $$
  with tx as (
    select t.*,
           t.total_amount - coalesce((select sum(r.refund_amount) from refunds r where r.transaction_id = t.id), 0)
             as net_amount,
           t.order_type = 'online' as is_online
    from transactions t
    where t.transaction_date >= p_start and t.transaction_date < p_end
      and t.status in ('selesai', 'refund_sebagian')
  ),
  items as (
    select tx.is_online, sum(ti.quantity) as qty
    from tx join transaction_items ti on ti.transaction_id = tx.id
    group by tx.is_online
  )
  select jsonb_build_object(
    'sales', coalesce(sum(net_amount), 0),
    'paid_sales', coalesce(sum(net_amount) filter (where not is_online or settled_at is not null), 0),
    'promo_cost', coalesce(sum(discount_amount), 0),
    'transactions', count(*),
    'transactions_offline', count(*) filter (where not is_online),
    'transactions_online', count(*) filter (where is_online),
    'products_sold', coalesce((select sum(qty) from items), 0),
    'products_offline', coalesce((select sum(qty) from items where not is_online), 0),
    'products_online', coalesce((select sum(qty) from items where is_online), 0)
  )
  from tx;
$$;

-- Penjualan per jam (p_granularity 'hour', key = jam 0–23) atau per hari (key = hari ke-0, 1, ...)
create or replace function public.dashboard_sales_series(p_start timestamptz, p_end timestamptz, p_granularity text)
returns table (bucket integer, amount numeric, transactions bigint)
language sql
stable
set search_path = public
as $$
  select
    case when p_granularity = 'hour'
         then extract(hour from t.transaction_date at time zone 'Asia/Jakarta')::int
         else ((t.transaction_date at time zone 'Asia/Jakarta')::date
               - (p_start at time zone 'Asia/Jakarta')::date)::int end as bucket,
    sum(t.total_amount - coalesce((select sum(r.refund_amount) from refunds r where r.transaction_id = t.id), 0)),
    count(*)
  from transactions t
  where t.transaction_date >= p_start and t.transaction_date < p_end
    and t.status in ('selesai', 'refund_sebagian')
  group by 1
  order by 1;
$$;

create or replace function public.dashboard_summary(
  p_start timestamptz,
  p_end timestamptz,
  p_prev_start timestamptz,
  p_prev_end timestamptz,
  p_granularity text
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
    raise exception 'Hanya Admin/Owner yang boleh melihat dashboard.' using errcode = '42501';
  end if;

  with tx as (
    select t.id, t.order_type, t.payment_method, t.employee_id,
           t.total_amount - coalesce((select sum(r.refund_amount) from refunds r where r.transaction_id = t.id), 0)
             as net_amount
    from transactions t
    where t.transaction_date >= p_start and t.transaction_date < p_end
      and t.status in ('selesai', 'refund_sebagian')
  ),
  item_rows as (
    select ti.product_id, ti.quantity, ti.line_total
    from tx join transaction_items ti on ti.transaction_id = tx.id
  )
  select jsonb_build_object(
    'current', dashboard_period_stats(p_start, p_end),
    'previous', dashboard_period_stats(p_prev_start, p_prev_end),
    'series', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'amount', amount))
                        from dashboard_sales_series(p_start, p_end, p_granularity)), '[]'),
    'previous_series', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'amount', amount))
                                 -- grafik pembanding ditampilkan penuh (tidak dipotong seperti angka KPI)
                                 from dashboard_sales_series(p_prev_start,
                                        least(p_prev_start + (p_end - p_start), p_start), p_granularity)), '[]'),
    'by_cashier', coalesce((
      select jsonb_agg(x order by x.amount desc) from (
        select e.full_name as name, sum(tx.net_amount) as amount, count(*) as transactions
        from tx join employees e on e.id = tx.employee_id
        where tx.order_type <> 'online'
        group by e.full_name
      ) x), '[]'),
    'by_order_type', coalesce((
      select jsonb_agg(x order by x.amount desc) from (
        select order_type as key, sum(net_amount) as amount, count(*) as transactions
        from tx group by order_type
      ) x), '[]'),
    'by_payment', coalesce((
      select jsonb_agg(x order by x.amount desc) from (
        select payment_method as key, sum(net_amount) as amount, count(*) as transactions
        from tx group by payment_method
      ) x), '[]'),
    'by_category', coalesce((
      select jsonb_agg(x order by x.amount desc) from (
        select coalesce(c.name, 'Tanpa Kategori') as name, sum(i.line_total) as amount, sum(i.quantity) as qty
        from item_rows i
        join products p on p.id = i.product_id
        left join categories c on c.id = p.category_id
        group by 1
      ) x), '[]'),
    'top_products', coalesce((
      select jsonb_agg(x order by x.qty desc, x.amount desc) from (
        select p.name, sum(i.quantity) as qty, sum(i.line_total) as amount
        from item_rows i join products p on p.id = i.product_id
        group by p.name
      ) x), '[]'),
    'low_stock', coalesce((
      select jsonb_agg(x order by x.ratio) from (
        select rm.name, rm.current_stock as stock, rm.min_stock_alert as min_stock, u.name as unit,
               rm.current_stock / nullif(rm.min_stock_alert, 0) as ratio
        from raw_materials rm left join units u on u.id = rm.base_unit_id
        where rm.is_active and rm.min_stock_alert > 0
        union all
        select r.name, r.current_stock, r.min_stock_alert, u.name,
               r.current_stock / nullif(r.min_stock_alert, 0)
        from racikan r left join units u on u.id = r.unit_id
        where r.is_active and r.production_mode = 'batch' and coalesce(r.min_stock_alert, 0) > 0
      ) x), '[]'),
    'targets', (select jsonb_build_object('daily', daily_target, 'monthly', monthly_target) from sales_targets),
    'generated_at', now()
  ) into v;

  return v;
end;
$$;

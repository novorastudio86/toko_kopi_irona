-- Dashboard: Penjualan per Kasir hanya menampilkan karyawan ber-role Kasir

CREATE OR REPLACE FUNCTION public.dashboard_summary(p_start timestamp with time zone, p_end timestamp with time zone, p_prev_start timestamp with time zone, p_prev_end timestamp with time zone, p_granularity text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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
        -- Hanya karyawan ber-role Kasir (kasir aktif tetap tampil walau belum ada penjualan)
        select e.full_name as name, coalesce(sum(tx.net_amount), 0) as amount, count(tx.id) as transactions
        from employees e
        join roles r on r.id = e.role_id and r.type = 'kasir'
        left join tx on tx.employee_id = e.id and tx.order_type <> 'online'
        group by e.id, e.full_name, e.is_active
        having e.is_active or count(tx.id) > 0
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
$function$;

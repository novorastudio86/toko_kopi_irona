-- ============================================================
-- DATA PESANAN ONLINE + LAPORAN PENJUALAN
--
-- - Kolom pesanan online di transaksi (diisi Web Customer nanti; sekarang data dummy):
--   ongkir, biaya layanan, penyesuaian harga online, jarak, alamat, driver.
-- - total_amount tetap = nilai PRODUK setelah diskon. Total dibayar pelanggan
--   = total_amount + ongkir + biaya layanan.
-- - Keputusan sementara: ongkir & biaya layanan DIPISAH dari penjualan (tidak ikut 40/30/30).
-- - MDR Midtrans dihitung dari total dibayar; porsi MDR untuk produk saja yang mengurangi penjualan
--   bersih di Keuangan.
-- - View sales_report_rows + RPC agregat untuk Laporan Penjualan.
-- ============================================================

alter table public.transactions
  add column delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  add column service_fee numeric(14,2) not null default 0 check (service_fee >= 0),
  add column online_price_adjustment numeric(14,2) not null default 0,
  add column delivery_distance_km numeric(6,2) check (delivery_distance_km >= 0),
  add column delivery_address text,
  add column driver_id uuid references public.employees(id);

comment on column public.transactions.delivery_fee is 'Ongkir pesanan online (dibayar pelanggan)';
comment on column public.transactions.service_fee is 'Biaya layanan pesanan online';
comment on column public.transactions.online_price_adjustment is
  'Bagian nilai produk yang berasal dari penyesuaian harga online (markup Order Online)';

-- MDR dari total yang dibayar (produk + ongkir + biaya layanan)
create or replace function public.set_transaction_gateway_fee()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  s record;
begin
  if new.order_type = 'online' and new.payment_method = 'qris' then
    select mdr_percent, ppn_percent into s from online_order_settings;
    new.gateway_mdr := round((new.total_amount + new.delivery_fee + new.service_fee) * coalesce(s.mdr_percent, 0) / 100, 2);
    new.gateway_tax := round(new.gateway_mdr * coalesce(s.ppn_percent, 0) / 100, 2);
  else
    new.gateway_mdr := 0;
    new.gateway_tax := 0;
  end if;
  return new;
end;
$$;

drop trigger transactions_gateway_fee on public.transactions;
create trigger transactions_gateway_fee
  before insert or update of total_amount, delivery_fee, service_fee, order_type, payment_method
  on public.transactions
  for each row execute function public.set_transaction_gateway_fee();

-- Tutup buku: ongkir & biaya layanan ikut dikunci
create or replace function public.guard_transaction_period_lock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_old date;
  v_new date;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := (old.transaction_date at time zone 'Asia/Jakarta')::date;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := (new.transaction_date at time zone 'Asia/Jakarta')::date;
  end if;

  if tg_op = 'INSERT' then
    perform assert_period_open(v_new);
  elsif tg_op = 'DELETE' then
    perform assert_period_open(v_old);
  elsif (old.transaction_date, old.total_amount, old.subtotal, old.discount_amount, old.order_type,
         old.payment_method, old.delivery_fee, old.service_fee)
        is distinct from
        (new.transaction_date, new.total_amount, new.subtotal, new.discount_amount, new.order_type,
         new.payment_method, new.delivery_fee, new.service_fee)
     or ((old.status = 'dibatalkan') is distinct from (new.status = 'dibatalkan')) then
    perform assert_period_open(v_old);
    perform assert_period_open(v_new);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Keuangan: penjualan bersih = nilai produk − porsi MDR untuk produk
create or replace view public.cash_flow_entries
with (security_invoker = true)
as
WITH fs AS (
         SELECT finance_settings.id,
            finance_settings.hpp_pct,
            finance_settings.fixed_cost_pct,
            finance_settings.net_profit_pct,
            finance_settings.hpp_budget_pct,
            finance_settings.bep_pct,
            finance_settings.owner_pct,
            finance_settings.manager_pct,
            finance_settings.settlement_business_days,
            finance_settings.updated_at
           FROM finance_settings
        ), sales AS (
         SELECT ((t.transaction_date AT TIME ZONE 'Asia/Jakarta'::text))::date AS d,
            count(*) AS trx_count,
            sum(t.total_amount - COALESCE(((t.gateway_mdr + t.gateway_tax) * t.total_amount / NULLIF(t.total_amount + t.delivery_fee + t.service_fee, (0)::numeric)), (0)::numeric)) AS net
           FROM transactions t
          WHERE (t.status <> 'dibatalkan'::text)
          GROUP BY (((t.transaction_date AT TIME ZONE 'Asia/Jakarta'::text))::date)
        ), refund_base AS (
         SELECT r.id,
            r.refunded_at,
            t.transaction_number,
            ((r.refund_amount * (t.total_amount - COALESCE(((t.gateway_mdr + t.gateway_tax) * t.total_amount / NULLIF(t.total_amount + t.delivery_fee + t.service_fee, (0)::numeric)), (0)::numeric))) / NULLIF(t.total_amount, (0)::numeric)) AS base
           FROM (refunds r
             JOIN transactions t ON ((t.id = r.transaction_id)))
        ), buckets AS (
         SELECT 'hpp'::text AS bucket,
            fs.hpp_pct AS pct
           FROM fs
        UNION ALL
         SELECT 'fixed_cost'::text,
            fs.fixed_cost_pct
           FROM fs
        UNION ALL
         SELECT 'net_profit'::text,
            fs.net_profit_pct
           FROM fs
        )
 SELECT b.bucket,
    s.d AS entry_date,
    'alokasi'::text AS entry_type,
    format('Alokasi %s%% dari %s transaksi'::text, trim_scale(b.pct), s.trx_count) AS description,
    round(((s.net * b.pct) / (100)::numeric), 2) AS amount,
    'sales_day'::text AS ref_table,
    NULL::uuid AS ref_id,
    ((s.d + '23:59:59'::time without time zone) AT TIME ZONE 'Asia/Jakarta'::text) AS sort_at
   FROM (sales s
     CROSS JOIN buckets b)
UNION ALL
 SELECT b.bucket,
    ((rb.refunded_at AT TIME ZONE 'Asia/Jakarta'::text))::date AS entry_date,
    'reversal_refund'::text AS entry_type,
    format('Reversal refund %s (%s%%)'::text, rb.transaction_number, trim_scale(b.pct)) AS description,
    (- round(((rb.base * b.pct) / (100)::numeric), 2)) AS amount,
    'refunds'::text AS ref_table,
    rb.id AS ref_id,
    rb.refunded_at AS sort_at
   FROM (refund_base rb
     CROSS JOIN buckets b)
UNION ALL
 SELECT 'hpp'::text AS bucket,
    sm.movement_date AS entry_date,
    'bahan_baku'::text AS entry_type,
    (format('Stok masuk %s'::text, rm.name) || COALESCE((' — '::text || sm.notes), ''::text)) AS description,
    (- sm.total_price) AS amount,
    'stock_movements'::text AS ref_table,
    sm.id AS ref_id,
    sm.created_at AS sort_at
   FROM (stock_movements sm
     JOIN raw_materials rm ON ((rm.id = sm.raw_material_id)))
  WHERE ((sm.movement_type = 'stok_masuk'::text) AND (COALESCE(sm.total_price, (0)::numeric) > (0)::numeric))
UNION ALL
 SELECT 'fixed_cost'::text AS bucket,
    k.request_date AS entry_date,
    'kasbon'::text AS entry_type,
    (('Kasbon '::text || e.full_name) || COALESCE((' — '::text || k.notes), ''::text)) AS description,
    (- k.amount) AS amount,
    'kasbon'::text AS ref_table,
    k.id AS ref_id,
    k.created_at AS sort_at
   FROM (kasbon k
     JOIN employees e ON ((e.id = k.employee_id)))
UNION ALL
 SELECT 'fixed_cost'::text AS bucket,
    ((k.settled_cash_at AT TIME ZONE 'Asia/Jakarta'::text))::date AS entry_date,
    'pelunasan_kasbon'::text AS entry_type,
    ('Pelunasan kasbon tunai '::text || e.full_name) AS description,
    k.amount,
    'kasbon'::text AS ref_table,
    k.id AS ref_id,
    k.settled_cash_at AS sort_at
   FROM (kasbon k
     JOIN employees e ON ((e.id = k.employee_id)))
  WHERE (k.settled_cash_at IS NOT NULL)
UNION ALL
 SELECT 'fixed_cost'::text AS bucket,
    fe.expense_date AS entry_date,
        CASE fe.expense_type
            WHEN 'gaji'::text THEN 'gaji'::text
            ELSE 'pengeluaran_lain'::text
        END AS entry_type,
    (
        CASE
            WHEN (fe.expense_type = 'gaji'::text) THEN (((fe.name || ' ('::text) || to_char((fe.salary_month)::timestamp with time zone, 'MM/YYYY'::text)) || ')'::text)
            ELSE fe.name
        END || COALESCE((' — '::text || fe.notes), ''::text)) AS description,
    (- fe.amount) AS amount,
    'finance_expenses'::text AS ref_table,
    fe.id AS ref_id,
    fe.created_at AS sort_at
   FROM finance_expenses fe
UNION ALL
 SELECT 'fixed_cost'::text AS bucket,
    ((te.created_at AT TIME ZONE 'Asia/Jakarta'::text))::date AS entry_date,
    'try_error'::text AS entry_type,
    ('Try & Error '::text ||
        CASE te.tne_type
            WHEN 'resep_produk'::text THEN COALESCE(( SELECT products.name
               FROM products
              WHERE (products.id = te.product_id)), 'produk'::text)
            WHEN 'resep_racikan'::text THEN COALESCE(( SELECT racikan.name
               FROM racikan
              WHERE (racikan.id = te.racikan_id)), 'racikan'::text)
            ELSE 'racikan baru'::text
        END) AS description,
    (- te.total_cost) AS amount,
    'try_error_records'::text AS ref_table,
    te.id AS ref_id,
    te.created_at AS sort_at
   FROM try_error_records te
UNION ALL
 SELECT 'net_profit'::text AS bucket,
    a.purchase_date AS entry_date,
    'pembelian_aset'::text AS entry_type,
    format('Beli %s × %s'::text, a.name, a.quantity) AS description,
    (- (a.purchase_price * (a.quantity)::numeric)) AS amount,
    'assets'::text AS ref_table,
    a.id AS ref_id,
    a.created_at AS sort_at
   FROM assets a;

-- Saldo online: Midtrans menerima total dibayar (termasuk ongkir & biaya layanan)
create or replace view public.online_balance_overview
with (security_invoker = true)
as
SELECT t.id,
    t.transaction_number,
    t.transaction_date,
    t.customer_name,
    (((t.total_amount + t.delivery_fee) + t.service_fee))::numeric(14,2) AS gross_amount,
    t.gateway_mdr,
    t.gateway_tax,
    ((((t.total_amount + t.delivery_fee) + t.service_fee) - t.gateway_mdr) - t.gateway_tax) AS net_amount,
    t.settled_at,
    x.available_date,
    t.disbursement_id,
    d.disbursed_date,
        CASE
            WHEN (t.status = 'refund_penuh'::text) THEN 'direfund'::text
            WHEN (t.disbursement_id IS NOT NULL) THEN 'dicairkan'::text
            WHEN (jakarta_today() >= x.available_date) THEN 'tersedia'::text
            ELSE 'tertahan'::text
        END AS balance_status
   FROM ((transactions t
     CROSS JOIN LATERAL ( SELECT add_business_days(((t.settled_at AT TIME ZONE 'Asia/Jakarta'::text))::date, ( SELECT finance_settings.settlement_business_days
                   FROM finance_settings)) AS available_date) x)
     LEFT JOIN online_disbursements d ON ((d.id = t.disbursement_id)))
  WHERE ((t.order_type = 'online'::text) AND (t.payment_method = 'qris'::text) AND (t.settled_at IS NOT NULL) AND (t.status <> 'dibatalkan'::text));


-- ------------------------------------------------------------
-- Baris laporan per transaksi (semua kolom turunan sudah dihitung)
-- ------------------------------------------------------------
create or replace view public.sales_report_rows
with (security_invoker = true)
as
select
  t.id,
  t.transaction_number,
  t.transaction_date as order_time,
  -- Waktu bayar: online = saat settlement Midtrans, offline = saat transaksi
  case when t.order_type = 'online' then t.settled_at else t.transaction_date end as pay_time,
  case when t.order_type = 'online' then 'online' else 'offline' end as channel,
  t.order_type,
  t.payment_method,
  t.status,
  t.customer_id,
  t.customer_name,
  t.subtotal,
  t.discount_amount,
  t.total_amount,
  t.delivery_fee,
  t.service_fee,
  t.online_price_adjustment,
  t.total_amount + t.delivery_fee + t.service_fee as total_paid,
  coalesce(rf.refund_amount, 0) as refund_amount,
  t.gateway_mdr,
  t.gateway_tax,
  coalesce(it.products, 0) as products,
  e.full_name as cashier_name,
  d.full_name as driver_name,
  t.delivery_distance_km,
  t.delivery_address,
  ob.balance_status,
  ob.available_date,
  ob.disbursed_date
from public.transactions t
left join lateral (select sum(r.refund_amount) as refund_amount from public.refunds r where r.transaction_id = t.id) rf on true
left join lateral (select sum(i.quantity) as products from public.transaction_items i where i.transaction_id = t.id) it on true
left join public.employees e on e.id = t.employee_id
left join public.employees d on d.id = t.driver_id
left join public.online_balance_overview ob on ob.id = t.id
where t.status <> 'dibatalkan';

-- Filter bersama laporan penjualan
create or replace function public.sales_report_filtered(
  p_start timestamptz,
  p_end timestamptz,
  p_time_basis text default 'order',
  p_channel text default null,
  p_order_type text default null,
  p_search text default null,
  p_balance_status text default null
)
returns setof public.sales_report_rows
language sql
stable
set search_path = public
as $$
  select *
  from sales_report_rows s
  where (case when p_time_basis = 'pay' then s.pay_time else s.order_time end) >= p_start
    and (case when p_time_basis = 'pay' then s.pay_time else s.order_time end) < p_end
    and (p_channel is null or s.channel = p_channel)
    and (p_order_type is null or s.order_type = p_order_type)
    and (p_balance_status is null or s.balance_status = p_balance_status)
    and (coalesce(trim(p_search), '') = ''
         or s.transaction_number ilike '%' || trim(p_search) || '%'
         or s.customer_name ilike '%' || trim(p_search) || '%'
         or s.cashier_name ilike '%' || trim(p_search) || '%');
$$;

-- Ringkasan (Ringkasan Penjualan, kartu Detail Penjualan, Laporan Penjualan Online)
-- Alur: Pendapatan Total → − Biaya Potongan → Total Penjualan → − Refund → Penjualan Bersih
--       → − Biaya Gateway (porsi produk) → Laba Kotor
create or replace function public.report_sales_summary(
  p_start timestamptz,
  p_end timestamptz,
  p_time_basis text default 'order',
  p_channel text default null,
  p_order_type text default null,
  p_search text default null,
  p_balance_status text default null
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

  select jsonb_build_object(
    'transactions', count(*),
    'transactions_offline', count(*) filter (where channel = 'offline'),
    'transactions_online', count(*) filter (where channel = 'online'),
    'products', coalesce(sum(products), 0),
    'gross_revenue', coalesce(sum(subtotal), 0),
    'discount', coalesce(sum(discount_amount), 0),
    'reward_redeem', 0,
    'total_sales', coalesce(sum(total_amount), 0),
    'refund', coalesce(sum(refund_amount), 0),
    'net_sales', coalesce(sum(total_amount - refund_amount), 0),
    'gateway_fee_total', coalesce(sum(gateway_mdr + gateway_tax), 0),
    'gateway_fee_products', coalesce(sum(
      (gateway_mdr + gateway_tax) * total_amount / nullif(total_paid, 0)), 0),
    'gross_profit', coalesce(sum(total_amount - refund_amount
      - coalesce((gateway_mdr + gateway_tax) * total_amount / nullif(total_paid, 0), 0)), 0),
    'delivery_fee', coalesce(sum(delivery_fee), 0),
    'service_fee', coalesce(sum(service_fee), 0),
    'price_adjustment', coalesce(sum(online_price_adjustment), 0),
    'total_paid', coalesce(sum(total_paid), 0),
    -- Uang sudah diterima toko: offline + online yang sudah dicairkan; sisanya masih di Midtrans
    'received', coalesce(sum(total_paid) filter (where channel = 'offline' or balance_status = 'dicairkan'), 0),
    'not_received', coalesce(sum(total_paid) filter (where channel = 'online' and balance_status in ('tertahan', 'tersedia')), 0)
  ) into v
  from sales_report_filtered(p_start, p_end, p_time_basis, p_channel, p_order_type, p_search, p_balance_status);

  return v;
end;
$$;

-- Detail Per Periode: dikelompokkan hari / minggu (Senin) / bulan
create or replace function public.report_sales_by_period(
  p_start timestamptz,
  p_end timestamptz,
  p_group text,
  p_channel text default null,
  p_order_type text default null
)
returns table (period_start date, sales numeric, refund numeric, gross_profit numeric,
               products numeric, transactions bigint)
language plpgsql
stable
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh melihat laporan.' using errcode = '42501';
  end if;
  return query
  select
    date_trunc(case p_group when 'week' then 'week' when 'month' then 'month' else 'day' end,
               (s.order_time at time zone 'Asia/Jakarta'))::date,
    sum(s.total_amount),
    sum(s.refund_amount),
    sum(s.total_amount - s.refund_amount
        - coalesce((s.gateway_mdr + s.gateway_tax) * s.total_amount / nullif(s.total_paid, 0), 0)),
    sum(s.products),
    count(*)
  from sales_report_filtered(p_start, p_end, 'order', p_channel, p_order_type, null, null) s
  group by 1
  order by 1;
end;
$$;

-- Laporan Jenis Bayar: total per metode + deret per hari/bulan untuk grafik proporsi
create or replace function public.report_payment_methods(
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
  with f as (
    select * from sales_report_filtered(p_start, p_end, 'order', p_channel, null, null, null)
  )
  select jsonb_build_object(
    'methods', coalesce((
      select jsonb_agg(x order by x.amount desc) from (
        select payment_method as method, count(*) as transactions, sum(total_paid) as amount
        from f group by payment_method
      ) x), '[]'),
    'series', coalesce((
      select jsonb_agg(x order by x.period) from (
        select date_trunc(case when p_group = 'month' then 'month' else 'day' end,
                          (order_time at time zone 'Asia/Jakarta'))::date as period,
               payment_method as method, count(*) as transactions, sum(total_paid) as amount
        from f group by 1, 2
      ) x), '[]')
  ) into v;
  return v;
end;
$$;

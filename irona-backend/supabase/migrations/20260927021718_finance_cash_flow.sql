-- ============================================================
-- KEUANGAN > CASH FLOW
--
-- Cash Flow = pembukuan/tracking saja (bukan uang sungguhan yang dipindah). Saldo boleh minus.
--
-- Masuk: tiap transaksi (selain dibatalkan) dibagi dari Penjualan Bersih:
--   HPP 40% · Fixed Cost 30% · Net Profit 30%
--   Penjualan Bersih = total transaksi (sudah dipotong diskon)
--                      − MDR gateway (khusus pesanan online via Midtrans: 0,7% + PPN 11% dari MDR)
-- Refund: membalik alokasi 40/30/30 secara proporsional.
--
-- HPP: 80% = batas belanja bahan baku per bulan, 20% = Saldo Mengendap (operasional Irona).
--      Sisa batas belanja yang tidak terpakai saat bulan berganti → masuk Saldo Mengendap.
--      Keluar: Stok Masuk (bahan baku). Produksi Racikan tidak dicatat (hanya konversi stok).
-- Fixed Cost keluar: Kasbon (saat diberikan), Pembayaran Gaji (gaji bersih), Pengeluaran Lain,
--      Try & Error. Pelunasan kasbon tunai → masuk kembali.
-- Net Profit per bulan: 50% BEP · 25% Owner · 25% Manager.
--      Pembelian Aset memotong BEP; kekurangan BEP ditanggung Owner, sisa BEP masuk ke Owner.
-- Saldo Online (Midtrans): Tertahan → Tersedia (settlement + 3 hari kerja) → Dicairkan (dicatat admin).
-- ============================================================

-- Tabel lama yang belum pernah dipakai (kosong) — diganti view cash_flow_entries
drop table if exists public.finance_ledger;


-- ------------------------------------------------------------
-- 1. Pengaturan persentase (angka tetap dulu; nanti bisa diubah di Pengaturan)
-- ------------------------------------------------------------
create table public.finance_settings (
  id boolean primary key default true check (id),
  hpp_pct numeric(5,2) not null default 40,
  fixed_cost_pct numeric(5,2) not null default 30,
  net_profit_pct numeric(5,2) not null default 30,
  hpp_budget_pct numeric(5,2) not null default 80,     -- sisanya = Saldo Mengendap
  bep_pct numeric(5,2) not null default 50,
  owner_pct numeric(5,2) not null default 25,
  manager_pct numeric(5,2) not null default 25,
  settlement_business_days integer not null default 3,
  updated_at timestamptz not null default now(),
  constraint finance_split_total check (hpp_pct + fixed_cost_pct + net_profit_pct = 100),
  constraint finance_profit_split_total check (bep_pct + owner_pct + manager_pct = 100)
);
insert into public.finance_settings default values;

alter table public.finance_settings enable row level security;
create policy "finance_settings_admin_select" on public.finance_settings for select to authenticated
  using (is_admin());


-- ------------------------------------------------------------
-- 2. Potongan gateway per transaksi (snapshot saat transaksi dibuat)
-- ------------------------------------------------------------
alter table public.transactions
  add column gateway_mdr numeric(14,2) not null default 0,
  add column gateway_tax numeric(14,2) not null default 0,
  add column settled_at timestamptz;

comment on column public.transactions.gateway_mdr is 'MDR payment gateway (khusus pesanan online QRIS via Midtrans)';
comment on column public.transactions.gateway_tax is 'PPN atas MDR';
comment on column public.transactions.settled_at is 'Waktu status settlement dari Midtrans (pesanan online)';

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
    new.gateway_mdr := round(new.total_amount * coalesce(s.mdr_percent, 0) / 100, 2);
    new.gateway_tax := round(new.gateway_mdr * coalesce(s.ppn_percent, 0) / 100, 2);
  else
    new.gateway_mdr := 0;
    new.gateway_tax := 0;
  end if;
  return new;
end;
$$;

create trigger transactions_gateway_fee
  before insert or update of total_amount, order_type, payment_method on public.transactions
  for each row execute function public.set_transaction_gateway_fee();

-- Transaksi yang sudah ada
update public.transactions set total_amount = total_amount where order_type = 'online';
update public.transactions set settled_at = transaction_date
where order_type = 'online' and payment_method = 'qris' and settled_at is null and status <> 'dibatalkan';


-- ------------------------------------------------------------
-- 3. Pengeluaran manual: Pembayaran Gaji & Pengeluaran Lain (bucket Fixed Cost)
--    Bisa diubah/dihapus selama masih di bulan yang sama dengan tanggalnya.
-- ------------------------------------------------------------
create table public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_type text not null check (expense_type in ('gaji', 'lain')),
  name text not null,
  employee_id uuid references public.employees(id),
  salary_month date,                         -- tanggal 1 bulan gaji
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null,
  notes text,
  created_by uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_expense_salary_check check (
    (expense_type = 'gaji' and employee_id is not null and salary_month is not null)
    or (expense_type = 'lain' and employee_id is null and salary_month is null)
  )
);
create unique index finance_expenses_salary_unique
  on public.finance_expenses (employee_id, salary_month) where expense_type = 'gaji';

alter table public.finance_expenses enable row level security;
create policy "finance_expenses_admin_all" on public.finance_expenses for all to authenticated
  using (is_admin()) with check (is_admin());

create or replace function public.is_current_month(p_date date)
returns boolean
language sql
stable
set search_path = public
as $$
  select date_trunc('month', p_date) = date_trunc('month', jakarta_today());
$$;

-- p_data: {expense_type, name, employee_id, salary_month, amount, expense_date, notes}
create or replace function public.save_finance_expense(p_id uuid, p_data jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_old finance_expenses%rowtype;
  v_type text := p_data ->> 'expense_type';
  v_amount numeric := nullif(p_data ->> 'amount', '')::numeric;
  v_date date := nullif(p_data ->> 'expense_date', '')::date;
  v_employee uuid := nullif(p_data ->> 'employee_id', '')::uuid;
  v_month date := date_trunc('month', nullif(p_data ->> 'salary_month', '')::date)::date;
  v_name text := nullif(trim(p_data ->> 'name'), '');
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mencatat pengeluaran.' using errcode = '42501';
  end if;
  if v_type not in ('gaji', 'lain') then raise exception 'Jenis pengeluaran tidak valid.'; end if;
  if coalesce(v_amount, 0) <= 0 then raise exception 'Nominal harus lebih dari 0.'; end if;
  if v_date is null then raise exception 'Tanggal wajib diisi.'; end if;
  if v_date > jakarta_today() then raise exception 'Tanggal tidak boleh di masa depan.'; end if;

  if v_type = 'gaji' then
    if v_employee is null then raise exception 'Pilih karyawan.'; end if;
    if v_month is null then raise exception 'Pilih bulan gaji.'; end if;
    select 'Gaji ' || full_name into v_name from employees where id = v_employee;
    if v_name is null then raise exception 'Karyawan tidak ditemukan.'; end if;
    if exists (select 1 from finance_expenses
               where expense_type = 'gaji' and employee_id = v_employee and salary_month = v_month
                 and id is distinct from p_id) then
      raise exception 'Gaji % bulan % sudah dicatat.', substr(v_name, 6), to_char(v_month, 'MM/YYYY');
    end if;
  else
    if v_name is null then raise exception 'Nama pengeluaran wajib diisi.'; end if;
    v_employee := null;
    v_month := null;
  end if;

  if p_id is null then
    insert into finance_expenses (expense_type, name, employee_id, salary_month, amount, expense_date, notes, created_by)
    values (v_type, v_name, v_employee, v_month, v_amount, v_date, nullif(trim(p_data ->> 'notes'), ''), auth.uid())
    returning id into v_id;
  else
    select * into v_old from finance_expenses where id = p_id for update;
    if v_old.id is null then raise exception 'Pengeluaran tidak ditemukan.'; end if;
    if not is_current_month(v_old.expense_date) or not is_current_month(v_date) then
      raise exception 'Pengeluaran hanya bisa diubah selama masih di bulan yang sama.';
    end if;
    if v_old.expense_type <> v_type then raise exception 'Jenis pengeluaran tidak bisa diubah.'; end if;
    update finance_expenses set
      name = v_name, employee_id = v_employee, salary_month = v_month, amount = v_amount,
      expense_date = v_date, notes = nullif(trim(p_data ->> 'notes'), ''), updated_at = now()
    where id = p_id
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.delete_finance_expense(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_date date;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menghapus pengeluaran.' using errcode = '42501';
  end if;
  select expense_date into v_date from finance_expenses where id = p_id;
  if v_date is null then raise exception 'Pengeluaran tidak ditemukan.'; end if;
  if not is_current_month(v_date) then
    raise exception 'Pengeluaran bulan lalu sudah terkunci dan tidak bisa dihapus.';
  end if;
  delete from finance_expenses where id = p_id;
end;
$$;


-- ------------------------------------------------------------
-- 4. Aset: Ubah/Hapus hanya di bulan kalender yang sama dengan Tanggal Beli
-- ------------------------------------------------------------
create or replace function public.guard_asset_month_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not is_current_month(old.purchase_date) then
    raise exception 'Aset yang dibeli di bulan lalu sudah terkunci. Gunakan Ubah Status untuk koreksi.';
  end if;
  if tg_op = 'UPDATE' and not is_current_month(new.purchase_date) then
    raise exception 'Tanggal beli hanya bisa diubah ke tanggal di bulan ini.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Perbaikan: riwayat aset sebelumnya hanya punya policy baca, sehingga simpan/ubah status aset gagal
create policy "asset_history_admin_insert" on public.asset_history for insert to authenticated
  with check (is_admin());

-- Ubah Status tetap selalu boleh: trigger hanya untuk perubahan data aset / hapus
create trigger assets_month_lock_update
  before update of name, purchase_price, quantity, purchase_date, notes on public.assets
  for each row execute function public.guard_asset_month_lock();
create trigger assets_month_lock_delete
  before delete on public.assets
  for each row execute function public.guard_asset_month_lock();


-- ------------------------------------------------------------
-- 5. Buku besar gabungan (semua bucket)
--    amount bertanda: + masuk, − keluar
-- ------------------------------------------------------------
create or replace view public.cash_flow_entries
with (security_invoker = true)
as
with fs as (select * from public.finance_settings),
sales as (
  select (t.transaction_date at time zone 'Asia/Jakarta')::date as d,
         count(*) as trx_count,
         sum(t.total_amount - t.gateway_mdr - t.gateway_tax) as net
  from public.transactions t
  where t.status <> 'dibatalkan'
  group by 1
),
refund_base as (
  select r.id, r.refunded_at, t.transaction_number,
         r.refund_amount * (t.total_amount - t.gateway_mdr - t.gateway_tax) / nullif(t.total_amount, 0) as base
  from public.refunds r
  join public.transactions t on t.id = r.transaction_id
),
buckets as (
  select 'hpp'::text as bucket, fs.hpp_pct as pct from fs
  union all select 'fixed_cost', fs.fixed_cost_pct from fs
  union all select 'net_profit', fs.net_profit_pct from fs
)
-- Alokasi otomatis (per hari)
select b.bucket, s.d as entry_date, 'alokasi'::text as entry_type,
       format('Alokasi %s%% dari %s transaksi', trim_scale(b.pct), s.trx_count) as description,
       round(s.net * b.pct / 100, 2) as amount,
       'sales_day'::text as ref_table, null::uuid as ref_id,
       (s.d + time '23:59:59') at time zone 'Asia/Jakarta' as sort_at
from sales s cross join buckets b

union all
-- Reversal refund (proporsional per bucket)
select b.bucket, (rb.refunded_at at time zone 'Asia/Jakarta')::date, 'reversal_refund',
       format('Reversal refund %s (%s%%)', rb.transaction_number, trim_scale(b.pct)),
       -round(rb.base * b.pct / 100, 2), 'refunds', rb.id, rb.refunded_at
from refund_base rb cross join buckets b

union all
-- HPP: Bahan baku (Stok Masuk)
select 'hpp', sm.movement_date, 'bahan_baku',
       format('Stok masuk %s', rm.name) || coalesce(' — ' || sm.notes, ''),
       -sm.total_price, 'stock_movements', sm.id, sm.created_at
from public.stock_movements sm
join public.raw_materials rm on rm.id = sm.raw_material_id
where sm.movement_type = 'stok_masuk' and coalesce(sm.total_price, 0) > 0

union all
-- Fixed Cost: kasbon diberikan
select 'fixed_cost', k.request_date, 'kasbon',
       'Kasbon ' || e.full_name || coalesce(' — ' || k.notes, ''),
       -k.amount, 'kasbon', k.id, k.created_at
from public.kasbon k
join public.employees e on e.id = k.employee_id

union all
-- Fixed Cost: pelunasan kasbon tunai (uang kembali)
select 'fixed_cost', (k.settled_cash_at at time zone 'Asia/Jakarta')::date, 'pelunasan_kasbon',
       'Pelunasan kasbon tunai ' || e.full_name,
       k.amount, 'kasbon', k.id, k.settled_cash_at
from public.kasbon k
join public.employees e on e.id = k.employee_id
where k.settled_cash_at is not null

union all
-- Fixed Cost: gaji & pengeluaran lain
select 'fixed_cost', fe.expense_date, case fe.expense_type when 'gaji' then 'gaji' else 'pengeluaran_lain' end,
       case when fe.expense_type = 'gaji' then fe.name || ' (' || to_char(fe.salary_month, 'MM/YYYY') || ')'
            else fe.name end || coalesce(' — ' || fe.notes, ''),
       -fe.amount, 'finance_expenses', fe.id, fe.created_at
from public.finance_expenses fe

union all
-- Fixed Cost: Try & Error
select 'fixed_cost', (te.created_at at time zone 'Asia/Jakarta')::date, 'try_error',
       'Try & Error ' || case te.tne_type
         when 'resep_produk' then coalesce((select name from public.products where id = te.product_id), 'produk')
         when 'resep_racikan' then coalesce((select name from public.racikan where id = te.racikan_id), 'racikan')
         else 'racikan baru' end,
       -te.total_cost, 'try_error_records', te.id, te.created_at
from public.try_error_records te

union all
-- Net Profit: pembelian aset (memotong BEP)
select 'net_profit', a.purchase_date, 'pembelian_aset',
       format('Beli %s × %s', a.name, a.quantity),
       -(a.purchase_price * a.quantity), 'assets', a.id, a.created_at
from public.assets a;


-- Ringkasan saldo per bucket untuk periode
create or replace function public.cash_flow_summary(p_start date, p_end date)
returns table (bucket text, opening numeric, total_in numeric, total_out numeric, closing numeric, current_balance numeric)
language sql
stable
set search_path = public
as $$
  select b.bucket,
         coalesce(sum(e.amount) filter (where e.entry_date < p_start), 0),
         coalesce(sum(e.amount) filter (where e.entry_date between p_start and p_end and e.amount > 0), 0),
         coalesce(-sum(e.amount) filter (where e.entry_date between p_start and p_end and e.amount < 0), 0),
         coalesce(sum(e.amount) filter (where e.entry_date <= p_end), 0),
         coalesce(sum(e.amount), 0)
  from (values ('hpp'), ('fixed_cost'), ('net_profit')) b(bucket)
  left join cash_flow_entries e on e.bucket = b.bucket
  group by b.bucket;
$$;


-- ------------------------------------------------------------
-- 6. HPP per bulan: batas belanja 80% & Saldo Mengendap 20%
-- ------------------------------------------------------------
create or replace function public.hpp_monthly()
returns table (month date, allocation numeric, budget numeric, spent numeric, remaining numeric,
               reserve_share numeric, moved_to_reserve numeric, reserve_total numeric, is_closed boolean)
language sql
stable
set search_path = public
as $$
  with fs as (select hpp_budget_pct from finance_settings),
  bounds as (
    select coalesce(date_trunc('month', min(entry_date)), date_trunc('month', jakarta_today()))::date as first_month
    from cash_flow_entries where bucket = 'hpp'
  ),
  months as (
    select generate_series(first_month, date_trunc('month', jakarta_today())::date, interval '1 month')::date as m
    from bounds
  ),
  agg as (
    select m.m,
           coalesce(sum(e.amount) filter (where e.entry_type in ('alokasi', 'reversal_refund')), 0) as alloc,
           coalesce(-sum(e.amount) filter (where e.entry_type = 'bahan_baku'), 0) as spent
    from months m
    left join cash_flow_entries e
      on e.bucket = 'hpp' and date_trunc('month', e.entry_date) = m.m
    group by m.m
  ),
  calc as (
    select a.m, a.alloc,
           round(a.alloc * fs.hpp_budget_pct / 100, 2) as budget,
           a.spent,
           a.m < date_trunc('month', jakarta_today())::date as closed
    from agg a cross join fs
  )
  select m, alloc, budget, spent, budget - spent,
         alloc - budget,
         case when closed and budget - spent > 0 then budget - spent else 0 end,
         sum((alloc - budget) + case when closed and budget - spent > 0 then budget - spent else 0 end)
           over (order by m),
         closed
  from calc
  order by m;
$$;


-- ------------------------------------------------------------
-- 7. Net Profit per bulan: BEP 50% / Owner 25% / Manager 25%
-- ------------------------------------------------------------
create or replace function public.net_profit_monthly()
returns table (month date, net_profit numeric, bep_share numeric, owner_share numeric, manager_share numeric,
               asset_spent numeric, bep_balance numeric, owner_balance numeric, manager_balance numeric)
language sql
stable
set search_path = public
as $$
  with fs as (select bep_pct, owner_pct, manager_pct from finance_settings),
  bounds as (
    select coalesce(date_trunc('month', min(entry_date)), date_trunc('month', jakarta_today()))::date as first_month
    from cash_flow_entries where bucket = 'net_profit'
  ),
  months as (
    select generate_series(first_month, date_trunc('month', jakarta_today())::date, interval '1 month')::date as m
    from bounds
  ),
  agg as (
    select m.m,
           coalesce(sum(e.amount) filter (where e.entry_type in ('alokasi', 'reversal_refund')), 0) as net,
           coalesce(-sum(e.amount) filter (where e.entry_type = 'pembelian_aset'), 0) as assets
    from months m
    left join cash_flow_entries e
      on e.bucket = 'net_profit' and date_trunc('month', e.entry_date) = m.m
    group by m.m
  ),
  calc as (
    select a.m, a.net, a.assets,
           round(a.net * fs.bep_pct / 100, 2) as bep,
           round(a.net * fs.manager_pct / 100, 2) as manager
    from agg a cross join fs
  )
  select m, net,
         bep,
         net - bep - manager,          -- owner (sisa pembulatan ikut owner)
         manager,
         assets,
         bep - assets,
         (net - bep - manager) + (bep - assets),
         manager
  from calc
  order by m;
$$;


-- ------------------------------------------------------------
-- 8. Saldo Online (Midtrans)
-- ------------------------------------------------------------
create table public.bank_holidays (
  holiday_date date primary key,
  name text not null
);
alter table public.bank_holidays enable row level security;
create policy "bank_holidays_admin_all" on public.bank_holidays for all to authenticated
  using (is_admin()) with check (is_admin());

-- Tambah n hari kerja (lewati Sabtu, Minggu, dan tanggal libur)
create or replace function public.add_business_days(p_from date, p_days integer)
returns date
language plpgsql
stable
set search_path = public
as $$
declare
  d date := p_from;
  n integer := 0;
begin
  while n < p_days loop
    d := d + 1;
    if extract(isodow from d) < 6 and not exists (select 1 from bank_holidays where holiday_date = d) then
      n := n + 1;
    end if;
  end loop;
  return d;
end;
$$;

create table public.online_disbursements (
  id uuid primary key default gen_random_uuid(),
  disbursed_date date not null,
  transaction_count integer not null,
  gross_amount numeric(14,2) not null,
  fee_amount numeric(14,2) not null,
  net_amount numeric(14,2) not null,
  notes text,
  created_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);
alter table public.online_disbursements enable row level security;
create policy "online_disbursements_admin_all" on public.online_disbursements for all to authenticated
  using (is_admin()) with check (is_admin());

alter table public.transactions
  add column disbursement_id uuid references public.online_disbursements(id);

create or replace view public.online_balance_overview
with (security_invoker = true)
as
select
  t.id,
  t.transaction_number,
  t.transaction_date,
  t.customer_name,
  t.total_amount as gross_amount,
  t.gateway_mdr,
  t.gateway_tax,
  t.total_amount - t.gateway_mdr - t.gateway_tax as net_amount,
  t.settled_at,
  x.available_date,
  t.disbursement_id,
  d.disbursed_date,
  case
    when t.status = 'refund_penuh' then 'direfund'
    when t.disbursement_id is not null then 'dicairkan'
    when jakarta_today() >= x.available_date then 'tersedia'
    else 'tertahan'
  end as balance_status
from public.transactions t
cross join lateral (
  select public.add_business_days((t.settled_at at time zone 'Asia/Jakarta')::date,
                                  (select settlement_business_days from public.finance_settings)) as available_date
) x
left join public.online_disbursements d on d.id = t.disbursement_id
where t.order_type = 'online' and t.payment_method = 'qris'
  and t.settled_at is not null and t.status <> 'dibatalkan';

-- Catat pencairan: semua transaksi yang sudah Tersedia per tanggal pencairan ditandai Dicairkan
create or replace function public.record_online_disbursement(p_date date, p_notes text default null)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer;
  v_gross numeric;
  v_fee numeric;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mencatat pencairan.' using errcode = '42501';
  end if;
  if p_date is null then raise exception 'Tanggal pencairan wajib diisi.'; end if;
  if p_date > jakarta_today() then raise exception 'Tanggal pencairan tidak boleh di masa depan.'; end if;

  select count(*), coalesce(sum(gross_amount), 0), coalesce(sum(gateway_mdr + gateway_tax), 0)
    into v_count, v_gross, v_fee
  from online_balance_overview
  where balance_status in ('tersedia', 'tertahan') and available_date <= p_date;

  if v_count = 0 then
    raise exception 'Tidak ada saldo yang tersedia untuk dicairkan per tanggal tersebut.';
  end if;

  insert into online_disbursements (disbursed_date, transaction_count, gross_amount, fee_amount, net_amount, notes, created_by)
  values (p_date, v_count, v_gross, v_fee, v_gross - v_fee, nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;

  update transactions t set disbursement_id = v_id
  from online_balance_overview o
  where o.id = t.id and o.balance_status in ('tersedia', 'tertahan') and o.available_date <= p_date;

  return v_id;
end;
$$;

create or replace function public.cancel_online_disbursement(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh membatalkan pencairan.' using errcode = '42501';
  end if;
  update transactions set disbursement_id = null where disbursement_id = p_id;
  delete from online_disbursements where id = p_id;
end;
$$;

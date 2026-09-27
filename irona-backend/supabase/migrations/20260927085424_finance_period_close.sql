-- ============================================================
-- KEUANGAN: TUTUP BUKU BULANAN (OTOMATIS)
--
-- - Begitu ganti bulan, bulan lalu otomatis tutup buku.
-- - Data bulan yang sudah tutup buku TIDAK dihapus — hanya read-only:
--   tidak bisa ditambah / diubah / dihapus (dikunci di database).
-- - Koreksi: Admin/Owner "Buka Kembali" bulan tersebut (wajib alasan), lalu "Tutup Kembali".
--   Semua buka/tutup tercatat di riwayat.
-- - Yang dikunci per tanggal: transaksi penjualan, refund, pergerakan stok, try & error,
--   kasbon, pembayaran gaji & pengeluaran lain, aset (Ubah Status tetap boleh), pencairan online.
-- - Script dev-data boleh melewati kunci dengan: set local irona.bypass_period_lock = 'on';
-- ============================================================

-- Bulan yang sedang dibuka kembali (bulan lalu yang tidak ada di sini = tertutup)
create table public.finance_open_periods (
  month date primary key check (month = date_trunc('month', month)::date),
  reason text not null,
  opened_by uuid references public.employees(id),
  opened_at timestamptz not null default now()
);

create table public.finance_period_log (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  action text not null check (action in ('buka', 'tutup')),
  reason text,
  changed_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);

alter table public.finance_open_periods enable row level security;
alter table public.finance_period_log enable row level security;
create policy "finance_open_periods_admin_all" on public.finance_open_periods for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "finance_period_log_admin_all" on public.finance_period_log for all to authenticated
  using (is_admin()) with check (is_admin());


create or replace function public.is_period_locked(p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_date is not null
     and date_trunc('month', p_date) < date_trunc('month', jakarta_today())
     and not exists (select 1 from finance_open_periods where month = date_trunc('month', p_date)::date);
$$;

create or replace function public.month_label_id(p_date date)
returns text
language sql
immutable
as $$
  select (array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus',
                'September','Oktober','November','Desember'])[extract(month from p_date)::int]
         || ' ' || extract(year from p_date)::int;
$$;

create or replace function public.assert_period_open(p_date date)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if coalesce(current_setting('irona.bypass_period_lock', true), '') = 'on' then
    return;
  end if;
  if is_period_locked(p_date) then
    raise exception 'Bulan % sudah tutup buku (hanya bisa dilihat). Buka kembali bulan tersebut di Keuangan › Cash Flow untuk koreksi.',
      month_label_id(p_date)
      using errcode = 'P0001';
  end if;
end;
$$;

-- Daftar bulan untuk UI: status tiap bulan dari data pertama s/d bulan ini
create or replace function public.finance_periods()
returns table (month date, status text, reason text, opened_by_name text, opened_at timestamptz)
language sql
stable
set search_path = public
as $$
  with bounds as (
    select least(
      coalesce((select min(transaction_date at time zone 'Asia/Jakarta')::date from transactions), jakarta_today()),
      coalesce((select min(entry_date) from cash_flow_entries), jakarta_today())
    ) as first_day
  )
  select m::date,
         case when m::date = date_trunc('month', jakarta_today())::date then 'berjalan'
              when o.month is not null then 'dibuka'
              else 'tertutup' end,
         o.reason, e.full_name, o.opened_at
  from bounds,
       generate_series(date_trunc('month', first_day), date_trunc('month', jakarta_today()), interval '1 month') m
  left join finance_open_periods o on o.month = m::date
  left join employees e on e.id = o.opened_by
  order by m desc;
$$;

create or replace function public.reopen_finance_period(p_month date, p_reason text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh membuka kembali tutup buku.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Alasan membuka kembali wajib diisi.';
  end if;
  if v_month >= date_trunc('month', jakarta_today())::date then
    raise exception 'Bulan berjalan belum tutup buku.';
  end if;
  if exists (select 1 from finance_open_periods where month = v_month) then
    raise exception 'Bulan % sudah dalam keadaan dibuka.', month_label_id(v_month);
  end if;
  insert into finance_open_periods (month, reason, opened_by) values (v_month, trim(p_reason), auth.uid());
  insert into finance_period_log (month, action, reason, changed_by) values (v_month, 'buka', trim(p_reason), auth.uid());
end;
$$;

create or replace function public.close_finance_period(p_month date)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menutup buku.' using errcode = '42501';
  end if;
  if not exists (select 1 from finance_open_periods where month = v_month) then
    raise exception 'Bulan % tidak sedang dibuka.', month_label_id(v_month);
  end if;
  delete from finance_open_periods where month = v_month;
  insert into finance_period_log (month, action, changed_by) values (v_month, 'tutup', auth.uid());
end;
$$;


-- ------------------------------------------------------------
-- Trigger kunci per tabel
-- ------------------------------------------------------------

-- Tabel dengan 1 kolom tanggal: argumen trigger = nama kolom, tipe = date / timestamptz
create or replace function public.guard_period_lock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  -- kolom timestamptz dibaca sebagai tanggal WIB
  expr text := case when tg_argv[1] = 'tz'
                    then format('(($1).%I at time zone ''Asia/Jakarta'')::date', tg_argv[0])
                    else format('(($1).%I)::date', tg_argv[0]) end;
  v_date date;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    execute 'select ' || expr using old into v_date;
    perform assert_period_open(v_date);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    execute 'select ' || expr using new into v_date;
    perform assert_period_open(v_date);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger refunds_period_lock before insert or update or delete on public.refunds
  for each row execute function public.guard_period_lock('refunded_at', 'tz');
create trigger stock_movements_period_lock before insert or update or delete on public.stock_movements
  for each row execute function public.guard_period_lock('movement_date', 'date');
create trigger try_error_records_period_lock before insert or update or delete on public.try_error_records
  for each row execute function public.guard_period_lock('created_at', 'tz');
create trigger finance_expenses_period_lock before insert or update or delete on public.finance_expenses
  for each row execute function public.guard_period_lock('expense_date', 'date');
create trigger online_disbursements_period_lock before insert or update or delete on public.online_disbursements
  for each row execute function public.guard_period_lock('disbursed_date', 'date');

-- Transaksi: yang dikunci hanya perubahan yang memengaruhi angka keuangan.
-- (Tandai refund / pencairan online / settlement tetap boleh — dicatat di tanggal kejadiannya.)
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
  elsif (old.transaction_date, old.total_amount, old.subtotal, old.discount_amount, old.order_type, old.payment_method)
        is distinct from
        (new.transaction_date, new.total_amount, new.subtotal, new.discount_amount, new.order_type, new.payment_method)
     or ((old.status = 'dibatalkan') is distinct from (new.status = 'dibatalkan')) then
    perform assert_period_open(v_old);
    perform assert_period_open(v_new);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger transactions_period_lock before insert or update or delete on public.transactions
  for each row execute function public.guard_transaction_period_lock();

-- Kasbon: data kasbon terkunci per tanggal pengajuan; pelunasan tunai dicatat di tanggal pelunasan
create or replace function public.guard_kasbon_period_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform assert_period_open(new.request_date);
  elsif tg_op = 'DELETE' then
    perform assert_period_open(old.request_date);
    perform assert_period_open((old.settled_cash_at at time zone 'Asia/Jakarta')::date);
  else
    if (old.employee_id, old.amount, old.request_date) is distinct from (new.employee_id, new.amount, new.request_date) then
      perform assert_period_open(old.request_date);
      perform assert_period_open(new.request_date);
    end if;
    if old.settled_cash_at is distinct from new.settled_cash_at then
      perform assert_period_open((old.settled_cash_at at time zone 'Asia/Jakarta')::date);
      perform assert_period_open((new.settled_cash_at at time zone 'Asia/Jakarta')::date);
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger kasbon_period_lock before insert or update or delete on public.kasbon
  for each row execute function public.guard_kasbon_period_lock();

-- Aset: kunci "bulan yang sama" diganti tutup buku (Ubah Status tetap selalu boleh)
drop trigger assets_month_lock_update on public.assets;
drop trigger assets_month_lock_delete on public.assets;
drop function public.guard_asset_month_lock();

create or replace function public.guard_asset_period_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform assert_period_open(old.purchase_date); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform assert_period_open(new.purchase_date); end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger assets_period_lock_insert before insert on public.assets
  for each row execute function public.guard_asset_period_lock();
create trigger assets_period_lock_update
  before update of name, purchase_price, quantity, purchase_date, notes on public.assets
  for each row execute function public.guard_asset_period_lock();
create trigger assets_period_lock_delete before delete on public.assets
  for each row execute function public.guard_asset_period_lock();

-- Pengeluaran manual: kunci 'bulan yang sama' diganti tutup buku (dijaga trigger finance_expenses_period_lock)
CREATE OR REPLACE FUNCTION public.save_finance_expense(p_id uuid, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    if v_old.expense_type <> v_type then raise exception 'Jenis pengeluaran tidak bisa diubah.'; end if;
    update finance_expenses set
      name = v_name, employee_id = v_employee, salary_month = v_month, amount = v_amount,
      expense_date = v_date, notes = nullif(trim(p_data ->> 'notes'), ''), updated_at = now()
    where id = p_id
    returning id into v_id;
  end if;
  return v_id;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.delete_finance_expense(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_date date;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menghapus pengeluaran.' using errcode = '42501';
  end if;
  select expense_date into v_date from finance_expenses where id = p_id;
  if v_date is null then raise exception 'Pengeluaran tidak ditemukan.'; end if;
  delete from finance_expenses where id = p_id;
end;
$function$

;

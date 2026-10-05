-- ============================================================
-- SESI KASIR + LAPORAN TOKO
--
-- - cashier_sessions: satu baris per login–logout kasir di Kasir App. Diisi lewat RPC
--   start_cashier_session / end_cashier_session (dipanggil Kasir App nanti; sekarang data dummy).
-- - transactions.cashier_session_id: sesi tempat transaksi dibuat (diisi Kasir App).
-- - Laporan Pendapatan Kasir: per sesi → transaksi, penerimaan tunai/non-tunai/online,
--   kas keluar (kasbon dibuat selama sesi, info saja), refund selama sesi.
-- - Laporan Jam Operasional: per hari → sesi 1 & 2, gap antar sesi, selisih vs jam buka/tutup
--   Offline (Jam Layanan).
-- ============================================================

create table public.cashier_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  login_at timestamptz not null default now(),
  logout_at timestamptz,
  created_at timestamptz not null default now(),
  check (logout_at is null or logout_at >= login_at)
);

create index cashier_sessions_login_at_idx on public.cashier_sessions (login_at);
-- Satu kasir hanya boleh punya satu sesi terbuka
create unique index cashier_sessions_one_open_idx
  on public.cashier_sessions (employee_id) where logout_at is null;

alter table public.cashier_sessions enable row level security;
create policy "cashier_sessions_select" on public.cashier_sessions
  for select to authenticated using (true);
create policy "cashier_sessions_admin_write" on public.cashier_sessions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.transactions
  add column cashier_session_id uuid references public.cashier_sessions(id);

create index transactions_cashier_session_idx on public.transactions (cashier_session_id);

-- Kasir App: buka sesi saat login (sesi lama yang lupa ditutup ditutup otomatis)
create or replace function public.start_cashier_session()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from employees where id = auth.uid() and is_active) then
    raise exception 'Akun tidak dikenali sebagai karyawan aktif.' using errcode = '42501';
  end if;
  update cashier_sessions set logout_at = now()
  where employee_id = auth.uid() and logout_at is null;
  insert into cashier_sessions (employee_id) values (auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

-- Kasir App: tutup sesi saat logout
create or replace function public.end_cashier_session()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update cashier_sessions set logout_at = now()
  where employee_id = auth.uid() and logout_at is null;
end;
$$;

revoke execute on function public.start_cashier_session() from public, anon;
revoke execute on function public.end_cashier_session() from public, anon;

-- ------------------------------------------------------------
-- Laporan Pendapatan Kasir (per sesi)
-- ------------------------------------------------------------
create or replace function public.report_cashier_income(p_start timestamptz, p_end timestamptz)
returns table (
  session_id uuid,
  employee_id uuid,
  cashier_name text,
  login_at timestamptz,
  logout_at timestamptz,
  transactions bigint,
  cash_amount numeric,
  non_cash_amount numeric,
  online_amount numeric,
  total_amount numeric,
  cash_out_count bigint,
  cash_out_amount numeric,
  refund_count bigint,
  refund_amount numeric
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
  select s.id, s.employee_id, e.full_name, s.login_at, s.logout_at,
         coalesce(tx.cnt, 0), coalesce(tx.cash, 0), coalesce(tx.non_cash, 0), coalesce(tx.online, 0),
         coalesce(tx.cash, 0) + coalesce(tx.non_cash, 0) + coalesce(tx.online, 0),
         coalesce(kb.cnt, 0), coalesce(kb.amount, 0),
         coalesce(rf.cnt, 0), coalesce(rf.amount, 0)
  from cashier_sessions s
  join employees e on e.id = s.employee_id
  left join lateral (
    -- Penerimaan = yang dibayar pelanggan (produk + ongkir + biaya layanan)
    select count(*) as cnt,
           sum(t.total_amount + t.delivery_fee + t.service_fee)
             filter (where t.order_type <> 'online' and t.payment_method = 'tunai') as cash,
           sum(t.total_amount + t.delivery_fee + t.service_fee)
             filter (where t.order_type <> 'online' and t.payment_method <> 'tunai') as non_cash,
           sum(t.total_amount + t.delivery_fee + t.service_fee)
             filter (where t.order_type = 'online') as online
    from transactions t
    where t.cashier_session_id = s.id and t.status <> 'dibatalkan'
  ) tx on true
  left join lateral (
    select count(*) as cnt, sum(k.amount) as amount
    from kasbon k
    where k.created_at >= s.login_at and k.created_at < coalesce(s.logout_at, now())
  ) kb on true
  left join lateral (
    select count(*) as cnt, sum(r.refund_amount) as amount
    from refunds r
    where r.refunded_at >= s.login_at and r.refunded_at < coalesce(s.logout_at, now())
  ) rf on true
  where s.login_at >= p_start and s.login_at < p_end
  order by s.login_at desc;
end;
$$;

-- ------------------------------------------------------------
-- Laporan Jam Operasional (per hari, dari sesi kasir)
-- Shift 1 = sesi pertama hari itu, Shift 2 = sesi kedua (sesi ke-3 dst. dihitung di jumlah sesi).
-- Buka = login pertama, Tutup = logout terakhir, dibandingkan jam buka/tutup Offline hari itu.
-- ------------------------------------------------------------
create or replace function public.report_opening_hours(p_start date, p_end date)
returns table (
  day date,
  session_count bigint,
  shift1_cashier text,
  shift1_login timestamptz,
  shift1_logout timestamptz,
  shift2_cashier text,
  shift2_login timestamptz,
  shift2_logout timestamptz,
  gap_minutes integer,
  scheduled_open time,
  scheduled_close time,
  store_open boolean,
  open_diff_minutes integer,    -- + = buka lebih lambat dari jadwal, − = lebih cepat
  close_diff_minutes integer    -- + = tutup lebih lambat dari jadwal, − = lebih cepat
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
  with s as (
    select cs.*, e.full_name,
           (cs.login_at at time zone 'Asia/Jakarta')::date as d,
           row_number() over (partition by (cs.login_at at time zone 'Asia/Jakarta')::date
                              order by cs.login_at) as n
    from cashier_sessions cs
    join employees e on e.id = cs.employee_id
    where (cs.login_at at time zone 'Asia/Jakarta')::date between p_start and p_end
  ), per_day as (
    select s.d,
           count(*) as cnt,
           min(s.login_at) as first_login,
           max(coalesce(s.logout_at, s.login_at)) as last_logout,
           max(s.full_name) filter (where s.n = 1) as c1,
           max(s.login_at) filter (where s.n = 1) as l1,
           max(s.logout_at) filter (where s.n = 1) as o1,
           max(s.full_name) filter (where s.n = 2) as c2,
           max(s.login_at) filter (where s.n = 2) as l2,
           max(s.logout_at) filter (where s.n = 2) as o2,
           bool_or(s.logout_at is null) as has_open
    from s group by s.d
  )
  select p.d, p.cnt, p.c1, p.l1, p.o1, p.c2, p.l2, p.o2,
         case when p.l2 is not null and p.o1 is not null
              then greatest(0, floor(extract(epoch from (p.l2 - p.o1)) / 60))::int end,
         h.open_time, h.close_time, coalesce(h.is_open, false),
         case when h.is_open then
           floor(extract(epoch from ((p.first_login at time zone 'Asia/Jakarta') - (p.d + h.open_time))) / 60)::int
         end,
         case when h.is_open and not p.has_open then
           floor(extract(epoch from ((p.last_logout at time zone 'Asia/Jakarta') - (p.d + h.close_time))) / 60)::int
         end
  from per_day p
  left join store_hours h on h.channel = 'offline' and h.day_of_week = extract(dow from p.d)::int
  order by p.d desc;
end;
$$;

-- ============================================================
-- PELANGGAN / MEMBERSHIP
--
-- - Member dibuat dari Web Customer (belum dibangun); admin hanya mengelola.
-- - Status aktif/nonaktif + riwayatnya. Member nonaktif ditolak login di Web Customer,
--   poinnya dibekukan (tidak di-reset).
-- - Riwayat poin: earn (transaksi), redeem (klaim reward), adjust (manual admin),
--   refund_reversal (tarik balik karena refund). Saldo poin tidak boleh minus.
-- - RLS dirapikan: sebelumnya semua user login boleh baca/ubah semua data pelanggan & transaksi.
--   Sekarang: admin = penuh, karyawan (Kasir/Driver) = baca & catat transaksi,
--   pelanggan = hanya data miliknya sendiri.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Helper peran
-- ------------------------------------------------------------
create or replace function public.is_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from employees where id = auth.uid() and is_active);
$$;

-- ------------------------------------------------------------
-- 2. Struktur
-- ------------------------------------------------------------
alter table public.customers
  add column is_active boolean not null default true,
  -- Diisi saat member mendaftar/login di Web Customer
  add column auth_user_id uuid unique references auth.users(id) on delete set null;

-- id pelanggan milik user yang sedang login di Web Customer (null kalau bukan pelanggan)
create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from customers where auth_user_id = auth.uid();
$$;

create table public.customer_status_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  is_active boolean not null,
  reason text not null,
  changed_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);

create index customer_status_history_customer_idx on public.customer_status_history (customer_id, created_at desc);

alter table public.point_transactions
  drop constraint point_transactions_point_type_check,
  add constraint point_transactions_point_type_check
    check (point_type in ('earn', 'redeem', 'adjust', 'refund_reversal')),
  add column balance_after integer,
  add column created_by uuid references public.employees(id);

create index point_transactions_customer_idx on public.point_transactions (customer_id, created_at desc);
create index transactions_customer_idx on public.transactions (customer_id, transaction_date desc);


-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
drop policy if exists "customers_all_authenticated" on public.customers;
create policy "customers_admin_all" on public.customers for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "customers_employee_select" on public.customers for select to authenticated
  using (is_employee());
create policy "customers_self_select" on public.customers for select to authenticated
  using (auth_user_id = auth.uid());

alter table public.customer_status_history enable row level security;
create policy "customer_status_history_admin_all" on public.customer_status_history for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "point_transactions_all_authenticated" on public.point_transactions;
create policy "point_transactions_admin_all" on public.point_transactions for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "point_transactions_employee_select" on public.point_transactions for select to authenticated
  using (is_employee());
create policy "point_transactions_self_select" on public.point_transactions for select to authenticated
  using (customer_id = current_customer_id());

drop policy if exists "transactions_all_authenticated" on public.transactions;
create policy "transactions_admin_all" on public.transactions for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "transactions_employee_select" on public.transactions for select to authenticated
  using (is_employee());
create policy "transactions_employee_insert" on public.transactions for insert to authenticated
  with check (is_employee());
create policy "transactions_employee_update" on public.transactions for update to authenticated
  using (is_employee()) with check (is_employee());
create policy "transactions_self_select" on public.transactions for select to authenticated
  using (customer_id = current_customer_id());

drop policy if exists "transaction_items_all_authenticated" on public.transaction_items;
create policy "transaction_items_admin_all" on public.transaction_items for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "transaction_items_employee_select" on public.transaction_items for select to authenticated
  using (is_employee());
create policy "transaction_items_employee_insert" on public.transaction_items for insert to authenticated
  with check (is_employee());
create policy "transaction_items_self_select" on public.transaction_items for select to authenticated
  using (exists (
    select 1 from transactions t where t.id = transaction_id and t.customer_id = current_customer_id()
  ));

drop policy if exists "refunds_all_authenticated" on public.refunds;
create policy "refunds_admin_all" on public.refunds for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "refunds_employee_select" on public.refunds for select to authenticated
  using (is_employee());


-- ------------------------------------------------------------
-- 4. Ringkasan member (dipakai layar Daftar Membership)
--    Total Transaksi & Belanja hanya dari transaksi resmi (bukan dibatalkan / refund penuh).
--    Total Belanja = nilai produk setelah diskon, dikurangi refund sebagian.
-- ------------------------------------------------------------
create or replace view public.customer_overview
with (security_invoker = true)
as
select
  c.id,
  c.name,
  c.phone_number,
  c.points_balance,
  c.is_active,
  c.registered_at,
  c.auth_user_id is not null as has_account,
  coalesce(agg.total_transactions, 0) as total_transactions,
  coalesce(agg.gross_spent, 0) - coalesce(ref.refunded, 0) as total_spent,
  agg.last_transaction_at,
  coalesce(agg.all_transactions, 0) as all_transactions
from public.customers c
left join lateral (
  select
    count(*) filter (where t.status in ('selesai', 'refund_sebagian')) as total_transactions,
    sum(t.subtotal - t.discount_amount) filter (where t.status in ('selesai', 'refund_sebagian')) as gross_spent,
    max(t.transaction_date) filter (where t.status <> 'dibatalkan') as last_transaction_at,
    count(*) as all_transactions
  from public.transactions t
  where t.customer_id = c.id
) agg on true
left join lateral (
  select sum(r.refund_amount) as refunded
  from public.refunds r
  join public.transactions t on t.id = r.transaction_id
  where t.customer_id = c.id and t.status = 'refund_sebagian'
) ref on true;


-- ------------------------------------------------------------
-- 5. Aksi admin
-- ------------------------------------------------------------

-- Tambah/kurangi poin manual. Saldo tidak boleh minus. Mengembalikan saldo baru.
create or replace function public.adjust_customer_points(
  p_customer_id uuid,
  p_delta integer,
  p_reason text
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_customer record;
  v_new integer;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menyesuaikan poin.' using errcode = '42501';
  end if;
  if coalesce(p_delta, 0) = 0 then
    raise exception 'Jumlah poin harus lebih dari 0.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Alasan penyesuaian wajib diisi.';
  end if;

  select * into v_customer from customers where id = p_customer_id for update;
  if v_customer.id is null then
    raise exception 'Pelanggan tidak ditemukan.';
  end if;

  v_new := v_customer.points_balance + p_delta;
  if v_new < 0 then
    raise exception 'Poin tidak cukup. Saldo % sekarang % poin, tidak bisa dikurangi %.',
      v_customer.name, v_customer.points_balance, abs(p_delta);
  end if;

  update customers set points_balance = v_new where id = p_customer_id;

  insert into point_transactions (customer_id, points_change, point_type, notes, balance_after, created_by)
  values (p_customer_id, p_delta, 'adjust', trim(p_reason), v_new, auth.uid());

  return v_new;
end;
$$;

-- Aktifkan / nonaktifkan member. Alasan wajib, tercatat di riwayat status.
create or replace function public.set_customer_active(
  p_customer_id uuid,
  p_active boolean,
  p_reason text
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_current boolean;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengubah status member.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Alasan wajib diisi.';
  end if;

  select is_active into v_current from customers where id = p_customer_id for update;
  if v_current is null then
    raise exception 'Pelanggan tidak ditemukan.';
  end if;
  if v_current = p_active then
    raise exception 'Member ini sudah %.', case when p_active then 'aktif' else 'nonaktif' end;
  end if;

  update customers set is_active = p_active where id = p_customer_id;

  insert into customer_status_history (customer_id, is_active, reason, changed_by)
  values (p_customer_id, p_active, trim(p_reason), auth.uid());
end;
$$;

-- Hapus member — hanya kalau belum pernah bertransaksi (kalau sudah, cukup nonaktifkan).
create or replace function public.delete_customer(p_customer_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh menghapus member.' using errcode = '42501';
  end if;
  if exists (select 1 from transactions where customer_id = p_customer_id) then
    raise exception 'Member ini sudah punya riwayat transaksi, tidak bisa dihapus. Nonaktifkan saja.';
  end if;

  delete from point_transactions where customer_id = p_customer_id;
  delete from customers where id = p_customer_id;
end;
$$;

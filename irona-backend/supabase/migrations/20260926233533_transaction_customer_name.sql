-- ============================================================
-- NAMA PELANGGAN DI TRANSAKSI (alur Kasir App)
--
-- - Bukan member → kasir ketik nama manual (disimpan di customer_name, customer_id kosong).
-- - Member → kasir ketik No HP → nama member terisi otomatis (customer_id + customer_name).
-- - Struk: "Customer" & "Nama Order" digabung jadi satu baris "Nama Pelanggan".
-- - Tidak ada pajak (PB1) di transaksi Irona Kopi.
-- ============================================================

alter table public.transactions
  add column customer_name text;

comment on column public.transactions.customer_name is
  'Nama pelanggan di struk: diketik kasir untuk non-member, atau nama member (otomatis dari No HP)';

-- Transaksi yang sudah ada: isi dari data member
update public.transactions t
set customer_name = c.name
from public.customers c
where c.id = t.customer_id and t.customer_name is null;

-- Satu toggle "Nama Pelanggan" (dulu Customer + Nama Order)
alter table public.receipt_settings
  drop column show_order_name;

comment on column public.receipt_settings.show_customer is
  'Nama Pelanggan: nama yang diketik kasir, atau nama member (otomatis dari No HP)';


-- Kasir App: cari member dari No HP (format 08…, 628…, +628…, spasi/strip diabaikan)
create or replace function public.find_member_by_phone(p_phone text)
returns table (customer_id uuid, name text, phone_number text, points_balance integer, is_active boolean)
language sql
stable
set search_path = public
as $$
  with q as (
    select regexp_replace(
             regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'),
             '^(62|0)', '') as digits
  )
  select c.id, c.name, c.phone_number, c.points_balance, c.is_active
  from customers c, q
  where length(q.digits) >= 8
    and regexp_replace(regexp_replace(c.phone_number, '\D', '', 'g'), '^(62|0)', '') = q.digits
  limit 1;
$$;

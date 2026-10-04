-- ============================================================
-- PESANAN ONLINE (WEB CUSTOMER) + PEMBAYARAN QRIS MIDTRANS
--
-- 1. Menu publik untuk Web Customer (anon): hanya kolom yang aman ditampilkan.
--    Harga = harga online (harga jual + biaya aturan Tipe Order online).
-- 2. online_orders: pesanan yang menunggu / sudah dibayar. Hanya ditulis Edge Function
--    (service role): create-online-order & midtrans-webhook.
-- 3. Saat settlement Midtrans → settle_online_order membuat baris transactions
--    (order_type online, qris, tanpa kasir) supaya Laporan, Cash Flow & Saldo Online terisi.
-- 4. Pelanggan melihat status lewat get_online_order(id) — uuid tidak bisa ditebak.
-- Voucher online belum dipakai (diskon 0) sampai promotions disambung ke Web Customer.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Menu publik
-- ------------------------------------------------------------
create or replace function public.online_menu_categories()
returns table (id uuid, name text, online_name text, display_order integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.online_name, c.display_order
  from categories c
  where c.show_online
  order by c.display_order;
$$;

create or replace function public.online_menu_products()
returns table (id uuid, name text, photo_url text, category_id uuid, price numeric, online_extra numeric)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.photo_url, p.category_id, x.online_price, x.online_extra
  from products p
  join categories c on c.id = p.category_id and c.show_online
  cross join lateral product_order_type_prices(p.id) x
  where p.selling_price is not null and is_product_visible_online(p.id)
  order by p.name;
$$;

-- Angka yang ditampilkan di checkout (ongkir final tetap dihitung server)
create or replace function public.online_checkout_settings()
returns table (fee_per_step numeric, step_km numeric, fee_per_100m numeric,
               max_distance_km numeric, service_fee numeric)
language sql
stable
security definer
set search_path = public
as $$
  select fee_per_step, step_km, fee_per_100m, max_distance_km, service_fee from online_order_settings;
$$;

grant execute on function public.online_menu_categories() to anon, authenticated;
grant execute on function public.online_menu_products() to anon, authenticated;
grant execute on function public.online_checkout_settings() to anon, authenticated;

-- ------------------------------------------------------------
-- 2. Pesanan online
-- ------------------------------------------------------------
create table public.online_orders (
  id uuid primary key default gen_random_uuid(),       -- = order_id Midtrans
  code text not null unique
    default 'IRN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  status text not null default 'menunggu_pembayaran'
    check (status in ('menunggu_pembayaran', 'diproses', 'diantar', 'selesai', 'kedaluwarsa', 'dibatalkan')),
  customer_name text not null,
  phone text not null,
  address text,
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  driver_note text,
  order_note text,
  -- [{ productId, name, qty, price, onlineExtra }] — harga dari server saat pesanan dibuat
  items jsonb not null,
  subtotal numeric(14,2) not null,
  discount numeric(14,2) not null default 0,
  delivery_fee numeric(14,2) not null,
  service_fee numeric(14,2) not null,
  total numeric(14,2) not null,                         -- = gross_amount Midtrans
  delivery_distance_km numeric(6,2),
  pay_expires_at timestamptz not null,
  midtrans_transaction_id text,
  midtrans_status text,
  qr_url text,
  paid_at timestamptz,
  transaction_id uuid references public.transactions(id),
  created_at timestamptz not null default now()
);

create index online_orders_created_idx on public.online_orders (created_at desc);

alter table public.online_orders enable row level security;
create policy "online_orders_select_authenticated" on public.online_orders for select to authenticated using (true);

-- Pesanan web tidak punya kasir
alter table public.transactions alter column employee_id drop not null;
alter table public.transactions add constraint transactions_employee_required_check
  check (employee_id is not null or order_type = 'online');

-- ------------------------------------------------------------
-- 3. Settlement → transaksi (idempoten; dipanggil midtrans-webhook)
-- ------------------------------------------------------------
create or replace function public.settle_online_order(p_id uuid, p_midtrans_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o online_orders;
  v_tx uuid;
begin
  select * into o from online_orders where id = p_id for update;
  if not found then
    raise exception 'Pesanan online tidak ditemukan.';
  end if;
  -- Notifikasi bisa datang berulang; pembayaran yang telat (sudah kedaluwarsa di sisi kita) tetap diproses
  if o.transaction_id is not null then
    return;
  end if;

  insert into transactions (
    transaction_number, order_type, payment_method, customer_name,
    subtotal, discount_amount, total_amount, online_price_adjustment,
    delivery_fee, service_fee, delivery_distance_km, delivery_address, settled_at
  ) values (
    o.code, 'online', 'qris', o.customer_name,
    o.subtotal, o.discount, o.subtotal - o.discount,
    (select coalesce(sum((i->>'onlineExtra')::numeric * (i->>'qty')::int), 0) from jsonb_array_elements(o.items) i),
    o.delivery_fee, o.service_fee, o.delivery_distance_km, o.address, now()
  ) returning id into v_tx;

  insert into transaction_items (transaction_id, product_id, quantity, unit_price, line_total)
  select v_tx, (i->>'productId')::uuid, (i->>'qty')::int, (i->>'price')::numeric,
         (i->>'price')::numeric * (i->>'qty')::int
  from jsonb_array_elements(o.items) i;

  update online_orders
  set status = 'diproses', paid_at = now(), transaction_id = v_tx, midtrans_status = p_midtrans_status
  where id = p_id;
end;
$$;

revoke execute on function public.settle_online_order(uuid, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. Status untuk halaman pesanan pelanggan
-- ------------------------------------------------------------
create or replace function public.get_online_order(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'code', o.code,
    -- Lewat batas bayar tanpa notifikasi expire → tampil kedaluwarsa
    'status', case when o.status = 'menunggu_pembayaran' and o.pay_expires_at <= now()
                   then 'kedaluwarsa' else o.status end,
    'createdAt', o.created_at,
    'payExpiresAt', o.pay_expires_at,
    'qrUrl', o.qr_url,
    'customerName', o.customer_name,
    'phone', o.phone,
    'address', o.address,
    'items', o.items,
    'subtotal', o.subtotal,
    'shippingFee', o.delivery_fee,
    'discount', o.discount,
    'serviceFee', o.service_fee,
    'total', o.total
  )
  from online_orders o
  where o.id = p_id;
$$;

grant execute on function public.get_online_order(uuid) to anon, authenticated;

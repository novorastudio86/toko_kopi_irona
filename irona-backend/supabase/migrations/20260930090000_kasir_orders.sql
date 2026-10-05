-- ============================================================
-- SIMPAN ORDER DARI KASIR APP (offline: Dine In / Take Away)
--
-- Keputusan 2026-09-30:
-- - Tablet login sebagai Owner; kasir yang bertugas = karyawan yang masuk dengan PIN.
--   Sesi kasir dibuka saat kasir masuk (PIN) dan ditutup saat "Ganti".
-- - No. Antrean #01, #02, … direset tiap hari. No. Order INV-YYMMDD-NNNN (urut per hari).
-- - QRIS offline = QRIS fisik (statis) di meja kasir: tidak lewat payment gateway, kasir
--   mengonfirmasi manual → tidak ada MDR (MDR hanya untuk order online).
-- - Catatan per item (mis. "Less Sugar") berupa teks bebas, tidak mengubah harga.
-- - Harga dihitung ulang di server: harga jual produk + biaya aturan Take Away per unit.
--   Diskon menyusul (tahap berikutnya).
-- - Satu fungsi = satu transaksi database: transaksi, item (+HPP), potong stok (resep + bahan
--   Take Away), dan poin member tersimpan semua atau tidak sama sekali.
-- ============================================================

alter table public.transactions
  add column queue_number integer check (queue_number > 0);

alter table public.transaction_items
  add column notes text;

comment on column public.transactions.queue_number is 'No. antrean harian (#01, #02, …), reset tiap hari';
comment on column public.transaction_items.notes is 'Catatan pesanan dari kasir, mis. "Less Sugar, Oatmilk"';

-- Penghitung harian untuk No. Antrean & No. Order
create table public.daily_order_counters (
  day date primary key,
  last_queue integer not null default 0,
  last_order integer not null default 0
);
alter table public.daily_order_counters enable row level security;
revoke all on public.daily_order_counters from anon, authenticated;

-- ------------------------------------------------------------
-- Sesi kasir: sekarang atas nama karyawan yang masuk dengan PIN (bukan akun Owner)
-- ------------------------------------------------------------
drop function if exists public.start_cashier_session();
drop function if exists public.end_cashier_session();

create or replace function public.start_cashier_session(p_employee_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from employees e join roles r on r.id = e.role_id
    where e.id = p_employee_id and e.is_active and r.type = 'kasir'
  ) then
    raise exception 'Karyawan ini bukan kasir yang aktif.';
  end if;

  -- Sesi lama yang lupa ditutup (mis. aplikasi ditutup paksa) ditutup otomatis
  update cashier_sessions set logout_at = now()
  where employee_id = p_employee_id and logout_at is null;

  insert into cashier_sessions (employee_id) values (p_employee_id) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.end_cashier_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;
  update cashier_sessions set logout_at = now()
  where id = p_session_id and logout_at is null;
end;
$$;

revoke execute on function public.start_cashier_session(uuid) from public, anon;
revoke execute on function public.end_cashier_session(uuid) from public, anon;

-- ------------------------------------------------------------
-- Simpan order kasir
-- p_items: [{ "product_id": uuid, "quantity": int, "notes": text|null }, ...]
-- Hasil: data struk (No. Order, antrean, item, total, kembalian, poin)
-- ------------------------------------------------------------
create or replace function public.create_kasir_order(
  p_session_id uuid,
  p_items jsonb,
  p_order_type text,
  p_payment_method text,
  p_customer_name text,
  p_customer_id uuid default null,
  p_cash_received numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_member record;
  v_today date := jakarta_today();
  v_queue integer;
  v_order_seq integer;
  v_number text;
  v_tx_id uuid;
  v_subtotal numeric := 0;
  v_total numeric;
  v_change numeric;
  v_points integer := 0;
  v_balance integer;
  v_line record;
  v_usage record;
  v_rule_item record;
  v_items_out jsonb := '[]'::jsonb;
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;

  -- Sesi kasir yang masih terbuka → siapa kasirnya
  select s.id, s.employee_id, e.full_name into v_session
  from cashier_sessions s join employees e on e.id = s.employee_id
  where s.id = p_session_id and s.logout_at is null;
  if v_session.id is null then
    raise exception 'Sesi kasir sudah berakhir. Masuk ulang dengan PIN.';
  end if;

  if p_order_type not in ('dine_in', 'take_away') then
    raise exception 'Tipe order harus Dine In atau Take Away.';
  end if;
  if p_payment_method not in ('tunai', 'qris') then
    raise exception 'Metode pembayaran harus Tunai atau QRIS.';
  end if;
  if coalesce(trim(p_customer_name), '') = '' then
    raise exception 'Nama pelanggan wajib diisi.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Pesanan masih kosong.';
  end if;

  if p_customer_id is not null then
    select id, name, points_balance into v_member
    from customers where id = p_customer_id and is_active for update;
    if v_member.id is null then
      raise exception 'Member tidak ditemukan atau nonaktif.';
    end if;
  end if;

  -- Hitung harga tiap baris dari database (harga dari aplikasi tidak dipakai)
  drop table if exists kasir_lines;
  create temp table kasir_lines on commit drop as
  select x.ord,
         p.id as product_id,
         p.name,
         q.qty,
         nullif(trim(x.notes), '') as notes,
         p.selling_price
           + coalesce((select sum(r.total_cost) from applicable_order_type_rules(p.id, p_order_type) r), 0)
           as unit_price,
         p.selling_price as base_price,
         (select live_total_cost from products_with_cost where id = p.id) as base_cost,
         p.is_active, p.available_offline
  from rows from (jsonb_to_recordset(p_items) as (product_id uuid, quantity numeric, notes text))
         with ordinality as x(product_id, quantity, notes, ord)
  cross join lateral (select x.quantity::integer as qty) q
  left join products p on p.id = x.product_id;

  if exists (select 1 from kasir_lines where product_id is null) then
    raise exception 'Ada menu yang tidak ditemukan. Muat ulang daftar menu.';
  end if;
  if exists (select 1 from kasir_lines where qty is null or qty <= 0) then
    raise exception 'Jumlah menu harus minimal 1.';
  end if;
  select name into v_line from kasir_lines
  where not is_active or not available_offline or base_price is null limit 1;
  if found then
    raise exception 'Menu "%" sedang tidak dijual di kasir.', v_line.name;
  end if;

  select sum(unit_price * qty) into v_subtotal from kasir_lines;
  v_total := v_subtotal; -- diskon menyusul

  if p_payment_method = 'tunai' then
    if coalesce(p_cash_received, 0) < v_total then
      raise exception 'Uang diterima kurang dari total tagihan.';
    end if;
    v_change := p_cash_received - v_total;
  end if;

  -- No. Antrean & No. Order harian (baris dikunci supaya tidak dobel dari 2 tablet)
  insert into daily_order_counters (day, last_queue, last_order) values (v_today, 1, 1)
  on conflict (day) do update
    set last_queue = daily_order_counters.last_queue + 1,
        last_order = daily_order_counters.last_order + 1
  returning last_queue, last_order into v_queue, v_order_seq;
  v_number := 'INV-' || to_char(v_today, 'YYMMDD') || '-' || lpad(v_order_seq::text, 4, '0');

  insert into transactions (
    transaction_number, order_type, payment_method, customer_id, customer_name, employee_id,
    subtotal, discount_amount, total_amount, status, transaction_date,
    cash_received, change_amount, cashier_session_id, queue_number
  ) values (
    v_number, p_order_type, p_payment_method, p_customer_id, trim(p_customer_name),
    v_session.employee_id,
    v_subtotal, 0, v_total, 'selesai', now(),
    case when p_payment_method = 'tunai' then p_cash_received end,
    case when p_payment_method = 'tunai' then v_change end,
    v_session.id, v_queue
  ) returning id into v_tx_id;

  for v_line in select * from kasir_lines order by ord loop
    -- HPP per unit = Total Cost produk + harga bahan tambahan Take Away (cup, kresek, …)
    insert into transaction_items (transaction_id, product_id, quantity, unit_price, discount_amount,
                                   line_total, notes, unit_cost)
    values (v_tx_id, v_line.product_id, v_line.qty, v_line.unit_price, 0,
            v_line.unit_price * v_line.qty, v_line.notes,
            case when v_line.base_cost is null then null else
              v_line.base_cost + coalesce((
                select sum(ri.quantity * coalesce(rm.unit_price, 0))
                from applicable_order_type_rules(v_line.product_id, p_order_type) r
                join order_type_rule_items ri on ri.rule_id = r.rule_id
                join raw_materials rm on rm.id = ri.raw_material_id), 0)
            end);

    -- Potong stok bahan sesuai resep
    for v_usage in select * from expand_product_usage(v_line.product_id, v_line.qty) loop
      if v_usage.quantity > 0 then
        insert into stock_movements (movement_type, item_type, raw_material_id, racikan_id, quantity,
                                     unit_id, notes, movement_date, transaction_id, created_by)
        values ('penjualan', v_usage.item_type, v_usage.raw_material_id, v_usage.racikan_id,
                -v_usage.quantity, v_usage.unit_id, 'Penjualan ' || v_number, v_today, v_tx_id,
                v_session.employee_id);
      end if;
    end loop;

    -- Potong stok bahan tambahan Take Away (per unit produk)
    for v_rule_item in
      select ri.raw_material_id, rm.base_unit_id, sum(ri.quantity) as qty
      from applicable_order_type_rules(v_line.product_id, p_order_type) r
      join order_type_rule_items ri on ri.rule_id = r.rule_id
      join raw_materials rm on rm.id = ri.raw_material_id
      group by ri.raw_material_id, rm.base_unit_id
    loop
      insert into stock_movements (movement_type, item_type, raw_material_id, quantity, unit_id,
                                   notes, movement_date, transaction_id, created_by)
      values ('penjualan', 'bahan_baku', v_rule_item.raw_material_id, -(v_rule_item.qty * v_line.qty),
              v_rule_item.base_unit_id, 'Take Away ' || v_number, v_today, v_tx_id,
              v_session.employee_id);
    end loop;

    v_items_out := v_items_out || jsonb_build_object(
      'name', v_line.name, 'quantity', v_line.qty, 'unit_price', v_line.unit_price,
      'line_total', v_line.unit_price * v_line.qty, 'notes', v_line.notes);
  end loop;

  -- Poin member dari nilai belanja (aturan poin bertingkat di Web Admin)
  if p_customer_id is not null then
    select points into v_points from calc_points(v_total);
    if v_points > 0 then
      update customers set points_balance = points_balance + v_points
      where id = p_customer_id
      returning points_balance into v_balance;
      insert into point_transactions (customer_id, transaction_id, points_change, point_type, notes,
                                      balance_after)
      values (p_customer_id, v_tx_id, v_points, 'earn', 'Poin dari transaksi ' || v_number, v_balance);
    end if;
  end if;

  return jsonb_build_object(
    'transaction_id', v_tx_id,
    'transaction_number', v_number,
    'queue_number', v_queue,
    'transaction_date', now(),
    'cashier_name', v_session.full_name,
    'customer_name', trim(p_customer_name),
    'is_member', p_customer_id is not null,
    'order_type', p_order_type,
    'payment_method', p_payment_method,
    'items', v_items_out,
    'subtotal', v_subtotal,
    'total', v_total,
    'cash_received', case when p_payment_method = 'tunai' then p_cash_received end,
    'change', v_change,
    'points_earned', v_points,
    'points_balance', v_balance
  );
end;
$$;

revoke execute on function public.create_kasir_order(uuid, jsonb, text, text, text, uuid, numeric)
  from public, anon;

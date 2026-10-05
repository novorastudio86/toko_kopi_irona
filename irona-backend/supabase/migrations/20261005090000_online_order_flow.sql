-- ============================================================
-- ALUR PESANAN ONLINE (halaman Online di Kasir App, lalu Driver App)
--
-- Keputusan 2026-10-05:
-- - Pemesan online bisa MEMBER (login) atau TAMU (isi form: nama, No. WA aktif, email,
--   alamat, catatan alamat). Data kontak & alamat disalin ke pesanan; customer_id hanya
--   untuk member. Poin hanya untuk member.
-- - Pesanan masuk ke halaman Online setelah LUNAS (Midtrans QRIS).
-- - No. pesanan ONL-YYMMDD-NNNN (urut per hari, terpisah dari INV kasir).
-- - Status: masuk → dibuat → siap_diantar → diantar → selesai; atau dibatalkan (ditolak).
--   Kasir: terima (masuk→dibuat), siap (dibuat→siap_diantar), pilih driver, tolak.
--   Driver App nanti: diantar & selesai. Sampai Driver App ada, kasir juga boleh
--   menandai diantar/selesai (mis. HP driver mati).
-- - Setiap perubahan status dicatat di online_order_events → nanti dipakai kirim email
--   status ke pelanggan (Resend) & halaman lacak (tracking_token) di Web Customer.
-- - Stok bahan dipotong saat pesanan mulai DIBUAT; poin member diberikan saat SELESAI.
-- - Ditolak = online_status dibatalkan; status transaksi tetap "selesai" sampai Owner
--   memproses refund Midtrans dari Web Admin (Penyesuaian Transaksi).
-- ============================================================

alter table public.transactions
  add column online_status text
    check (online_status in ('masuk', 'dibuat', 'siap_diantar', 'diantar', 'selesai', 'dibatalkan')),
  add column customer_phone text,
  add column customer_email text,
  add column address_note text,
  add column tracking_token uuid unique;

comment on column public.transactions.online_status is 'Tahap pesanan online (null untuk pesanan kasir)';
comment on column public.transactions.customer_phone is 'No. WhatsApp pemesan online (member/tamu)';
comment on column public.transactions.customer_email is 'Email pemesan online, untuk email status pesanan';
comment on column public.transactions.address_note is 'Catatan alamat, mis. "Lantai 3, titip security"';
comment on column public.transactions.tracking_token is 'Kode acak untuk link Lacak Pesanan (tanpa login)';

-- Pesanan online lama (data dummy) dianggap sudah selesai
update public.transactions
set online_status = case when status = 'dibatalkan' then 'dibatalkan' else 'selesai' end,
    tracking_token = gen_random_uuid()
where order_type = 'online' and online_status is null;

create index transactions_online_status_idx on public.transactions (online_status)
  where order_type = 'online';

alter table public.daily_order_counters
  add column last_online integer not null default 0;

-- Riwayat status pesanan online
create table public.online_order_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  status text not null
    check (status in ('masuk', 'dibuat', 'siap_diantar', 'diantar', 'selesai', 'dibatalkan', 'driver_ditugaskan')),
  employee_id uuid references public.employees(id),
  notes text,
  created_at timestamptz not null default now()
);
create index online_order_events_tx_idx on public.online_order_events (transaction_id, created_at);

alter table public.online_order_events enable row level security;
create policy "online_order_events_admin_select" on public.online_order_events
  for select to authenticated using (is_admin());

-- Kasir App mendengarkan event baru secara real-time (notifikasi pesanan masuk)
alter publication supabase_realtime add table public.online_order_events;

-- ------------------------------------------------------------
-- Nomor pesanan online harian
-- ------------------------------------------------------------
create or replace function public.next_online_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := jakarta_today();
  v_seq integer;
begin
  insert into daily_order_counters (day, last_online) values (v_today, 1)
  on conflict (day) do update set last_online = daily_order_counters.last_online + 1
  returning last_online into v_seq;
  return 'ONL-' || to_char(v_today, 'YYMMDD') || '-' || lpad(v_seq::text, 4, '0');
end;
$$;
revoke execute on function public.next_online_order_number() from public, anon, authenticated;

-- Karyawan dari sesi kasir (untuk mencatat siapa yang mengubah status); null kalau tidak ada
create or replace function public.session_employee(p_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employee_id from cashier_sessions where id = p_session_id;
$$;
revoke execute on function public.session_employee(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Driver yang bisa ditugaskan: driver aktif yang sudah absen masuk hari ini & belum pulang
-- ------------------------------------------------------------
create or replace function public.list_available_drivers()
returns table (employee_id uuid, full_name text, checked_in_at timestamptz, active_deliveries bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;
  return query
  select e.id, e.full_name, a.check_in,
         (select count(*) from transactions t
          where t.driver_id = e.id and t.order_type = 'online'
            and t.online_status in ('siap_diantar', 'diantar'))
  from employees e
  join roles r on r.id = e.role_id
  join attendance a on a.employee_id = e.id
  where r.type = 'driver' and e.is_active
    and a.attendance_date = (case when (now() at time zone 'Asia/Jakarta')::time < '03:00'
                                  then jakarta_today() - 1 else jakarta_today() end)
    and a.check_in is not null and a.check_out is null
  order by 4, e.full_name;
end;
$$;
revoke execute on function public.list_available_drivers() from public, anon;

-- ------------------------------------------------------------
-- Ubah status pesanan online
-- ------------------------------------------------------------
create or replace function public.advance_online_order(
  p_transaction_id uuid,
  p_to text,
  p_session_id uuid default null,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
  v_actor uuid := session_employee(p_session_id);
  v_today date := jakarta_today();
  v_item record;
  v_usage record;
  v_rule_item record;
  v_points integer;
  v_balance integer;
  v_bonus numeric;
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;

  select * into v_tx from transactions
  where id = p_transaction_id and order_type = 'online' for update;
  if v_tx.id is null then
    raise exception 'Pesanan online tidak ditemukan.';
  end if;

  -- Perpindahan status yang diizinkan
  if not (
       (v_tx.online_status = 'masuk' and p_to in ('dibuat', 'dibatalkan'))
    or (v_tx.online_status = 'dibuat' and p_to in ('siap_diantar', 'dibatalkan'))
    or (v_tx.online_status = 'siap_diantar' and p_to = 'diantar')
    or (v_tx.online_status = 'diantar' and p_to = 'selesai')
  ) then
    raise exception 'Status pesanan tidak bisa diubah dari "%" ke "%".', v_tx.online_status, p_to;
  end if;
  if p_to = 'diantar' and v_tx.driver_id is null then
    raise exception 'Pilih driver dulu sebelum pesanan diantar.';
  end if;
  if p_to = 'dibatalkan' and coalesce(trim(p_note), '') = '' then
    raise exception 'Alasan menolak pesanan wajib diisi.';
  end if;

  -- Mulai dibuat: potong stok bahan (resep + bahan tambahan Online, mis. cup & kresek)
  if p_to = 'dibuat' then
    for v_item in select product_id, quantity from transaction_items where transaction_id = v_tx.id loop
      for v_usage in select * from expand_product_usage(v_item.product_id, v_item.quantity) loop
        if v_usage.quantity > 0 then
          insert into stock_movements (movement_type, item_type, raw_material_id, racikan_id, quantity,
                                       unit_id, notes, movement_date, transaction_id, created_by)
          values ('penjualan', v_usage.item_type, v_usage.raw_material_id, v_usage.racikan_id,
                  -v_usage.quantity, v_usage.unit_id, 'Penjualan ' || v_tx.transaction_number,
                  v_today, v_tx.id, v_actor);
        end if;
      end loop;
      for v_rule_item in
        select ri.raw_material_id, rm.base_unit_id, sum(ri.quantity) as qty
        from applicable_order_type_rules(v_item.product_id, 'online') r
        join order_type_rule_items ri on ri.rule_id = r.rule_id
        join raw_materials rm on rm.id = ri.raw_material_id
        group by ri.raw_material_id, rm.base_unit_id
      loop
        insert into stock_movements (movement_type, item_type, raw_material_id, quantity, unit_id,
                                     notes, movement_date, transaction_id, created_by)
        values ('penjualan', 'bahan_baku', v_rule_item.raw_material_id,
                -(v_rule_item.qty * v_item.quantity), v_rule_item.base_unit_id,
                'Online ' || v_tx.transaction_number, v_today, v_tx.id, v_actor);
      end loop;
    end loop;
  end if;

  if p_to = 'diantar' then
    update deliveries set status = 'diantar'
    where transaction_id = v_tx.id and status = 'ditugaskan';
  end if;

  -- Selesai: tugas driver selesai (+ bonus per antar), poin untuk member
  if p_to = 'selesai' then
    select delivery_bonus into v_bonus from employees where id = v_tx.driver_id;
    update deliveries set status = 'selesai', completed_at = now(), bonus_amount = coalesce(v_bonus, 0)
    where transaction_id = v_tx.id and status in ('ditugaskan', 'diantar');

    if v_tx.customer_id is not null then
      -- Poin dari nilai belanja produk (ongkir & biaya layanan tidak dihitung)
      select points into v_points from calc_points(v_tx.subtotal - v_tx.discount_amount);
      if v_points > 0 then
        update customers set points_balance = points_balance + v_points
        where id = v_tx.customer_id
        returning points_balance into v_balance;
        insert into point_transactions (customer_id, transaction_id, points_change, point_type, notes,
                                        balance_after)
        values (v_tx.customer_id, v_tx.id, v_points, 'earn',
                'Poin dari pesanan online ' || v_tx.transaction_number, v_balance);
      end if;
    end if;
  end if;

  if p_to = 'dibatalkan' then
    update deliveries set status = 'dibatalkan'
    where transaction_id = v_tx.id and status in ('ditugaskan', 'diantar');
  end if;

  update transactions set online_status = p_to where id = v_tx.id;
  insert into online_order_events (transaction_id, status, employee_id, notes)
  values (v_tx.id, p_to, v_actor, nullif(trim(p_note), ''));

  return p_to;
end;
$$;
revoke execute on function public.advance_online_order(uuid, text, uuid, text) from public, anon;

-- ------------------------------------------------------------
-- Tugaskan / ganti driver (saat pesanan dibuat atau siap diantar)
-- ------------------------------------------------------------
create or replace function public.assign_online_driver(
  p_transaction_id uuid,
  p_driver_id uuid,
  p_session_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
  v_driver_name text;
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;

  select * into v_tx from transactions
  where id = p_transaction_id and order_type = 'online' for update;
  if v_tx.id is null then
    raise exception 'Pesanan online tidak ditemukan.';
  end if;
  if v_tx.online_status not in ('dibuat', 'siap_diantar') then
    raise exception 'Driver hanya bisa dipilih saat pesanan dibuat atau siap diantar.';
  end if;

  select e.full_name into v_driver_name
  from employees e join roles r on r.id = e.role_id
  where e.id = p_driver_id and e.is_active and r.type = 'driver';
  if v_driver_name is null then
    raise exception 'Driver tidak ditemukan atau nonaktif.';
  end if;

  -- Ganti driver: tugas lama dibatalkan
  update deliveries set status = 'dibatalkan'
  where transaction_id = v_tx.id and status = 'ditugaskan' and driver_id <> p_driver_id;

  if not exists (select 1 from deliveries
                 where transaction_id = v_tx.id and driver_id = p_driver_id and status = 'ditugaskan') then
    insert into deliveries (transaction_id, driver_id, status) values (v_tx.id, p_driver_id, 'ditugaskan');
  end if;

  update transactions set driver_id = p_driver_id where id = v_tx.id;
  insert into online_order_events (transaction_id, status, employee_id, notes)
  values (v_tx.id, 'driver_ditugaskan', session_employee(p_session_id), 'Driver: ' || v_driver_name);
end;
$$;
revoke execute on function public.assign_online_driver(uuid, uuid, uuid) from public, anon;

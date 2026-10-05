-- ============================================================
-- DRIVER APP: status bertugas & aksi antar pesanan
--
-- Perangkat driver juga login sebagai Owner (seperti tablet kasir); driver dikenali dari
-- PIN di aplikasi. Fungsi di sini memastikan driver hanya bisa mengubah pesanan yang
-- DITUGASKAN kepadanya, dan hanya ke tahap Diantar / Selesai.
-- ============================================================

-- Tanggal kerja absensi: lewat tengah malam s.d. 03:00 masih dihitung hari sebelumnya
create or replace function public.current_work_date()
returns date
language sql
stable
as $$
  select case when (now() at time zone 'Asia/Jakarta')::time < '03:00'
              then jakarta_today() - 1 else jakarta_today() end;
$$;

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
    and a.attendance_date = current_work_date()
    and a.check_in is not null and a.check_out is null
  order by 4, e.full_name;
end;
$$;

-- Status bertugas driver hari ini (untuk label "Bertugas" di Driver App)
create or replace function public.driver_duty_status(p_driver_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_att record;
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;
  select check_in, check_out into v_att from attendance
  where employee_id = p_driver_id and attendance_date = current_work_date();
  return jsonb_build_object(
    'on_duty', v_att.check_in is not null and v_att.check_out is null,
    'check_in', v_att.check_in,
    'check_out', v_att.check_out);
end;
$$;
revoke execute on function public.driver_duty_status(uuid) from public, anon;

-- ------------------------------------------------------------
-- Inti perubahan status dipisah supaya bisa dipanggil kasir (sesi kasir) maupun driver.
-- p_actor = karyawan yang mengubah (dicatat di riwayat).
-- ------------------------------------------------------------
create or replace function public.apply_online_status(
  p_transaction_id uuid,
  p_to text,
  p_actor uuid,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
  v_today date := jakarta_today();
  v_item record;
  v_usage record;
  v_rule_item record;
  v_points integer;
  v_balance integer;
  v_bonus numeric;
begin
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
                  v_today, v_tx.id, p_actor);
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
                'Online ' || v_tx.transaction_number, v_today, v_tx.id, p_actor);
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
  values (v_tx.id, p_to, p_actor, nullif(trim(p_note), ''));

  return p_to;
end;
$$;
revoke execute on function public.apply_online_status(uuid, text, uuid, text) from public, anon, authenticated;

-- Dari Kasir App (isi sama seperti sebelumnya, sekarang memakai apply_online_status)
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
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;
  return apply_online_status(p_transaction_id, p_to, session_employee(p_session_id), p_note);
end;
$$;

-- Dari Driver App: hanya pesanan milik driver ini, hanya ke Diantar / Selesai
create or replace function public.driver_advance_online_order(
  p_transaction_id uuid,
  p_driver_id uuid,
  p_to text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid;
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;
  if p_to not in ('diantar', 'selesai') then
    raise exception 'Driver hanya bisa menandai pesanan diantar atau selesai.';
  end if;
  select driver_id into v_driver from transactions
  where id = p_transaction_id and order_type = 'online';
  if v_driver is distinct from p_driver_id then
    raise exception 'Pesanan ini tidak ditugaskan kepadamu.';
  end if;
  return apply_online_status(p_transaction_id, p_to, p_driver_id, null);
end;
$$;
revoke execute on function public.driver_advance_online_order(uuid, uuid, text) from public, anon;

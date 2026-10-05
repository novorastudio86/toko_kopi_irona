-- ============================================================
-- DRIVER TIBA DI LOKASI
--
-- Desain Driver App (Figma 67:1413) punya tahap: Terima → Menuju Lokasi → Tiba → Selesai.
-- "Tiba" bukan status pesanan baru (online_status tetap 'diantar'), hanya catatan di
-- riwayat supaya kasir & pelanggan (email/halaman lacak nanti) tahu driver sudah sampai.
-- ============================================================

alter table public.online_order_events drop constraint online_order_events_status_check;
alter table public.online_order_events add constraint online_order_events_status_check
  check (status in ('masuk', 'dibuat', 'siap_diantar', 'diantar', 'selesai', 'dibatalkan',
                    'driver_ditugaskan', 'driver_tiba'));

create or replace function public.driver_mark_arrived(p_transaction_id uuid, p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;
  select id, driver_id, online_status into v_tx from transactions
  where id = p_transaction_id and order_type = 'online' for update;
  if v_tx.id is null or v_tx.driver_id is distinct from p_driver_id then
    raise exception 'Pesanan ini tidak ditugaskan kepadamu.';
  end if;
  if v_tx.online_status <> 'diantar' then
    raise exception 'Tandai "Mulai Antar" dulu sebelum menandai sudah tiba.';
  end if;
  if exists (select 1 from online_order_events where transaction_id = v_tx.id and status = 'driver_tiba') then
    return; -- sudah ditandai, abaikan tekan ganda
  end if;
  insert into online_order_events (transaction_id, status, employee_id)
  values (v_tx.id, 'driver_tiba', p_driver_id);
end;
$$;
revoke execute on function public.driver_mark_arrived(uuid, uuid) from public, anon;

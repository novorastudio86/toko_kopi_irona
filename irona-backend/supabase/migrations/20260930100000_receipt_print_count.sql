-- ============================================================
-- JUMLAH CETAK STRUK (Batasan Jumlah Cetak Struk di Custom Struk)
--
-- Kasir App memanggil record_receipt_print SETELAH struk berhasil tercetak.
-- Kalau "Batasan Jumlah Cetak Struk" aktif dan transaksi sudah dicetak sebanyak batasnya,
-- cetak berikutnya ditolak (termasuk cetakan pertama; batas 2 = cetak 1× + cetak ulang 1×).
-- ============================================================

alter table public.transactions
  add column receipt_print_count integer not null default 0 check (receipt_print_count >= 0);

comment on column public.transactions.receipt_print_count is
  'Berapa kali struk transaksi ini sudah dicetak dari Kasir App';

-- Sisa jatah cetak sebelum mencetak (null = tanpa batas)
create or replace function public.receipt_print_allowance(p_transaction_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_settings record;
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;
  select receipt_print_count into v_count from transactions where id = p_transaction_id;
  if v_count is null then
    raise exception 'Transaksi tidak ditemukan.';
  end if;
  select reprint_limit_enabled, reprint_limit into v_settings from receipt_settings;
  return jsonb_build_object(
    'print_count', v_count,
    'limit', case when v_settings.reprint_limit_enabled then v_settings.reprint_limit end,
    'remaining', case when v_settings.reprint_limit_enabled
                      then greatest(v_settings.reprint_limit - v_count, 0) end);
end;
$$;

-- Catat 1× cetak; ditolak kalau jatah sudah habis
create or replace function public.record_receipt_print(p_transaction_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_settings record;
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;
  select reprint_limit_enabled, reprint_limit into v_settings from receipt_settings;

  select receipt_print_count into v_count from transactions where id = p_transaction_id for update;
  if v_count is null then
    raise exception 'Transaksi tidak ditemukan.';
  end if;
  if v_settings.reprint_limit_enabled and v_count >= v_settings.reprint_limit then
    raise exception 'Struk ini sudah dicetak % kali (batas % kali).', v_count, v_settings.reprint_limit;
  end if;

  update transactions set receipt_print_count = receipt_print_count + 1
  where id = p_transaction_id
  returning receipt_print_count into v_count;
  return v_count;
end;
$$;

revoke execute on function public.receipt_print_allowance(uuid) from public, anon;
revoke execute on function public.record_receipt_print(uuid) from public, anon;

-- ============================================================
-- ASET BARANG — jumlah, status, dan riwayat perubahan
-- ============================================================

alter table public.assets
  add column if not exists quantity integer not null default 1 check (quantity > 0),
  add column if not exists status text not null default 'aktif'
    check (status in ('aktif', 'rusak', 'dijual', 'hilang')),
  add column if not exists notes text;

-- Kolom lama tidak dipakai; status menggantikan condition
alter table public.assets drop column if exists condition;

comment on column public.assets.source is
  'Sumber dana pembelian — diisi dari modul Keuangan (bucket Net Profit)';

-- Riwayat perubahan aset
create table if not exists public.asset_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  action text not null check (action in ('dibuat', 'diubah', 'ganti_status')),
  changes jsonb,
  note text,
  changed_by uuid references public.employees(id),
  changed_at timestamptz not null default now()
);

create index if not exists asset_history_asset_idx on public.asset_history (asset_id, changed_at desc);

alter table public.asset_history enable row level security;

create policy "asset_history_admin_select"
  on public.asset_history for select to authenticated
  using (public.is_admin());

-- Simpan aset (baru/ubah) + catat riwayatnya
create or replace function public.save_asset(p_asset_id uuid, p_data jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
  v_old public.assets%rowtype;
  v_changes jsonb := '{}'::jsonb;
  k text;
  tracked text[] := array['name', 'purchase_price', 'quantity', 'purchase_date', 'notes'];
begin
  if not public.is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengelola aset.' using errcode = '42501';
  end if;
  if coalesce((p_data->>'quantity')::integer, 0) <= 0 then
    raise exception 'Jumlah aset harus lebih dari 0.';
  end if;
  if coalesce((p_data->>'purchase_price')::numeric, 0) <= 0 then
    raise exception 'Harga aset harus lebih dari 0.';
  end if;

  if p_asset_id is null then
    insert into public.assets (name, purchase_price, quantity, purchase_date, notes, status)
    values (
      p_data->>'name',
      (p_data->>'purchase_price')::numeric,
      (p_data->>'quantity')::integer,
      (p_data->>'purchase_date')::date,
      nullif(p_data->>'notes', ''),
      'aktif'
    )
    returning id into v_id;

    insert into public.asset_history (asset_id, action, changed_by)
    values (v_id, 'dibuat', auth.uid());
  else
    select * into v_old from public.assets where id = p_asset_id;
    if v_old.id is null then
      raise exception 'Aset tidak ditemukan.';
    end if;

    update public.assets set
      name = p_data->>'name',
      purchase_price = (p_data->>'purchase_price')::numeric,
      quantity = (p_data->>'quantity')::integer,
      purchase_date = (p_data->>'purchase_date')::date,
      notes = nullif(p_data->>'notes', '')
    where id = p_asset_id
    returning id into v_id;

    foreach k in array tracked loop
      if (to_jsonb(v_old) -> k) is distinct from (p_data -> k) then
        v_changes := v_changes || jsonb_build_object(
          k, jsonb_build_object('from', to_jsonb(v_old) -> k, 'to', p_data -> k)
        );
      end if;
    end loop;

    if v_changes <> '{}'::jsonb then
      insert into public.asset_history (asset_id, action, changes, changed_by)
      values (v_id, 'diubah', v_changes, auth.uid());
    end if;
  end if;

  return v_id;
end;
$$;

-- Ubah status aset — catatan alasan wajib diisi
create or replace function public.update_asset_status(p_asset_id uuid, p_status text, p_note text)
returns void
language plpgsql
security invoker
as $$
declare
  v_old text;
begin
  if not public.is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengubah status aset.' using errcode = '42501';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'Catatan alasan perubahan status wajib diisi.';
  end if;

  select status into v_old from public.assets where id = p_asset_id;
  if v_old is null then
    raise exception 'Aset tidak ditemukan.';
  end if;
  if v_old = p_status then
    raise exception 'Status aset sudah sama dengan yang dipilih.';
  end if;

  update public.assets set status = p_status where id = p_asset_id;

  insert into public.asset_history (asset_id, action, changes, note, changed_by)
  values (
    p_asset_id,
    'ganti_status',
    jsonb_build_object('status', jsonb_build_object('from', v_old, 'to', p_status)),
    trim(p_note),
    auth.uid()
  );
end;
$$;
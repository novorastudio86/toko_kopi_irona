-- ============ Riwayat perubahan bahan baku ============
-- Pola sama dengan product_history: nama disimpan & tanpa FK, jadi riwayat tetap ada setelah bahan dihapus.
-- current_stock tidak dilacak (sudah tercatat di Kartu Stok); unit_price hanya tercatat kalau harganya berubah.
create table public.raw_material_history (
  id uuid primary key default gen_random_uuid(),
  raw_material_id uuid not null,
  raw_material_name text not null,
  action text not null check (action in ('dibuat', 'diubah', 'dinonaktifkan', 'diaktifkan', 'dihapus')),
  changes jsonb, -- { "nama_kolom": { "from": ..., "to": ... } }
  changed_by uuid references public.employees(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index raw_material_history_changed_idx on public.raw_material_history (changed_at desc);

create or replace function public.log_raw_material_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_action text;
  k text;
  tracked text[] := array[
    'name', 'material_type', 'base_unit_id', 'default_purchase_unit_id',
    'default_qty_per_package', 'unit_price', 'min_stock_alert', 'is_active'
  ];
begin
  if tg_op = 'INSERT' then
    insert into public.raw_material_history (raw_material_id, raw_material_name, action, changes, changed_by)
    values (new.id, new.name, 'dibuat', null, auth.uid());
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.raw_material_history (raw_material_id, raw_material_name, action, changes, changed_by)
    values (old.id, old.name, 'dihapus', null, auth.uid());
    return old;
  end if;

  foreach k in array tracked loop
    if (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k) then
      v_changes := v_changes || jsonb_build_object(
        k, jsonb_build_object('from', to_jsonb(old) -> k, 'to', to_jsonb(new) -> k)
      );
    end if;
  end loop;

  if v_changes = '{}'::jsonb then
    return new; -- tidak ada kolom penting yang berubah (mis. hanya stok)
  end if;

  v_action := case
    when old.is_active and not new.is_active then 'dinonaktifkan'
    when not old.is_active and new.is_active then 'diaktifkan'
    else 'diubah'
  end;

  insert into public.raw_material_history (raw_material_id, raw_material_name, action, changes, changed_by)
  values (new.id, new.name, v_action, v_changes, auth.uid());
  return new;
end;
$$;

create trigger raw_materials_log_history
after insert or update or delete on public.raw_materials
for each row execute function public.log_raw_material_history();

alter table public.raw_material_history enable row level security;

-- Hanya bisa dibaca admin; ditulis otomatis oleh trigger
create policy "raw_material_history_admin_select"
  on public.raw_material_history for select to authenticated
  using (public.is_admin());

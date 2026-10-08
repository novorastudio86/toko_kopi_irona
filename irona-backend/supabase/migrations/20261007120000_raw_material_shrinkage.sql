-- Estimasi penyusutan (yield loss) untuk bahan menyusut.
-- Hanya referensi batas toleransi saat cek stok / opname, BUKAN pemotong stok otomatis.
alter table public.raw_materials
  add column shrinkage_percentage numeric(5,2)
    check (shrinkage_percentage between 0 and 100),
  add constraint raw_materials_shrinkage_only_menyusut
    check (material_type = 'menyusut' or shrinkage_percentage is null);

comment on column public.raw_materials.shrinkage_percentage is
  'Estimasi penyusutan (%) bahan menyusut — toleransi selisih saat opname, tidak memotong stok';

-- Lacak juga di riwayat bahan baku
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
    'default_qty_per_package', 'unit_price', 'min_stock_alert', 'shrinkage_percentage', 'is_active'
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

-- Menonaktifkan produk secara manual wajib menyertakan alasan, dan alasannya ikut tercatat di riwayat.

alter table public.products add column deactivation_reason text;
alter table public.product_history add column reason text;

create or replace function public.log_product_history()
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
    'name', 'description', 'photo_url', 'category_id', 'unit', 'sku',
    'available_offline', 'available_online', 'recipe_status',
    'base_cost', 'add_cost_percentage', 'desired_cost_percentage', 'selling_price', 'is_active'
  ];
begin
  if tg_op = 'INSERT' then
    insert into public.product_history (product_id, product_name, action, changes, changed_by)
    values (new.id, new.name, 'dibuat', null, auth.uid());
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.product_history (product_id, product_name, action, changes, changed_by)
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
    return new; -- tidak ada kolom penting yang berubah
  end if;

  v_action := case
    when old.is_active and not new.is_active then 'dinonaktifkan'
    when not old.is_active and new.is_active then 'diaktifkan'
    else 'diubah'
  end;

  -- Nonaktif manual (dari tombol Nonaktifkan) wajib ada alasan
  if v_action = 'dinonaktifkan' and new.deactivated_manually
     and coalesce(trim(new.deactivation_reason), '') = '' then
    raise exception 'Alasan menonaktifkan produk wajib diisi.';
  end if;

  insert into public.product_history (product_id, product_name, action, changes, changed_by, reason)
  values (
    new.id, new.name, v_action, v_changes, auth.uid(),
    case when v_action = 'dinonaktifkan' then trim(new.deactivation_reason) end
  );
  return new;
end;
$$;

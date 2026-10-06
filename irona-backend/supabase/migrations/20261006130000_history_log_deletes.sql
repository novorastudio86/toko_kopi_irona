-- Riwayat produk & kategori ikut mencatat penghapusan.
-- Sebelumnya FK "on delete cascade" ikut menghapus seluruh riwayat saat produk/kategori dihapus,
-- dan trigger hanya jalan untuk insert/update. Sekarang nama disimpan di riwayat dan FK dilepas
-- supaya riwayat tetap ada setelah datanya dihapus.

-- ============ Produk ============
alter table public.product_history add column product_name text;

update public.product_history h
set product_name = p.name
from public.products p
where p.id = h.product_id;

alter table public.product_history
  drop constraint product_history_product_id_fkey,
  drop constraint product_history_action_check,
  add constraint product_history_action_check
    check (action in ('dibuat', 'diubah', 'dinonaktifkan', 'diaktifkan', 'dihapus')),
  alter column product_name set not null;

create index product_history_changed_idx on public.product_history (changed_at desc);

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

  insert into public.product_history (product_id, product_name, action, changes, changed_by)
  values (new.id, new.name, v_action, v_changes, auth.uid());
  return new;
end;
$$;

drop trigger products_log_history on public.products;
create trigger products_log_history
after insert or update or delete on public.products
for each row execute function public.log_product_history();

-- ============ Kategori ============
alter table public.category_history add column category_name text;

update public.category_history h
set category_name = c.name
from public.categories c
where c.id = h.category_id;

alter table public.category_history
  drop constraint category_history_category_id_fkey,
  drop constraint category_history_action_check,
  add constraint category_history_action_check check (action in ('dibuat', 'diubah', 'dihapus')),
  alter column category_name set not null;

create or replace function public.log_category_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb := '{}'::jsonb;
  k text;
  tracked text[] := array['name', 'icon', 'display_order', 'show_in_menu', 'show_online'];
begin
  if tg_op = 'INSERT' then
    insert into public.category_history (category_id, category_name, action, changes, changed_by)
    values (new.id, new.name, 'dibuat', null, auth.uid());
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.category_history (category_id, category_name, action, changes, changed_by)
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

  if v_changes <> '{}'::jsonb then
    insert into public.category_history (category_id, category_name, action, changes, changed_by)
    values (new.id, new.name, 'diubah', v_changes, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger categories_log_history on public.categories;
create trigger categories_log_history
after insert or update or delete on public.categories
for each row execute function public.log_category_history();

-- ============ Pelaku perubahan ============
-- Riwayat tidak boleh menghalangi penghapusan akun karyawan
alter table public.product_history
  drop constraint product_history_changed_by_fkey,
  add constraint product_history_changed_by_fkey
    foreign key (changed_by) references public.employees(id) on delete set null;

alter table public.category_history
  drop constraint category_history_changed_by_fkey,
  add constraint category_history_changed_by_fkey
    foreign key (changed_by) references public.employees(id) on delete set null;

alter table public.recipe_history
  drop constraint recipe_history_changed_by_fkey,
  add constraint recipe_history_changed_by_fkey
    foreign key (changed_by) references public.employees(id) on delete set null;

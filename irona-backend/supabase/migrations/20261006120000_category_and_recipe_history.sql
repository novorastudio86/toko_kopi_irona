-- ============ Riwayat perubahan kategori ============
create table public.category_history (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  action text not null check (action in ('dibuat', 'diubah')),
  changes jsonb, -- { "nama_kolom": { "from": ..., "to": ... } }
  changed_by uuid references public.employees(id),
  changed_at timestamptz not null default now()
);

create index category_history_changed_idx on public.category_history (changed_at desc);

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
    insert into public.category_history (category_id, action, changes, changed_by)
    values (new.id, 'dibuat', null, auth.uid());
    return new;
  end if;

  foreach k in array tracked loop
    if (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k) then
      v_changes := v_changes || jsonb_build_object(
        k, jsonb_build_object('from', to_jsonb(old) -> k, 'to', to_jsonb(new) -> k)
      );
    end if;
  end loop;

  if v_changes <> '{}'::jsonb then
    insert into public.category_history (category_id, action, changes, changed_by)
    values (new.id, 'diubah', v_changes, auth.uid());
  end if;
  return new;
end;
$$;

create trigger categories_log_history
after insert or update on public.categories
for each row execute function public.log_category_history();

alter table public.category_history enable row level security;

create policy "category_history_admin_select"
  on public.category_history for select to authenticated
  using (public.is_admin());

-- ============ Riwayat perubahan resep (produk & racikan) ============
-- Resep disimpan dengan "hapus semua komponen lalu insert ulang", jadi riwayat dicatat
-- lewat snapshot: saat commit, isi resep dibandingkan dengan snapshot terakhir yang tercatat.
create table public.recipe_history (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity, -- urutan pasti (changed_at bisa kembar dalam satu transaksi)
  recipe_type text not null check (recipe_type in ('produk', 'racikan')),
  recipe_id uuid not null, -- products.id / racikan.id; tanpa FK supaya riwayat "dihapus" tetap ada
  recipe_name text not null,
  action text not null check (action in ('dibuat', 'diubah', 'dihapus')),
  snapshot jsonb, -- isi resep setelah perubahan (null = dihapus)
  changes jsonb,  -- { "kunci": { "from": ..., "to": ... } }
  changed_by uuid references public.employees(id),
  changed_at timestamptz not null default now()
);

create index recipe_history_recipe_idx on public.recipe_history (recipe_type, recipe_id, seq desc);
create index recipe_history_changed_idx on public.recipe_history (changed_at desc);

-- Isi resep saat ini; null kalau produk/racikan-nya sudah tidak ada
create or replace function public.recipe_snapshot(p_type text, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with comps as (
    select coalesce(rm.name, rk.name) || ' ' || trim_scale(c.quantity)::text || ' ' || u.name as item
    from (
      select raw_material_id, racikan_id, quantity, unit_id
      from public.product_recipe_components
      where p_type = 'produk' and product_id = p_id
      union all
      select raw_material_id, component_racikan_id, quantity, unit_id
      from public.racikan_components
      where p_type = 'racikan' and racikan_id = p_id
    ) c
    left join public.raw_materials rm on rm.id = c.raw_material_id
    left join public.racikan rk on rk.id = c.racikan_id
    join public.units u on u.id = c.unit_id
  ),
  comp_list as (
    select coalesce(jsonb_agg(item order by item), '[]'::jsonb) as items from comps
  )
  select case p_type
    when 'produk' then (
      select jsonb_build_object('components', cl.items)
      from public.products p, comp_list cl
      where p.id = p_id
    )
    else (
      select jsonb_build_object(
        'name', r.name,
        'unit', u.name,
        'production_mode', r.production_mode,
        'yield_qty', r.yield_qty,
        'total_output_qty', r.total_output_qty,
        'add_cost_percentage', r.add_cost_percentage,
        'min_stock_alert', r.min_stock_alert,
        'components', cl.items
      )
      from public.racikan r
      join public.units u on u.id = r.unit_id
      cross join comp_list cl
      where r.id = p_id
    )
  end;
$$;

-- TG_ARGV[0] = 'produk' / 'racikan', TG_ARGV[1] = kolom id resep di tabel pemicu
create or replace function public.log_recipe_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := tg_argv[0];
  v_id uuid := (to_jsonb(coalesce(new, old)) ->> tg_argv[1])::uuid;
  v_now jsonb;
  v_name text;
  v_has_last boolean;
  v_last_name text;
  v_last_action text;
  v_last_snapshot jsonb;
  v_changes jsonb := '{}'::jsonb;
  k text;
begin
  v_now := public.recipe_snapshot(v_type, v_id);

  select recipe_name, action, snapshot into v_last_name, v_last_action, v_last_snapshot
  from public.recipe_history
  where recipe_type = v_type and recipe_id = v_id
  order by seq desc
  limit 1;
  v_has_last := found;

  -- Produk/racikan sudah dihapus
  if v_now is null then
    if v_has_last and v_last_action <> 'dihapus' then
      insert into public.recipe_history (recipe_type, recipe_id, recipe_name, action, changed_by)
      values (v_type, v_id, v_last_name, 'dihapus', auth.uid());
    end if;
    return null;
  end if;

  if v_has_last and v_last_snapshot = v_now then
    return null; -- disimpan ulang tanpa perubahan
  end if;

  if v_type = 'produk' then
    select name into v_name from public.products where id = v_id;
  else
    v_name := v_now ->> 'name';
  end if;

  if not v_has_last or v_last_action = 'dihapus' then
    if v_type = 'produk' and jsonb_array_length(v_now -> 'components') = 0 then
      return null; -- produk tanpa resep tidak perlu dicatat
    end if;
    insert into public.recipe_history (recipe_type, recipe_id, recipe_name, action, snapshot, changed_by)
    values (v_type, v_id, v_name, 'dibuat', v_now, auth.uid());
    return null;
  end if;

  for k in select jsonb_object_keys(v_now) loop
    if (v_last_snapshot -> k) is distinct from (v_now -> k) then
      v_changes := v_changes || jsonb_build_object(
        k, jsonb_build_object('from', v_last_snapshot -> k, 'to', v_now -> k)
      );
    end if;
  end loop;

  insert into public.recipe_history (recipe_type, recipe_id, recipe_name, action, snapshot, changes, changed_by)
  values (v_type, v_id, v_name, 'diubah', v_now, v_changes, auth.uid());
  return null;
end;
$$;

-- Deferred: jalan sekali saat commit, setelah semua komponen selesai dihapus & diinsert ulang.
-- Pemicu per baris yang berikutnya otomatis no-op karena snapshot sudah sama.
create constraint trigger product_recipe_components_log_history
after insert or update or delete on public.product_recipe_components
deferrable initially deferred
for each row execute function public.log_recipe_history('produk', 'product_id');

create constraint trigger racikan_components_log_history
after insert or update or delete on public.racikan_components
deferrable initially deferred
for each row execute function public.log_recipe_history('racikan', 'racikan_id');

create constraint trigger racikan_log_history
after insert or delete or update of
  name, unit_id, production_mode, yield_qty, total_output_qty, add_cost_percentage, min_stock_alert
on public.racikan
deferrable initially deferred
for each row execute function public.log_recipe_history('racikan', 'id');

-- Snapshot awal untuk resep yang sudah ada, supaya perubahan berikutnya punya pembanding
insert into public.recipe_history (recipe_type, recipe_id, recipe_name, action, snapshot, changed_at)
select 'racikan', r.id, r.name, 'dibuat', public.recipe_snapshot('racikan', r.id), r.created_at
from public.racikan r;

insert into public.recipe_history (recipe_type, recipe_id, recipe_name, action, snapshot, changed_at)
select 'produk', p.id, p.name, 'dibuat', public.recipe_snapshot('produk', p.id), p.created_at
from public.products p
where exists (select 1 from public.product_recipe_components c where c.product_id = p.id);

alter table public.recipe_history enable row level security;

create policy "recipe_history_admin_select"
  on public.recipe_history for select to authenticated
  using (public.is_admin());

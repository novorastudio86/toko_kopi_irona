-- ============ Riwayat perubahan produk ============
create table public.product_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  action text not null check (action in ('dibuat', 'diubah', 'dinonaktifkan', 'diaktifkan')),
  changes jsonb, -- { "nama_kolom": { "from": ..., "to": ... } }
  changed_by uuid references public.employees(id),
  changed_at timestamptz not null default now()
);

create index product_history_product_idx on public.product_history (product_id, changed_at desc);

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
    insert into public.product_history (product_id, action, changes, changed_by)
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

  if v_changes = '{}'::jsonb then
    return new; -- tidak ada kolom penting yang berubah
  end if;

  v_action := case
    when old.is_active and not new.is_active then 'dinonaktifkan'
    when not old.is_active and new.is_active then 'diaktifkan'
    else 'diubah'
  end;

  insert into public.product_history (product_id, action, changes, changed_by)
  values (new.id, v_action, v_changes, auth.uid());
  return new;
end;
$$;

create trigger products_log_history
after insert or update on public.products
for each row execute function public.log_product_history();

alter table public.product_history enable row level security;

-- Hanya bisa dibaca admin; ditulis otomatis oleh trigger, tidak ada insert manual
create policy "product_history_admin_select"
  on public.product_history for select to authenticated
  using (public.is_admin());

-- ============ Penyimpanan foto produk ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-photos',
  'product-photos',
  true,                                        -- foto bisa dilihat publik (dibutuhkan Web Customer)
  2097152,                                     -- maksimal 2 MB per file
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "product_photos_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and public.is_admin());

create policy "product_photos_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-photos' and public.is_admin());

create policy "product_photos_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and public.is_admin());
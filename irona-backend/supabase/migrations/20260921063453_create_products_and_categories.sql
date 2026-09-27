-- Kategori Produk
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  display_order integer not null unique check (display_order > 0),
  show_in_menu boolean not null default true,
  show_online boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

-- Produk (Step 1 form; resep/harga menyusul di migration Inventory)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  photo_url text,
  category_id uuid not null references public.categories(id),
  unit text not null,
  sku text unique,
  available_offline boolean not null default true,
  available_online boolean not null default false,
  recipe_status text not null default 'belum_lengkap'
    check (recipe_status in ('lengkap', 'belum_lengkap', 'tanpa_resep')),
  base_cost numeric(12,2),
  selling_price numeric(12,2),
  is_active boolean not null default false,
  deactivated_manually boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;

create policy "categories_select_authenticated"
  on public.categories for select to authenticated using (true);

create policy "categories_admin_write"
  on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "products_select_authenticated"
  on public.products for select to authenticated using (true);

create policy "products_admin_write"
  on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
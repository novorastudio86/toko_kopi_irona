-- Master Satuan
create table public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Bahan Baku
create table public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  material_type text not null check (material_type in ('tetap', 'menyusut')),
  shrinkage_percentage numeric(5,2),
  base_unit_id uuid not null references public.units(id),
  default_purchase_unit_id uuid references public.units(id),
  default_qty_per_package numeric(12,3),
  unit_price numeric(12,2),
  current_stock numeric(14,3) not null default 0,
  min_stock_alert numeric(14,3) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger raw_materials_set_updated_at
before update on public.raw_materials
for each row execute function public.set_updated_at();

-- Racikan
create table public.racikan (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit_id uuid not null references public.units(id),
  production_mode text not null check (production_mode in ('batch', 'made_to_order')),
  yield_qty numeric(12,3) not null,
  total_output_qty numeric(14,3) not null,
  add_cost_percentage numeric(5,2) not null default 0,
  cost_per_batch numeric(14,2) not null default 0,
  total_cost_per_batch numeric(14,2) not null default 0,
  cost_per_porsi numeric(14,2) not null default 0,
  price_per_unit numeric(14,4) not null default 0,
  min_stock_alert numeric(14,3),
  current_stock numeric(14,3) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger racikan_set_updated_at
before update on public.racikan
for each row execute function public.set_updated_at();

-- Komponen Racikan (nested: Bahan Baku atau Racikan lain)
create table public.racikan_components (
  id uuid primary key default gen_random_uuid(),
  racikan_id uuid not null references public.racikan(id) on delete cascade,
  component_type text not null check (component_type in ('bahan_baku', 'racikan')),
  raw_material_id uuid references public.raw_materials(id),
  component_racikan_id uuid references public.racikan(id),
  quantity numeric(12,3) not null,
  unit_id uuid not null references public.units(id),
  created_at timestamptz not null default now(),
  constraint racikan_components_source_check check (
    (component_type = 'bahan_baku' and raw_material_id is not null and component_racikan_id is null)
    or
    (component_type = 'racikan' and component_racikan_id is not null and raw_material_id is null)
  ),
  constraint racikan_components_no_self_reference check (component_racikan_id is distinct from racikan_id)
);

-- Resep Produk (Bahan Baku atau Racikan)
create table public.product_recipe_components (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  component_type text not null check (component_type in ('bahan_baku', 'racikan')),
  raw_material_id uuid references public.raw_materials(id),
  racikan_id uuid references public.racikan(id),
  quantity numeric(12,3) not null,
  unit_id uuid not null references public.units(id),
  created_at timestamptz not null default now(),
  constraint product_recipe_components_source_check check (
    (component_type = 'bahan_baku' and raw_material_id is not null and racikan_id is null)
    or
    (component_type = 'racikan' and racikan_id is not null and raw_material_id is null)
  )
);

-- Field pricing tambahan di Produk (merge dari revisi Master Resep)
alter table public.products
  add column cost numeric(14,2) not null default 0,
  add column add_cost_percentage numeric(5,2) not null default 0,
  add column desired_cost_percentage numeric(5,2),
  add column recommended_selling_price numeric(14,2),
  add column buffer_stock_minimum numeric(12,3);

-- RLS
alter table public.units enable row level security;
alter table public.raw_materials enable row level security;
alter table public.racikan enable row level security;
alter table public.racikan_components enable row level security;
alter table public.product_recipe_components enable row level security;

create policy "units_select_authenticated" on public.units for select to authenticated using (true);
create policy "units_admin_write" on public.units for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "raw_materials_select_authenticated" on public.raw_materials for select to authenticated using (true);
create policy "raw_materials_admin_write" on public.raw_materials for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "racikan_select_authenticated" on public.racikan for select to authenticated using (true);
create policy "racikan_admin_write" on public.racikan for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "racikan_components_select_authenticated" on public.racikan_components for select to authenticated using (true);
create policy "racikan_components_admin_write" on public.racikan_components for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "product_recipe_components_select_authenticated" on public.product_recipe_components for select to authenticated using (true);
create policy "product_recipe_components_admin_write" on public.product_recipe_components for all to authenticated using (public.is_admin()) with check (public.is_admin());
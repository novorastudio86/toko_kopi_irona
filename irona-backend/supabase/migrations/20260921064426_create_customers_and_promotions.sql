create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text not null unique,
  registered_at timestamptz not null default now(),
  points_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  promo_type text not null check (promo_type in ('otomatis', 'manual')),
  product_id uuid references public.products(id),
  criteria_min_qty integer,
  criteria_repeatable boolean not null default false,
  bonus_amount numeric(14,2),
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger promotions_set_updated_at before update on public.promotions
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.promotions enable row level security;
create policy "customers_all_authenticated" on public.customers for all to authenticated using (true) with check (true);
create policy "promotions_select" on public.promotions for select to authenticated using (true);
create policy "promotions_admin_write" on public.promotions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
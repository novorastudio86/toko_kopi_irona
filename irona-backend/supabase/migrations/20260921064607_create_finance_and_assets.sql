create table public.finance_ledger (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('hpp', 'fixed_cost', 'net_profit')),
  entry_type text not null,
  direction text not null check (direction in ('masuk', 'keluar')),
  amount numeric(14,2) not null,
  description text,
  source_table text,
  source_id uuid,
  transaction_date date not null default current_date,
  created_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);

create table public.kasbon (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  amount numeric(14,2) not null,
  remaining_amount numeric(14,2) not null,
  status text not null default 'belum_lunas' check (status in ('belum_lunas', 'lunas')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger kasbon_set_updated_at before update on public.kasbon
  for each row execute function public.set_updated_at();

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  purchase_price numeric(14,2) not null,
  purchase_date date not null,
  source text,
  condition text,
  created_at timestamptz not null default now()
);

alter table public.finance_ledger enable row level security;
alter table public.kasbon enable row level security;
alter table public.assets enable row level security;
create policy "finance_ledger_admin_all" on public.finance_ledger for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "kasbon_admin_all" on public.kasbon for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "assets_admin_all" on public.assets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
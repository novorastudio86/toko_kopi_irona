create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_number text not null unique,
  order_type text not null check (order_type in ('dine_in', 'take_away', 'online')),
  payment_method text not null,
  customer_id uuid references public.customers(id),
  employee_id uuid not null references public.employees(id),
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  status text not null default 'selesai'
    check (status in ('selesai', 'refund_sebagian', 'refund_penuh', 'dibatalkan')),
  transaction_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null,
  unit_price numeric(14,2) not null,
  promotion_id uuid references public.promotions(id),
  discount_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id),
  transaction_item_id uuid references public.transaction_items(id),
  refund_amount numeric(14,2) not null,
  reason text,
  refunded_by uuid references public.employees(id),
  refunded_at timestamptz not null default now()
);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  transaction_id uuid references public.transactions(id),
  points_change integer not null,
  point_type text not null check (point_type in ('earn', 'redeem')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.refunds enable row level security;
alter table public.point_transactions enable row level security;
create policy "transactions_all_authenticated" on public.transactions for all to authenticated using (true) with check (true);
create policy "transaction_items_all_authenticated" on public.transaction_items for all to authenticated using (true) with check (true);
create policy "refunds_all_authenticated" on public.refunds for all to authenticated using (true) with check (true);
create policy "point_transactions_all_authenticated" on public.point_transactions for all to authenticated using (true) with check (true);
-- ============================================================
-- BONUS DRIVER — tarif per pengantaran + pencatatan pengantaran
-- ============================================================

alter table public.employees
  add column if not exists delivery_bonus numeric(12,2) not null default 0;

comment on column public.employees.delivery_bonus is
  'Tarif bonus per pengantaran selesai. Hanya dipakai karyawan bertipe driver.';

-- Pengantaran pesanan oleh driver. Diisi oleh Driver App.
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions(id),
  driver_id uuid not null references public.employees(id),
  status text not null default 'ditugaskan'
    check (status in ('ditugaskan', 'diantar', 'selesai', 'dibatalkan')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Tarif disimpan saat selesai, supaya perubahan tarif tidak mengubah riwayat gaji
  bonus_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists deliveries_driver_idx on public.deliveries (driver_id, completed_at desc);

alter table public.deliveries enable row level security;

create policy "deliveries_select_authenticated"
  on public.deliveries for select to authenticated using (true);

create policy "deliveries_admin_write"
  on public.deliveries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Dipanggil Driver App saat menekan "Pesanan Selesai".
-- Bonus otomatis diambil dari tarif driver yang berlaku saat itu.
create or replace function public.complete_delivery(p_delivery_id uuid)
returns numeric
language plpgsql
security invoker
as $$
declare
  v_driver uuid;
  v_status text;
  v_bonus numeric;
begin
  select driver_id, status into v_driver, v_status
  from public.deliveries where id = p_delivery_id;

  if v_driver is null then
    raise exception 'Data pengantaran tidak ditemukan.';
  end if;
  if v_status = 'selesai' then
    raise exception 'Pengantaran ini sudah ditandai selesai.';
  end if;

  select delivery_bonus into v_bonus from public.employees where id = v_driver;

  update public.deliveries
  set status = 'selesai',
      completed_at = now(),
      bonus_amount = coalesce(v_bonus, 0)
  where id = p_delivery_id;

  return coalesce(v_bonus, 0);
end;
$$;

-- Rincian gaji per karyawan dalam satu periode
create or replace function public.employee_payroll(p_start date, p_end date)
returns table (
  employee_id     uuid,
  base_salary     numeric,
  delivery_rate   numeric,
  delivery_count  bigint,
  bonus_total     numeric,
  total_salary    numeric
)
language sql
stable
as $$
  select
    e.id,
    e.base_salary,
    e.delivery_bonus,
    count(d.id),
    coalesce(sum(d.bonus_amount), 0),
    e.base_salary + coalesce(sum(d.bonus_amount), 0)
  from public.employees e
  left join public.deliveries d
    on d.driver_id = e.id
   and d.status = 'selesai'
   and d.completed_at::date between p_start and p_end
  group by e.id, e.base_salary, e.delivery_bonus;
$$;
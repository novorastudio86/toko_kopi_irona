create table public.shift_patterns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

create table public.shift_schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  shift_pattern_id uuid not null references public.shift_patterns(id),
  schedule_date date not null,
  created_at timestamptz not null default now(),
  unique (employee_id, schedule_date)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  attendance_date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status text not null check (status in ('hadir', 'izin', 'tidak_masuk', 'telat')),
  created_at timestamptz not null default now(),
  unique (employee_id, attendance_date)
);

alter table public.shift_patterns enable row level security;
alter table public.shift_schedules enable row level security;
alter table public.attendance enable row level security;
create policy "shift_patterns_select" on public.shift_patterns for select to authenticated using (true);
create policy "shift_patterns_admin_write" on public.shift_patterns for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "shift_schedules_select" on public.shift_schedules for select to authenticated using (true);
create policy "shift_schedules_admin_write" on public.shift_schedules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "attendance_select" on public.attendance for select to authenticated using (true);
create policy "attendance_admin_write" on public.attendance for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
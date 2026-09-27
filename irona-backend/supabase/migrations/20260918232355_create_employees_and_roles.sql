-- Tabel Hak Akses (roles)
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null check (type in ('admin', 'kasir', 'driver')),
  created_at timestamptz not null default now()
);

-- Seed role Admin/Owner (fixed, bukan dibuat lewat form)
insert into public.roles (name, type) values ('Admin/Owner', 'admin');

-- Tabel Karyawan, id = id akun Supabase Auth
create table public.employees (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  address text,
  phone_number text not null,
  role_id uuid not null references public.roles(id),
  base_salary numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update kolom updated_at tiap ada perubahan
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger employees_set_updated_at
before update on public.employees
for each row
execute function public.set_updated_at();

-- Helper: cek apakah user yang lagi login itu Admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.employees e
    join public.roles r on r.id = e.role_id
    where e.id = auth.uid()
      and r.type = 'admin'
      and e.is_active = true
  );
$$;

-- Aktifkan RLS (wajib, ini yang jadi lapisan keamanan utama)
alter table public.roles enable row level security;
alter table public.employees enable row level security;

-- roles: semua user yang login boleh baca (buat dropdown/filter)
create policy "roles_select_authenticated"
  on public.roles for select
  to authenticated
  using (true);

-- roles: cuma admin yang boleh tambah/ubah/hapus
create policy "roles_admin_write"
  on public.roles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- employees: admin boleh baca & kelola semua data karyawan
create policy "employees_admin_all"
  on public.employees for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- employees: karyawan cuma boleh baca datanya sendiri
create policy "employees_self_select"
  on public.employees for select
  to authenticated
  using (id = auth.uid());
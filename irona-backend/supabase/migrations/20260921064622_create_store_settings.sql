create table public.store_settings (
  id boolean primary key default true check (id),
  opening_time time,
  closing_time time,
  receipt_footer_note text,
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (true);

alter table public.store_settings enable row level security;
create policy "store_settings_select" on public.store_settings for select to authenticated using (true);
create policy "store_settings_admin_write" on public.store_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
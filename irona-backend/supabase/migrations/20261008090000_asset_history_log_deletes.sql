-- Riwayat aset ikut mencatat penghapusan (sama seperti produk & kategori).
-- Sebelumnya FK "on delete cascade" ikut menghapus riwayat saat aset dihapus.
-- Sekarang nama aset disimpan di riwayat dan FK dilepas.
alter table public.asset_history add column asset_name text;

update public.asset_history h
set asset_name = a.name
from public.assets a
where a.id = h.asset_id;

-- Riwayat aset yang sudah ikut terhapus tidak ada lagi, jadi semua baris pasti punya nama
alter table public.asset_history
  drop constraint asset_history_asset_id_fkey,
  drop constraint asset_history_action_check,
  add constraint asset_history_action_check
    check (action in ('dibuat', 'diubah', 'ganti_status', 'dihapus')),
  alter column asset_name set not null,
  drop constraint asset_history_changed_by_fkey,
  add constraint asset_history_changed_by_fkey
    foreign key (changed_by) references public.employees(id) on delete set null;

create index asset_history_changed_idx on public.asset_history (changed_at desc);

-- save_asset / update_asset_status tidak mengisi asset_name: ambil dari aset saat insert
create or replace function public.fill_asset_history_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.asset_name is null then
    select name into new.asset_name from public.assets where id = new.asset_id;
  end if;
  return new;
end;
$$;

create trigger asset_history_fill_name
before insert on public.asset_history
for each row execute function public.fill_asset_history_name();

create or replace function public.log_asset_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.asset_history (asset_id, asset_name, action, changed_by)
  values (old.id, old.name, 'dihapus', auth.uid());
  return old;
end;
$$;

create trigger assets_log_delete
after delete on public.assets
for each row execute function public.log_asset_delete();

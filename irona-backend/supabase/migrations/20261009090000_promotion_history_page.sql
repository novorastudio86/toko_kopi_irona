-- Riwayat diskon tampil di halaman daftar (tombol riwayat di header), sama seperti produk & aset.
-- Nama diskon disimpan di riwayat dan FK dilepas, supaya riwayat tetap ada & mencatat penghapusan.
alter table public.promotion_history add column promotion_name text;

update public.promotion_history h
set promotion_name = p.name
from public.promotions p
where p.id = h.promotion_id;

alter table public.promotion_history
  drop constraint promotion_history_promotion_id_fkey,
  drop constraint promotion_history_action_check,
  add constraint promotion_history_action_check
    check (action in ('dibuat', 'diubah', 'diaktifkan', 'dinonaktifkan', 'dihapus')),
  alter column promotion_name set not null,
  drop constraint promotion_history_changed_by_fkey,
  add constraint promotion_history_changed_by_fkey
    foreign key (changed_by) references public.employees(id) on delete set null;

create index promotion_history_created_idx on public.promotion_history (created_at desc);

-- save_promotion / set_promotion_active tidak mengisi promotion_name: ambil dari diskon saat insert
create or replace function public.fill_promotion_history_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.promotion_name is null then
    select name into new.promotion_name from public.promotions where id = new.promotion_id;
  end if;
  return new;
end;
$$;

create trigger promotion_history_fill_name
before insert on public.promotion_history
for each row execute function public.fill_promotion_history_name();

create or replace function public.log_promotion_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.promotion_history (promotion_id, promotion_name, action, changed_by)
  values (old.id, old.name, 'dihapus', auth.uid());
  return old;
end;
$$;

create trigger promotions_log_delete
after delete on public.promotions
for each row execute function public.log_promotion_delete();

-- Badge sidebar: hanya diskon berstatus Aktif (sama dengan status 'aktif' di promotion_overview)
create or replace view public.promotion_active
with (security_invoker = true)
as
select id from public.promotions
where is_active and end_date >= jakarta_today();

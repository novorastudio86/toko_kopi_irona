-- Nama kategori di Web Customer = kolom name. Tidak ada lagi nama tab terpisah / penggabungan kategori.
-- Return type berubah, jadi fungsi harus di-drop dulu (create or replace tidak bisa ubah kolom hasil).
drop function if exists public.online_menu_categories();

create function public.online_menu_categories()
returns table (id uuid, name text, display_order integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.display_order
  from categories c
  where c.show_online
  order by c.display_order;
$$;

grant execute on function public.online_menu_categories() to anon, authenticated;

alter table public.categories drop column if exists online_name;

-- Hapus kategori placeholder 'Belum Dikategorikan' dari seed: produk wajib
-- memilih kategori asli (category_id NOT NULL + FK sudah menjamin ini).
-- Produk di dalamnya dipindah ke kategori asli berdasarkan nama.

-- Kategori tujuan dibuat ulang bila sudah terhapus
insert into public.categories (name, display_order, show_in_menu, show_online)
select v.name, (select coalesce(max(display_order), 0) from public.categories) + v.ord, true, true
from (values ('BASIC COFFEE', 1), ('AMERICANO BASED', 2), ('ICE COFFEE', 3)) as v(name, ord)
where not exists (select 1 from public.categories c where c.name = v.name)
  and exists (select 1 from public.categories c where c.name = 'Belum Dikategorikan');

update public.products p
set category_id = target.id
from public.categories placeholder, public.categories target
where placeholder.name = 'Belum Dikategorikan'
  and p.category_id = placeholder.id
  and target.name = case
    when p.name ilike 'americano%' or p.name ilike 'sunkist%' then 'AMERICANO BASED'
    when p.name ilike 'es kopi susu%' then 'ICE COFFEE'
    else 'BASIC COFFEE'
  end;

-- Gagal (FK) bila masih ada produk tersisa, sehingga tidak ada produk yang hilang kategorinya
delete from public.categories where name = 'Belum Dikategorikan';

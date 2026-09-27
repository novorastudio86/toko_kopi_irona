-- Kode tampilan kategori (KAT-001, KAT-002, ...), terisi otomatis
create sequence if not exists public.category_code_seq;

alter table public.categories add column code text;

-- Isi kode untuk kategori yang sudah ada, urut berdasarkan urutan tampil
with ordered as (
  select id, row_number() over (order by display_order) as rn
  from public.categories
)
update public.categories c
set code = 'KAT-' || lpad(o.rn::text, 3, '0')
from ordered o
where c.id = o.id;

-- Lanjutkan penomoran dari jumlah kategori yang sudah ada
select setval(
  'public.category_code_seq',
  greatest((select count(*) from public.categories), 1),
  (select count(*) from public.categories) > 0
);

alter table public.categories
  alter column code set default 'KAT-' || lpad(nextval('public.category_code_seq')::text, 3, '0'),
  alter column code set not null,
  add constraint categories_code_key unique (code);
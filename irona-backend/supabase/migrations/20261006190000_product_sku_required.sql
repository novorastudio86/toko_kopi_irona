-- SKU wajib untuk semua produk (dipakai Daftar Produk, Master Resep, dan modul lain sebagai kode produk).
-- 1. Produk lama yang belum punya SKU dibuatkan otomatis dengan aturan yang sama dengan form
--    (suggestSku di admin): IRN-<3 huruf pertama kategori>-<nomor urut 2 digit>, lanjut dari nomor terbesar.
-- 2. Kolom sku dijadikan NOT NULL dan tidak boleh kosong.

update public.products set sku = nullif(upper(btrim(sku)), '');

with prefixed as (
  select
    p.id,
    p.name,
    'IRN-' || coalesce(nullif(upper(left(regexp_replace(c.name, '[^a-zA-Z]', '', 'g'), 3)), ''), 'PRD') as prefix
  from public.products p
  join public.categories c on c.id = p.category_id
  where p.sku is null
),
last_number as (
  select
    pf.prefix,
    coalesce(max((substring(p.sku from '-(\d+)$'))::int), 0) as n
  from (select distinct prefix from prefixed) pf
  left join public.products p on p.sku like pf.prefix || '-%'
  group by pf.prefix
),
numbered as (
  select
    pf.id,
    pf.prefix || '-' || lpad((ln.n + row_number() over (partition by pf.prefix order by pf.name))::text, 2, '0') as sku
  from prefixed pf
  join last_number ln on ln.prefix = pf.prefix
)
update public.products p
set sku = numbered.sku
from numbered
where numbered.id = p.id;

alter table public.products alter column sku set not null;
alter table public.products add constraint products_sku_not_blank check (btrim(sku) <> '');

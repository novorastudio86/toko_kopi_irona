-- ============================================================
-- PENJUALAN > CUSTOM STRUK (Pengaturan Struk)
--
-- - Data toko (nama, alamat, telepon, email, logo, media sosial) disimpan di store_settings.
--   Sementara diisi dari halaman Custom Struk (belum menunggu modul Pengaturan).
-- - Pengaturan struk: ukuran kertas 58/80 mm (1 printer), batas cetak ulang,
--   toggle tampil-tidaknya tiap elemen Header/Body/Footer. Ringkasan tagihan selalu tampil.
-- - Tersimpan otomatis setiap diubah (tanpa tombol Simpan) — Kasir App memakai pengaturan ini saat cetak.
-- ============================================================

alter table public.store_settings
  add column store_name text,
  add column address text,
  add column phone text,
  add column email text,
  add column logo_url text,
  add column social_facebook text,
  add column social_instagram text,
  add column social_twitter text,
  add column social_youtube text;

create table public.receipt_settings (
  id boolean primary key default true check (id),
  paper_width smallint not null default 58 check (paper_width in (58, 80)),
  reprint_limit_enabled boolean not null default false,
  reprint_limit smallint not null default 2 check (reprint_limit between 1 and 20),

  -- Header · Informasi Outlet
  show_logo boolean not null default true,
  logo_mode text not null default 'normal' check (logo_mode in ('normal', 'penuh')),
  show_store_name boolean not null default true,
  show_address boolean not null default true,
  show_phone boolean not null default true,
  show_email boolean not null default false,
  show_header_text boolean not null default false,
  header_text text,

  -- Header · Informasi Transaksi
  show_receipt_number boolean not null default true,
  show_transaction_time boolean not null default true,
  show_queue_number boolean not null default true,
  show_cashier_name boolean not null default true,
  show_customer boolean not null default true,
  show_order_type boolean not null default true,
  show_order_name boolean not null default false,
  show_table_number boolean not null default false,

  -- Body · Informasi Produk
  show_item_price boolean not null default true,     -- Harga Satuan & Ekstra
  show_extras boolean not null default true,         -- nama Ekstra/Add-on per item

  -- Footer
  show_footer_note boolean not null default true,
  footer_note text default 'Terima kasih sudah mampir ke Irona Kopi!',
  show_social_media boolean not null default false,

  updated_at timestamptz not null default now(),
  updated_by uuid references public.employees(id)
);

insert into public.receipt_settings (id) values (true);

create or replace function public.touch_receipt_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger receipt_settings_touch before update on public.receipt_settings
  for each row execute function public.touch_receipt_settings();

alter table public.receipt_settings enable row level security;
create policy "receipt_settings_select" on public.receipt_settings for select to authenticated using (true);
create policy "receipt_settings_admin_write" on public.receipt_settings for all to authenticated
  using (is_admin()) with check (is_admin());

-- Logo toko (publik, dipakai struk & Web Customer)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-assets', 'store-assets', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "store_assets_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'store-assets' and public.is_admin());

create policy "store_assets_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'store-assets' and public.is_admin());

create policy "store_assets_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'store-assets' and public.is_admin());

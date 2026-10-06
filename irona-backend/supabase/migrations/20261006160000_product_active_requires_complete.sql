-- Produk hanya boleh aktif kalau datanya lengkap: resep sudah diisi dan harga jual > 0.
-- Sebelumnya produk bisa aktif tanpa harga jual (mis. dari data awal), sehingga tetap tampil di kasir/web customer.

-- Nonaktifkan produk aktif yang belum lengkap (bukan nonaktif manual, jadi otomatis aktif lagi saat dilengkapi)
update public.products
set is_active = false,
    deactivation_reason = case
      when recipe_status = 'belum_lengkap' then 'Resep belum diisi'
      else 'Harga jual belum diisi'
    end
where is_active
  and (recipe_status = 'belum_lengkap' or coalesce(selling_price, 0) <= 0);

alter table public.products
  add constraint products_active_requires_complete
  check (not is_active or (recipe_status <> 'belum_lengkap' and coalesce(selling_price, 0) > 0));

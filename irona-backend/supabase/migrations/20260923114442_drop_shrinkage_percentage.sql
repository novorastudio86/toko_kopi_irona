-- Penyusutan tidak dihitung per transaksi: biayanya sudah ditutup Add Cost di resep,
-- selisih kuantitasnya dirapikan lewat Penyesuaian Stok saat opname.
-- Jenis bahan (tetap/menyusut) tetap dipakai sebagai penanda & filter.
alter table public.raw_materials drop column if exists shrinkage_percentage;

comment on column public.raw_materials.material_type is
  'menyusut = dipakai sebagian per porsi (gr/ml), tetap = dipakai utuh per porsi (pcs)';
-- Alert Minimum Produk dihapus dari Daftar Produk (keputusan revisi PRD)
alter table public.products drop column if exists buffer_stock_minimum;
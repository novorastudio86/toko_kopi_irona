-- Menghapus data contoh modul Keuangan (dari dummy_keuangan.sql)
begin;
-- Data contoh bertanggal lampau: lewati kunci tutup buku (khusus script dev)
set local irona.bypass_period_lock = 'on';

-- Pencairan contoh
update transactions set disbursement_id = null
where disbursement_id in (select id from online_disbursements where notes like '%[contoh]%');
delete from online_disbursements where notes like '%[contoh]%';

-- Transaksi contoh (+ refund-nya; item ikut terhapus / cascade)
delete from refunds where transaction_id in (select id from transactions where transaction_number like 'DUMMY-KEU-%');
delete from transactions where transaction_number like 'DUMMY-KEU-%';

-- Stok masuk contoh: kembalikan stok lalu hapus pergerakannya
update raw_materials rm set current_stock = rm.current_stock - x.qty
from (select raw_material_id, sum(quantity) as qty from stock_movements
      where movement_type = 'stok_masuk' and notes like '%[contoh]%' group by 1) x
where rm.id = x.raw_material_id;
delete from stock_movements where movement_type = 'stok_masuk' and notes like '%[contoh]%';

delete from finance_expenses where notes like '%[contoh]%';
delete from kasbon where notes like '%[contoh]%';

-- Aset contoh
delete from assets where notes like '%[contoh]%';

commit;

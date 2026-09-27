-- Menghapus semua data dummy pelanggan (no HP 08990000…, transaksi DUMMY-…)
begin;
-- Data contoh bertanggal lampau: lewati kunci tutup buku (khusus script dev)
set local irona.bypass_period_lock = 'on';
delete from stock_movements where transaction_id in (select id from transactions where transaction_number like 'DUMMY-%');
delete from refunds where transaction_id in (select id from transactions where transaction_number like 'DUMMY-%');
delete from point_transactions where customer_id in (select id from customers where phone_number like '08990000%');
delete from transactions where transaction_number like 'DUMMY-%'; -- transaction_items ikut terhapus (cascade)
delete from customers where phone_number like '08990000%';       -- customer_status_history ikut terhapus (cascade)
commit;

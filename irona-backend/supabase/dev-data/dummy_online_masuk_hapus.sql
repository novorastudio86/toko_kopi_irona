-- Menghapus pesanan online contoh dari dummy_online_masuk.sql (email @dummy.irona.test)
-- beserta stok, poin, dan tugas antar yang terlanjur tercatat saat dicoba.
begin;
create temp table dummy_online on commit drop as
  select id from transactions where customer_email like '%@dummy.irona.test';

update customers c set points_balance = c.points_balance - p.total
from (select customer_id, sum(points_change) as total from point_transactions
      where transaction_id in (select id from dummy_online) group by customer_id) p
where c.id = p.customer_id;
delete from point_transactions where transaction_id in (select id from dummy_online);
delete from stock_movements where transaction_id in (select id from dummy_online);
delete from deliveries where transaction_id in (select id from dummy_online);
delete from transactions where id in (select id from dummy_online);
commit;

-- Hapus data contoh sesi kasir (dummy_sesi_kasir.sql): hanya sesi yang berisi transaksi DUMMY saja
begin;
create temp table dummy_sessions on commit drop as
select distinct t.cashier_session_id as id
from transactions t
where t.transaction_number like 'DUMMY-%' and t.cashier_session_id is not null
  and not exists (
    select 1 from transactions x
    where x.cashier_session_id = t.cashier_session_id and x.transaction_number not like 'DUMMY-%'
  );
update transactions set cashier_session_id = null
where cashier_session_id in (select id from dummy_sessions);
delete from cashier_sessions where id in (select id from dummy_sessions);
commit;

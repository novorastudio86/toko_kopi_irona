-- Hapus data contoh redeem (dummy_redeem.sql): poin member dikembalikan seperti sebelum klaim
begin;
update customers c
set points_balance = c.points_balance - x.delta
from (
  select pt.customer_id, sum(pt.points_change) as delta
  from point_transactions pt
  join reward_claims rc on rc.id = pt.reward_claim_id
  join rewards r on r.id = rc.reward_id
  where r.name = 'DUMMY - Air Putih Gratis'
  group by pt.customer_id
) x
where c.id = x.customer_id;
delete from point_transactions
where reward_claim_id in (select rc.id from reward_claims rc join rewards r on r.id = rc.reward_id
                          where r.name = 'DUMMY - Air Putih Gratis');
delete from reward_claims
where reward_id in (select id from rewards where name = 'DUMMY - Air Putih Gratis');
delete from rewards where name = 'DUMMY - Air Putih Gratis';
commit;

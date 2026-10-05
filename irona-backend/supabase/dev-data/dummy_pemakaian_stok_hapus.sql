-- Hapus data contoh pemakaian stok (dummy_pemakaian_stok.sql) dan kembalikan stok
begin;
set local irona.bypass_period_lock = 'on';

create temp table dummy_mv on commit drop as
select sm.id, sm.item_type, sm.raw_material_id, sm.racikan_id, sm.quantity
from stock_movements sm
left join transactions t on t.id = sm.transaction_id
where (sm.movement_type in ('penjualan', 'refund') and t.transaction_number like 'DUMMY-%')
   or (sm.movement_type = 'penyesuaian' and sm.notes like '[DUMMY-AWAL]%');

update raw_materials rm set current_stock = rm.current_stock - x.qty
from (select raw_material_id, sum(quantity) as qty from dummy_mv
      where item_type = 'bahan_baku' group by 1) x
where rm.id = x.raw_material_id;

update racikan r set current_stock = r.current_stock - x.qty
from (select racikan_id, sum(quantity) as qty from dummy_mv
      where item_type = 'racikan' group by 1) x
where r.id = x.racikan_id;

delete from stock_movements where id in (select id from dummy_mv);
commit;

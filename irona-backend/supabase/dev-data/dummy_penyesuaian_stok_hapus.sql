-- Hapus data contoh penyesuaian stok (dummy_penyesuaian_stok.sql) dan kembalikan stok bahan
begin;
set local irona.bypass_period_lock = 'on';
update raw_materials rm
set current_stock = rm.current_stock - x.qty
from (
  select raw_material_id, sum(quantity) as qty
  from stock_movements
  where movement_type = 'penyesuaian' and notes like '[DUMMY]%'
  group by raw_material_id
) x
where rm.id = x.raw_material_id;
delete from stock_movements where movement_type = 'penyesuaian' and notes like '[DUMMY]%';
commit;

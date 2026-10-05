-- ============================================================
-- DATA CONTOH PENYESUAIAN STOK (untuk Laporan Penyesuaian Stok)
-- Menambah beberapa penyesuaian (opname, penyusutan, rusak, hilang, lainnya) pada bahan baku
-- aktif di Agustus–September. Stok bahan ikut berubah seperti penyesuaian sungguhan.
-- Semua catatannya diawali "[DUMMY]". Aman dijalankan ulang (dilewati bila sudah ada).
-- Hapus dengan dummy_penyesuaian_stok_hapus.sql (stok dikembalikan).
-- ============================================================
begin;
set local irona.bypass_period_lock = 'on';

do $$
declare
  v_owner uuid := (select e.id from employees e join roles r on r.id = e.role_id
                   where r.type = 'admin' and e.is_active order by e.full_name limit 1);
  m record;
  i int := 0;
  v_reason text;
  v_qty numeric;
begin
  if exists (select 1 from stock_movements where movement_type = 'penyesuaian' and notes like '[DUMMY]%') then
    raise notice 'Penyesuaian DUMMY sudah ada, dilewati.';
    return;
  end if;

  for m in
    select * from raw_materials where is_active and current_stock > 0 order by name limit 12
  loop
    i := i + 1;
    v_reason := (array['opname', 'penyusutan', 'rusak', 'hilang', 'lainnya', 'opname'])[1 + i % 6];
    -- Kebanyakan berkurang 1–4% stok; opname kadang menambah
    v_qty := round(m.current_stock * (0.01 + (i % 4) * 0.01), 0);
    if v_qty < 1 then v_qty := 1; end if;
    if not (v_reason = 'opname' and i % 2 = 0) then v_qty := -v_qty; end if;

    insert into stock_movements (movement_type, item_type, raw_material_id, quantity, unit_id,
                                 adjustment_reason, notes, movement_date, created_by, created_at)
    values ('penyesuaian', 'bahan_baku', m.id, v_qty, m.base_unit_id, v_reason,
            '[DUMMY] ' || case v_reason
              when 'opname' then 'Selisih hitung fisik akhir minggu'
              when 'penyusutan' then 'Menguap / menyusut di wadah'
              when 'rusak' then 'Kemasan bocor saat disimpan'
              when 'hilang' then 'Tidak ditemukan saat pengecekan'
              else 'Dipakai untuk tester barista' end,
            date '2026-08-05' + (i * 4), v_owner,
            (date '2026-08-05' + (i * 4) + time '21:30') at time zone 'Asia/Jakarta');
  end loop;
end;
$$;

commit;

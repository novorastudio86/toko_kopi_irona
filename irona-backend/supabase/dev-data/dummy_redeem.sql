-- ============================================================
-- DATA CONTOH REDEEM POIN (untuk Laporan Redeem Point)
-- Membuat reward "DUMMY - Air Putih Gratis" (15 poin) lalu klaim oleh member dummy yang
-- poinnya cukup, dengan campuran status: sudah ditukar, dibatalkan, hangus, menunggu.
-- Saldo poin member & riwayat poin ikut diperbarui seperti klaim sungguhan.
-- Jalankan setelah dummy_pelanggan.sql. Aman dijalankan ulang (dilewati bila reward DUMMY sudah ada).
-- Hapus dengan dummy_redeem_hapus.sql.
-- ============================================================
begin;

do $$
declare
  v_reward uuid;
  v_owner uuid := (select e.id from employees e join roles r on r.id = e.role_id
                   where r.type = 'admin' and e.is_active order by e.full_name limit 1);
  c record;
  v_claim uuid;
  v_at timestamptz;
  v_kind int;
  v_code text;
  v_balance int;
  i int := 0;
begin
  if exists (select 1 from rewards where name = 'DUMMY - Air Putih Gratis') then
    raise notice 'Reward DUMMY sudah ada, dilewati.';
    return;
  end if;

  insert into rewards (name, product_id, points_required, stock, notes, created_by)
  values ('DUMMY - Air Putih Gratis', (select id from products order by name limit 1), 15, 50,
          'Data contoh untuk laporan', v_owner)
  returning id into v_reward;

  -- Setiap member dengan poin >= 15 klaim 1–2 kali
  for c in select * from customers where points_balance >= 15 order by points_balance desc loop
    for n in 1..(case when c.points_balance >= 30 then 2 else 1 end) loop
      i := i + 1;
      v_kind := i % 4;   -- 0 menunggu, 1 ditukar, 2 dibatalkan, 3 hangus
      v_at := case when v_kind = 0 then now() - interval '2 hours'
                   else now() - make_interval(days => 2 + (i * 3) % 25, hours => (i * 5) % 10) end;
      v_code := 'DMY' || lpad(i::text, 5, '0');

      insert into reward_claims (reward_id, customer_id, code, points_used, claimed_at, expires_at,
                                 redeemed_at, redeemed_by)
      values (v_reward, c.id, v_code, 15, v_at, v_at + interval '1 day',
              case when v_kind = 1 then v_at + interval '40 minutes' end,
              case when v_kind = 1 then v_owner end)
      returning id into v_claim;

      update customers set points_balance = points_balance - 15 where id = c.id
      returning points_balance into v_balance;
      insert into point_transactions (customer_id, points_change, point_type, notes, balance_after,
                                      reward_claim_id, created_at)
      values (c.id, -15, 'redeem', 'Klaim reward: DUMMY - Air Putih Gratis', v_balance, v_claim, v_at);

      if v_kind = 2 then
        update reward_claims set cancelled_at = v_at + interval '1 hour', cancelled_by = v_owner,
                                 cancel_reason = 'Tidak jadi pesan'
        where id = v_claim;
        update customers set points_balance = points_balance + 15 where id = c.id
        returning points_balance into v_balance;
        insert into point_transactions (customer_id, points_change, point_type, notes, balance_after,
                                        created_by, reward_claim_id, created_at)
        values (c.id, 15, 'redeem_cancel', 'Pembatalan klaim DUMMY - Air Putih Gratis: Tidak jadi pesan',
                v_balance, v_owner, v_claim, v_at + interval '1 hour');
      end if;
    end loop;
  end loop;
end;
$$;

commit;

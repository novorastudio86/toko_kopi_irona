-- ============================================================
-- DATA DUMMY PELANGGAN — KHUSUS DATABASE LOKAL, BUKAN MIGRASI
-- Penanda: no HP diawali 08990000, no transaksi diawali DUMMY-
-- Hapus lagi dengan dummy_pelanggan_hapus.sql
-- ============================================================
begin;
-- Data contoh bertanggal lampau: lewati kunci tutup buku (khusus script dev)
set local irona.bypass_period_lock = 'on';

select setseed(0.42);

-- 10 member
insert into customers (name, phone_number, registered_at, points_balance) values
  ('Rina Kartika',     '0899000001', now() - interval '80 days', 0),
  ('Dimas Pratama',    '0899000002', now() - interval '75 days', 0),
  ('Salsa Nabila',     '0899000003', now() - interval '60 days', 0),
  ('Andi Wijaya',      '0899000004', now() - interval '55 days', 0),
  ('Putri Ayuningtyas','0899000005', now() - interval '50 days', 0),
  ('Fajar Nugroho',    '0899000006', now() - interval '40 days', 0),
  ('Maya Lestari',     '0899000007', now() - interval '30 days', 0),
  ('Bagas Saputra',    '0899000008', now() - interval '20 days', 0),
  ('Nadia Rahma',      '0899000009', now() - interval '10 days', 0),
  ('Yoga Permana',     '0899000010', now() - interval '3 days', 0);   -- member baru, belum transaksi

-- Transaksi: tiap member (kecuali Yoga) 2–8 transaksi dalam 60 hari terakhir
do $$
declare
  c record;
  v_count int;
  v_tx uuid;
  v_date timestamptz;
  v_no int := 0;
  v_items int;
  p record;
  v_qty int;
  v_subtotal numeric;
  v_type text;
begin
  for c in select id, registered_at from customers where phone_number like '08990000%' and phone_number <> '0899000010' loop
    v_count := 2 + floor(random() * 7)::int;
    for i in 1..v_count loop
      v_no := v_no + 1;
      v_type := (array['dine_in', 'take_away', 'online'])[1 + floor(random() * 3)::int];
      v_date := greatest(c.registered_at, now() - interval '60 days')
                + (random() * (now() - greatest(c.registered_at, now() - interval '60 days')));
      insert into transactions (transaction_number, order_type, payment_method, customer_id, employee_id,
                                subtotal, discount_amount, total_amount, status, transaction_date)
      values ('DUMMY-' || lpad(v_no::text, 4, '0'),
              v_type,
              -- pesanan online selalu dibayar QRIS lewat payment gateway
              case when v_type = 'online' then 'qris' else (array['tunai', 'qris'])[1 + floor(random() * 2)::int] end,
              c.id, 'a0000000-0000-0000-0000-000000000001', 0, 0, 0, 'selesai', v_date)
      returning id into v_tx;

      v_subtotal := 0;
      v_items := 1 + floor(random() * 3)::int;
      for p in select id, selling_price from products where selling_price > 0 order by random() limit v_items loop
        v_qty := 1 + floor(random() * 2)::int;
        insert into transaction_items (transaction_id, product_id, quantity, unit_price, line_total)
        values (v_tx, p.id, v_qty, p.selling_price, p.selling_price * v_qty);
        v_subtotal := v_subtotal + p.selling_price * v_qty;
      end loop;

      update transactions set subtotal = v_subtotal, total_amount = v_subtotal where id = v_tx;

      -- 1 poin per Rp10.000 (skema sementara untuk dummy)
      if floor(v_subtotal / 10000) > 0 then
        update customers set points_balance = points_balance + floor(v_subtotal / 10000)::int where id = c.id;
        insert into point_transactions (customer_id, transaction_id, points_change, point_type, notes, balance_after, created_at)
        select c.id, v_tx, floor(v_subtotal / 10000)::int, 'earn', 'Poin dari transaksi',
               points_balance, v_date
        from customers where id = c.id;
      end if;
    end loop;
  end loop;
end $$;

-- Refund sebagian: 1 item dari transaksi pertama Rina, poin transaksinya ditarik balik
do $$
declare
  v_item record;
  v_cust uuid := (select id from customers where phone_number = '0899000001');
  v_pts int;
begin
  select ti.*, t.transaction_date into v_item
  from transaction_items ti join transactions t on t.id = ti.transaction_id
  where t.customer_id = v_cust order by t.transaction_date limit 1;

  update transactions set status = 'refund_sebagian' where id = v_item.transaction_id;
  insert into refunds (transaction_id, transaction_item_id, refund_amount, reason, refunded_by, refunded_at)
  values (v_item.transaction_id, v_item.id, v_item.line_total, 'Salah pesanan (dummy)',
          'a0000000-0000-0000-0000-000000000001', v_item.transaction_date + interval '10 minutes');

  v_pts := least(floor(v_item.line_total / 10000)::int, (select points_balance from customers where id = v_cust));
  if v_pts > 0 then
    update customers set points_balance = points_balance - v_pts where id = v_cust;
    insert into point_transactions (customer_id, transaction_id, points_change, point_type, notes, balance_after, created_at)
    select v_cust, v_item.transaction_id, -v_pts, 'refund_reversal', 'Penyesuaian akibat refund', points_balance,
           v_item.transaction_date + interval '10 minutes'
    from customers where id = v_cust;
  end if;
end $$;

-- Refund penuh: transaksi terakhir Dimas (tidak dihitung di Total Transaksi/Belanja)
update transactions set status = 'refund_penuh'
where id = (select t.id from transactions t join customers c on c.id = t.customer_id
            where c.phone_number = '0899000002' order by t.transaction_date desc limit 1);

-- Redeem reward: Salsa menukar 5 poin
update customers set points_balance = points_balance - 5 where phone_number = '0899000003' and points_balance >= 5;
insert into point_transactions (customer_id, points_change, point_type, notes, balance_after, created_at)
select id, -5, 'redeem', 'Klaim reward: Gratis Es Kopi Susu (dummy)', points_balance, now() - interval '2 days'
from customers where phone_number = '0899000003';

-- Penyesuaian manual oleh admin: Andi +10 poin
update customers set points_balance = points_balance + 10 where phone_number = '0899000004';
insert into point_transactions (customer_id, points_change, point_type, notes, balance_after, created_by, created_at)
select id, 10, 'adjust', 'Kompensasi pesanan terlambat (dummy)', points_balance,
       'a0000000-0000-0000-0000-000000000001', now() - interval '1 day'
from customers where phone_number = '0899000004';

-- Member nonaktif: Fajar
update customers set is_active = false where phone_number = '0899000006';
insert into customer_status_history (customer_id, is_active, reason, changed_by, created_at)
select id, false, 'Nomor tidak aktif, dikonfirmasi via WA (dummy)', 'a0000000-0000-0000-0000-000000000001',
       now() - interval '5 days'
from customers where phone_number = '0899000006';

commit;

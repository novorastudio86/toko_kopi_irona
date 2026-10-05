-- ============================================================
-- DATA CONTOH PESANAN ONLINE MASUK (untuk mencoba halaman Online di Kasir App)
-- Membuat 4 pesanan online hari ini berstatus "masuk" (sudah lunas QRIS Midtrans):
-- 2 dari member, 2 dari tamu (tanpa akun). Boleh dijalankan berkali-kali (tiap kali +4 pesanan).
-- Penanda data contoh: email pemesan berakhiran @dummy.irona.test
-- Hapus dengan dummy_online_masuk_hapus.sql
-- ============================================================
do $$
declare
  v_guests text[][] := array[
    ['Rani', '081234500011', 'Jl. Kaliurang Km 5 No. 12', 'Pagar hijau, sebelah warung'],
    ['Bima', '081234500022', 'Kos Melati, Jl. Pandega Marta No. 9', 'Kamar 7, titip ke penjaga kos'],
    ['Sari', '081234500033', 'Jl. Seturan Raya No. 21', null],
    ['Dodi', '081234500044', 'Perum Griya Asri Blok C-7', 'Rumah cat putih']];
  v_member record;
  v_admin uuid := (select e.id from employees e join roles r on r.id = e.role_id
                   where r.type = 'admin' order by e.created_at limit 1);
  v_tx uuid;
  v_km numeric;
  v_i integer;
  v_g integer;
  v_name text;
  v_phone text;
  v_customer uuid;
begin
  for v_i in 1..4 loop
    v_g := 1 + floor(random() * 4)::int;
    v_customer := null;
    v_name := v_guests[v_g][1];
    v_phone := v_guests[v_g][2];
    if v_i <= 2 then
      select id, name, phone_number into v_member from customers
      where is_active order by random() limit 1;
      if found then
        v_customer := v_member.id;
        v_name := v_member.name;
        v_phone := v_member.phone_number;
      end if;
    end if;
    v_km := round((0.5 + random() * 8)::numeric, 1);

    insert into transactions (transaction_number, order_type, payment_method, customer_id, customer_name,
                              employee_id, customer_phone, customer_email, delivery_address, address_note,
                              delivery_distance_km, delivery_fee, service_fee, online_status, tracking_token,
                              transaction_date)
    values (next_online_order_number(), 'online', 'qris', v_customer, v_name, v_admin, v_phone,
            lower(v_name) || '@dummy.irona.test', v_guests[v_g][3], v_guests[v_g][4], v_km,
            coalesce((select fee from calc_delivery_fee(v_km)), 0),
            (select service_fee from online_order_settings), 'masuk', gen_random_uuid(),
            now() - (v_i * interval '3 minutes'))
    returning id into v_tx;

    -- 1–3 menu acak yang dijual online; harga = harga jual + biaya tambahan Online
    insert into transaction_items (transaction_id, product_id, quantity, unit_price, line_total, notes)
    select v_tx, p.id, q.qty, p.selling_price + c.extra, (p.selling_price + c.extra) * q.qty,
           (array[null, null, 'Less sugar', 'Es dipisah'])[1 + floor(random() * 4)::int]
    from (select * from products
          where is_active and available_online and selling_price is not null
            and category_id in (select id from categories where show_in_menu)
          order by random() limit 1 + floor(random() * 3)::int) p
    cross join lateral (select 1 + floor(random() * 2)::int as qty) q
    cross join lateral (select coalesce((select sum(r.total_cost)
                                         from applicable_order_type_rules(p.id, 'online') r), 0) as extra) c;

    update transactions t set
      subtotal = s.subtotal,
      total_amount = s.subtotal,
      online_price_adjustment = s.adjustment
    from (select sum(i.line_total) as subtotal,
                 sum(i.line_total - p.selling_price * i.quantity) as adjustment
          from transaction_items i join products p on p.id = i.product_id
          where i.transaction_id = v_tx) s
    where t.id = v_tx;

    insert into online_order_events (transaction_id, status, notes)
    values (v_tx, 'masuk', 'Pembayaran QRIS diterima');
  end loop;
end;
$$;

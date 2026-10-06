-- ============================================================
-- DATA CONTOH PESANAN ONLINE MASUK (untuk mencoba halaman Online di Kasir App)
-- Membuat 4 pesanan online hari ini berstatus "masuk" (sudah lunas QRIS Midtrans):
-- 2 dari member, 2 dari tamu (tanpa akun). Boleh dijalankan berkali-kali (tiap kali +4 pesanan).
-- Alamat = desa asli di sekitar toko (Balung, Jember) + titik acak ±400 m di desa itu.
-- Jarak = garis lurus toko → titik antar, selalu 0,5–11 km (batas antar Order Online).
-- Penanda data contoh: email pemesan berakhiran @dummy.irona.test
-- Hapus dengan dummy_online_masuk_hapus.sql
-- ============================================================
do $$
declare
  v_store record;
  v_max_km numeric := (select max_distance_km from online_order_settings);
  v_guests text[][] := array[
    ['Rani', '081234500011'], ['Bima', '081234500022'],
    ['Sari', '081234500033'], ['Dodi', '081234500044']];
  v_notes text[] := array[null, 'Pagar hijau, sebelah warung', 'Rumah cat putih, depan musala',
                          'Titip ke tetangga kalau tidak ada orang', 'Masuk gang kedua dari jalan raya'];
  v_dusun text[] := array['Krajan', 'Karanganyar', 'Sumberejo', 'Kebonsari', 'Tegalrejo', 'Sidomulyo'];
  v_member record;
  v_place record;
  v_admin uuid := (select e.id from employees e join roles r on r.id = e.role_id
                   where r.type = 'admin' order by e.created_at limit 1);
  v_tx uuid;
  v_lat numeric;
  v_lng numeric;
  v_km numeric;
  v_i integer;
  v_g integer;
  v_try integer;
  v_name text;
  v_phone text;
  v_customer uuid;
begin
  select latitude, longitude into v_store from store_settings where id;
  if v_store.latitude is null then
    raise exception 'Titik lokasi toko belum diisi (Web Admin → Data Toko).';
  end if;

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

    -- Desa sekitar toko (titik pusat dari OpenStreetMap); ulangi kalau di luar 0,5–11 km
    v_try := 0;
    loop
      v_try := v_try + 1;
      select * into v_place from (values
        ('Balung Lor', 'Balung', -8.26780, 113.55281), ('Gumelar', 'Balung', -8.25739, 113.54717),
        ('Glundengan', 'Wuluhan', -8.28104, 113.55679), ('Nogosari', 'Rambipuji', -8.25968, 113.56935),
        ('Curahlele', 'Balung', -8.24102, 113.54827), ('Karangsemanding', 'Balung', -8.24439, 113.52117),
        ('Tutul', 'Balung', -8.28467, 113.51866), ('Rowotamtu', 'Rambipuji', -8.23391, 113.57692),
        ('Tamansari', 'Wuluhan', -8.31714, 113.53301), ('Karang Duren', 'Balung', -8.27210, 113.49417),
        ('Sukorejo', 'Bangsalsari', -8.20498, 113.52269), ('Paleran', 'Umbulsari', -8.22984, 113.49134),
        ('Pecoro', 'Rambipuji', -8.20599, 113.58875), ('Wuluhan', 'Wuluhan', -8.33813, 113.55175),
        ('Kaliwining', 'Rambipuji', -8.21927, 113.60900), ('Tegalwangi', 'Umbulsari', -8.25155, 113.47509),
        ('Kesilir', 'Wuluhan', -8.34231, 113.58442), ('Sidomekar', 'Semboro', -8.22381, 113.47632),
        ('Rambipuji', 'Rambipuji', -8.20327, 113.61440), ('Ampel', 'Wuluhan', -8.35564, 113.53571),
        ('Umbulsari', 'Umbulsari', -8.27124, 113.45864), ('Ambulu', 'Ambulu', -8.34504, 113.60576)
      ) as p(village, district, lat, lng)
      order by random() limit 1;
      v_lat := round((v_place.lat + (random() - 0.5) * 0.007)::numeric, 6);
      v_lng := round((v_place.lng + (random() - 0.5) * 0.007)::numeric, 6);
      v_km := round(distance_km(v_store.latitude, v_store.longitude, v_lat, v_lng), 1);
      exit when (v_km between 0.5 and v_max_km) or v_try > 20;
    end loop;

    insert into transactions (transaction_number, order_type, payment_method, customer_id, customer_name,
                              employee_id, customer_phone, customer_email, delivery_address, address_note,
                              delivery_lat, delivery_lng, delivery_distance_km, delivery_fee, service_fee,
                              online_status, tracking_token, transaction_date)
    values (next_online_order_number(), 'online', 'qris', v_customer, v_name, v_admin, v_phone,
            lower(split_part(v_name, ' ', 1)) || floor(random() * 1000)::int || '@dummy.irona.test',
            format('Dusun %s RT %s/RW %s, Desa %s, Kec. %s, Jember',
                   v_dusun[1 + floor(random() * 6)::int], lpad((1 + floor(random() * 6)::int)::text, 3, '0'),
                   lpad((1 + floor(random() * 4)::int)::text, 3, '0'), v_place.village, v_place.district),
            v_notes[1 + floor(random() * 5)::int], v_lat, v_lng, v_km,
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

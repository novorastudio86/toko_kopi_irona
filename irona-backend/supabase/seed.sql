-- ============================================================
-- SEED DATA: Satuan, Bahan Baku, Kategori, Produk + Resep Produk
-- Sumber: hpp_baru_ironaCoffee.csv (data HPP asli Toko Kopi Irona)
-- Kategori pakai daftar asli dari audit Majoo. CSV HPP tidak mencantumkan
-- kategori per produk, jadi kategori ditentukan dari nama produk.
-- ============================================================

-- Seed memuat data bertanggal lampau (mis. aset 2025): lewati kunci tutup buku
-- untuk sesi seed ini saja (lihat migrasi finance_period_close).
set irona.bypass_period_lock = 'on';

-- Seed akun Admin/Owner pertama (owner1 / TestPass123!) — biar nggak perlu bikin manual tiap db reset
do $$
declare
  admin_user_id uuid := 'a0000000-0000-0000-0000-000000000001';
  admin_role_id uuid;
begin
  select id into admin_role_id from public.roles where type = 'admin' limit 1;

  if not exists (select 1 from auth.users where id = admin_user_id) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      admin_user_id,
      'authenticated',
      'authenticated',
      'owner1@irona.internal',
      crypt('TestPass123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      admin_user_id::text,
      admin_user_id,
      format('{"sub":"%s","email":"%s"}', admin_user_id, 'owner1@irona.internal')::jsonb,
      'email',
      now(), now(), now()
    );
  end if;

  if not exists (select 1 from public.employees where id = admin_user_id) then
    insert into public.employees (id, username, full_name, phone_number, role_id, is_active)
    values (admin_user_id, 'owner1', 'Budi Owner', '081234567890', admin_role_id, true);
  end if;
end $$;

insert into public.roles (name, type) values
  ('Kasir', 'kasir'),
  ('Driver', 'driver'),
  ('Barista', 'kasir')
on conflict (name) do nothing;

-- Satuan


insert into public.units (id, name) values ('6fc3bddf-2dcc-540d-a8d8-60010f60cb00', 'gr');
insert into public.units (id, name) values ('05774b34-444d-5c35-af15-67ffa120d4de', 'ml');
insert into public.units (id, name) values ('85177af5-f652-5bec-928b-9e3c34b9c77c', 'pcs');

-- Kategori (9 kategori asli dari audit Majoo; kategori 'filter' di audit
-- diduga typo staf, sengaja tidak diseed)
insert into public.categories (id, name, display_order, show_in_menu, show_online) values ('2ab17d26-75eb-52fa-afd4-d280d9374616', 'ADD ON', 1, true, false);
insert into public.categories (id, name, display_order, show_in_menu, show_online) values ('62c0265e-c7d7-561b-9554-3b190be4d557', 'BASIC COFFEE', 2, true, false);
insert into public.categories (id, name, display_order, show_in_menu, show_online) values ('104aa674-3472-5e9e-9b12-6602358955fe', 'AMERICANO BASED', 3, true, false);
insert into public.categories (id, name, display_order, show_in_menu, show_online) values ('4a3d1dbb-36ae-5c5a-abf1-91b4ad082f35', 'COKLAT BASED', 4, true, false);
insert into public.categories (id, name, display_order, show_in_menu, show_online) values ('a82fd850-e5b0-554a-a365-9aefd634aa9b', 'TEA BASED', 5, true, false);
insert into public.categories (id, name, display_order, show_in_menu, show_online) values ('ec176052-6a73-53c6-b495-9f8d7b9e6f23', 'ICE COFFEE', 6, true, false);
insert into public.categories (id, name, display_order, show_in_menu, show_online) values ('23d3876c-a53e-544f-88df-ef917f31d142', 'MATCHA BASED', 7, true, false);
insert into public.categories (id, name, display_order, show_in_menu, show_online) values ('f0f8c12f-f47b-534b-b755-cb296e69eb57', 'APPETIZER', 8, true, false);
insert into public.categories (id, name, display_order, show_in_menu, show_online) values ('6140f072-c035-5927-a848-9f651bc1d9ac', 'MAIN COURSE', 9, true, false);

-- Bahan Baku (dari kolom Code/INGREDIENTS/UNIT/PRICE di CSV)
-- material_type diasumsikan 'tetap' untuk semua -- CSV tidak menandai
-- mana yang 'Bahan Menyusut', perlu ditinjau ulang manual per item.
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('1036880a-16c2-5823-af87-f1c7c2f77b0d', 'beans good tbrk', 'tetap', '6fc3bddf-2dcc-540d-a8d8-60010f60cb00', 182.0, 0, true); -- Code asli: BB001
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('daca4832-dc4f-509b-85d6-7a70166e61f8', 'Coffee Beans Blend bob mona (TBRK)', 'tetap', '6fc3bddf-2dcc-540d-a8d8-60010f60cb00', 333.0, 0, true); -- Code asli: BB002
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('fda89241-fa4b-52e1-9562-c2aa9e56f688', 'Coffee Beans Arabica', 'tetap', '6fc3bddf-2dcc-540d-a8d8-60010f60cb00', 675.0, 0, true); -- Code asli: BB003
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('3b1458df-05a5-5636-986d-f074692e1647', 'beans good cair', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 1870.0, 0, true); -- Code asli: BB004
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('b53a0445-d1e4-5f35-99b5-1583c7116027', 'beans 70''s champoan', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 210.0, 0, true); -- Code asli: BB005
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('a100bdf4-913d-55d3-b12e-84d2a0438d59', 'Labore Rum', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 85.0, 0, true); -- Code asli: BB011
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('93e7d04c-f8de-5259-91d2-541be2e4607f', 'Labore Butterscotch', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 85.0, 0, true); -- Code asli: BB012
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('46f1eee2-886f-5a82-ace9-5c0a8522a7df', 'Labore Baileys', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 85.0, 0, true); -- Code asli: BB013
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('62e2748a-135a-588c-a602-026b3bbf7f51', 'Labore Caramel', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 85.0, 0, true); -- Code asli: BB014
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('9320ce51-9034-59cd-9498-c1e8d1b7a3dd', 'Labore Hazelnut', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 85.0, 0, true); -- Code asli: BB015
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('e9328f32-d2a8-5c25-a29f-83e34633b702', 'Pistachio', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 146.0, 0, true); -- Code asli: BB016
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('90df09a0-dbff-5c14-9f82-7d8320c3fbfd', 'Vanilla', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 47.0, 0, true); -- Code asli: BB017
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('4977413e-33fb-535c-95af-a7589d153a20', 'Gula Aren', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 63.0, 0, true); -- Code asli: BB019
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('2254ae58-90c2-51c9-904f-e98346248a8c', 'pulpy', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 16.0, 0, true); -- Code asli: BB021
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('9a703cd7-c828-58bc-b3f6-85c6d619a62c', 'Creamer Avy Cair', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 503.0, 0, true); -- Code asli: BB028
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('2940adb8-6925-5932-8338-005c9b985064', 'GreenField', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 20.0, 0, true); -- Code asli: BB030
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('af69f638-7b58-5b5a-944a-4e66333d01f8', 'wipped cream cair', 'tetap', '6fc3bddf-2dcc-540d-a8d8-60010f60cb00', 105.0, 0, true); -- Code asli: BB035
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('edd5487d-872f-5292-b382-c660963a5d86', 'Air Aqua', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 1.0, 0, true); -- Code asli: BB044
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('f202263a-4b29-50c6-8ac2-3c053478252b', 'SKM', 'tetap', '6fc3bddf-2dcc-540d-a8d8-60010f60cb00', 22.0, 0, true); -- Code asli: BB045
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('48ee7de2-40cd-5ecf-a6bf-2efc9fcd400e', 'Gula', 'tetap', '6fc3bddf-2dcc-540d-a8d8-60010f60cb00', 18.0, 0, true); -- Code asli: BB046
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('fc344281-c0d2-5cf0-9b84-848c2b6509d1', 'Es Batu', 'tetap', '6fc3bddf-2dcc-540d-a8d8-60010f60cb00', 1.0, 0, true); -- Code asli: BB047
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('3c76dd05-f098-5106-9c44-f8d09adb4aad', 'Sedotan', 'tetap', '85177af5-f652-5bec-928b-9e3c34b9c77c', 46.0, 0, true); -- Code asli: BB048
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('bd410122-cf10-5a38-8b93-5a2ee8b599ad', 'Paper Filter', 'tetap', '85177af5-f652-5bec-928b-9e3c34b9c77c', 700.0, 0, true); -- Code asli: BB049
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('eeac9c5f-4fa8-5aa7-a1fc-fd5e2a3f8158', 'Sprite', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 17.0, 0, true); -- Code asli: BB050
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('8b660e64-1fbc-5991-81d1-d9fd3d074536', 'cup plastik', 'tetap', '85177af5-f652-5bec-928b-9e3c34b9c77c', 850.0, 0, true); -- Code asli: BB051
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('9b0e8c81-19d3-5c5a-8778-e20cd368f806', 'SUNKUIQ', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 44.0, 0, true); -- Code asli: BB053
insert into public.raw_materials (id, name, material_type, base_unit_id, unit_price, current_stock, is_active) values ('db8749aa-9fdb-541c-bb11-fb7fe8e95c7f', 'BUTTERFLY RUM', 'tetap', '05774b34-444d-5c35-af15-67ffa120d4de', 167.0, 0, true); -- Code asli: BB054

-- Produk (unit = 'porsi', sesuai pola YIELD...PORTION di tiap block CSV)
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('7470df07-f584-5ea7-919c-aab48503dc64', 'ESPRESSO', '62c0265e-c7d7-561b-9554-3b190be4d557', 'porsi', 'IRN-BAS-01', true, false, 'lengkap', 3376.0, 20.0, 4051.2, 30.0, 13504.0, 13000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('fec3dc8a-d329-56ee-bb38-f6fd2cca2c49', 'Latte Hot', '62c0265e-c7d7-561b-9554-3b190be4d557', 'porsi', 'IRN-BAS-02', true, false, 'lengkap', 5202.0, 20.0, 6242.4, 30.0, 20808.0, 20000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('7d2f9549-6540-5602-88e3-684860d59263', 'AMERICANO HOT', '104aa674-3472-5e9e-9b12-6602358955fe', 'porsi', 'IRN-AME-01', true, false, 'lengkap', 3930.0, 20.0, 4716.0, 30.0, 15720.0, 16000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('b61125ca-27d0-556d-b2aa-06e9f5a71704', 'AMERICANO ICE', '104aa674-3472-5e9e-9b12-6602358955fe', 'porsi', 'IRN-AME-02', true, false, 'lengkap', 4066.0, 20.0, 4879.2, 30.0, 16264.0, null, false);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('34607233-9b32-5d5a-8b0b-bea5d2b3e0e3', 'SPLIT', '62c0265e-c7d7-561b-9554-3b190be4d557', 'porsi', 'IRN-BAS-03', true, false, 'lengkap', 6980.0, 10.0, 7678.0, 30.0, 25593.33, 28000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('9c1b3a62-552f-544d-900f-c3124e904405', 'MAGIC LATTE', '62c0265e-c7d7-561b-9554-3b190be4d557', 'porsi', 'IRN-BAS-04', true, false, 'lengkap', 9394.0, 20.0, 11272.8, 30.0, 37576.0, 28000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('9002a9f7-9468-5b0e-9eb8-886e2b9b1d24', 'ARABICA TUBRUK', '62c0265e-c7d7-561b-9554-3b190be4d557', 'porsi', 'IRN-BAS-05', true, false, 'lengkap', 1606.0, 20.0, 1927.2, 30.0, 6424.0, 10000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('f7f731dd-98b3-5e15-a3ba-3980ea1496b3', 'ARABICA FILTER HOT', '62c0265e-c7d7-561b-9554-3b190be4d557', 'porsi', 'IRN-BAS-06', true, false, 'lengkap', 9675.0, 10.0, 10642.5, 30.0, 35475.0, 22000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('779693c4-cde0-5878-b41a-9ce860327dc4', 'ARABICA FILTER JAPANESE', '62c0265e-c7d7-561b-9554-3b190be4d557', 'porsi', 'IRN-BAS-07', true, false, 'lengkap', 11095.0, 10.0, 12204.5, 30.0, 40681.67, 25000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('1c89595f-a625-5875-ad49-296f2dcbf221', 'ES KOPI SUSU RUM', 'ec176052-6a73-53c6-b495-9f8d7b9e6f23', 'porsi', 'IRN-ICE-01', true, false, 'lengkap', 4714.23, 20.0, 5657.07, 30.0, 18856.91, 18000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('6064e70a-ba29-5211-a92b-33525e9ea34d', 'ES KOPI SUSU IRONA', 'ec176052-6a73-53c6-b495-9f8d7b9e6f23', 'porsi', 'IRN-ICE-02', true, false, 'lengkap', 3983.23, 20.0, 4779.87, 30.0, 15932.91, 10000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('1e50f184-3aa9-508f-8470-21ae8c93a858', 'ES KOPI SUSU BAILEYS', 'ec176052-6a73-53c6-b495-9f8d7b9e6f23', 'porsi', 'IRN-ICE-03', true, false, 'lengkap', 4289.23, 10.0, 5147.07, 30.0, 17156.91, 18000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('d945e31c-4138-526c-8f79-17d74c0a2306', 'ES KOPI SUSU BUTTERSCOTCH', 'ec176052-6a73-53c6-b495-9f8d7b9e6f23', 'porsi', 'IRN-ICE-04', true, false, 'lengkap', 4709.23, 20.0, 5651.07, 20.0, 28255.36, 20000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('63607ae9-40d5-53c7-8faf-b11049f858bd', 'ES KOPI SUSU CARAMEL', 'ec176052-6a73-53c6-b495-9f8d7b9e6f23', 'porsi', 'IRN-ICE-05', true, false, 'lengkap', 4840.23, 10.0, 5808.27, 30.0, 19360.91, 18000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('0a2ab3d9-3834-5ab2-8eb6-9237682c80ca', 'ES KOPI SUSU GULA AREN', 'ec176052-6a73-53c6-b495-9f8d7b9e6f23', 'porsi', 'IRN-ICE-06', true, false, 'lengkap', 4515.23, 10.0, 5418.27, 30.0, 18060.91, 16000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('9d4b986e-170e-58a1-8b2f-e18ca4ef60b5', 'ES KOPI SUSU PISTACHIO', 'ec176052-6a73-53c6-b495-9f8d7b9e6f23', 'porsi', 'IRN-ICE-07', true, false, 'lengkap', 6069.75, 10.0, 6676.73, 30.0, 22255.76, 18000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('287bf069-9312-5057-aa47-dd50748549ba', 'ES KOPI SUSU HAZELNUT', 'ec176052-6a73-53c6-b495-9f8d7b9e6f23', 'porsi', 'IRN-ICE-08', true, false, 'lengkap', 4714.23, 10.0, 5657.07, 30.0, 18856.91, 18000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('f4c5094f-79dd-5b7f-9284-6f0cae7f124a', 'Latte Ice', '62c0265e-c7d7-561b-9554-3b190be4d557', 'porsi', 'IRN-BAS-08', true, false, 'lengkap', 5816.0, 10.0, 6397.6, 30.0, 21325.33, 20000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('d656d26d-e27d-5bda-a284-f42ec76423c8', 'AMERICANO RUM', '104aa674-3472-5e9e-9b12-6602358955fe', 'porsi', 'IRN-AME-03', true, false, 'lengkap', 6104.67, 20.0, 7325.6, 30.0, 24418.67, 21000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('546231b0-911c-5f69-8ec2-f1a5992a5aca', 'SUNKIST', '104aa674-3472-5e9e-9b12-6602358955fe', 'porsi', 'IRN-AME-04', true, false, 'lengkap', 5255.43, 20.0, 6306.51, 30.0, 21021.71, 20000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('af0b4ae9-4e91-587f-86f6-a7cde1d6b95c', 'AMERICANO LECCY', '104aa674-3472-5e9e-9b12-6602358955fe', 'porsi', 'IRN-AME-05', true, false, 'lengkap', 4089.09, 20.0, 4906.9, 30.0, 16356.35, 19000.0, true);
insert into public.products (id, name, category_id, unit, sku, available_offline, available_online, recipe_status, cost, add_cost_percentage, base_cost, desired_cost_percentage, recommended_selling_price, selling_price, is_active) values ('aad1a6dc-3849-52b7-847c-6c8f625b25f4', 'AMERICANO APPLE', '104aa674-3472-5e9e-9b12-6602358955fe', 'porsi', 'IRN-AME-06', true, false, 'lengkap', 4999.03, 20.0, 5998.83, 30.0, 19996.11, 19000.0, true);

-- Resep Produk (komponen Bahan Baku per produk)
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('7470df07-f584-5ea7-919c-aab48503dc64', 'bahan_baku', '1036880a-16c2-5823-af87-f1c7c2f77b0d', 18.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('7470df07-f584-5ea7-919c-aab48503dc64', 'bahan_baku', 'edd5487d-872f-5292-b382-c660963a5d86', 100.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('fec3dc8a-d329-56ee-bb38-f6fd2cca2c49', 'bahan_baku', 'b53a0445-d1e4-5f35-99b5-1583c7116027', 9.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('fec3dc8a-d329-56ee-bb38-f6fd2cca2c49', 'bahan_baku', '2940adb8-6925-5932-8338-005c9b985064', 160.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('fec3dc8a-d329-56ee-bb38-f6fd2cca2c49', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 80.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('7d2f9549-6540-5602-88e3-684860d59263', 'bahan_baku', 'b53a0445-d1e4-5f35-99b5-1583c7116027', 18.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('7d2f9549-6540-5602-88e3-684860d59263', 'bahan_baku', 'edd5487d-872f-5292-b382-c660963a5d86', 150.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('b61125ca-27d0-556d-b2aa-06e9f5a71704', 'bahan_baku', 'b53a0445-d1e4-5f35-99b5-1583c7116027', 18.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('b61125ca-27d0-556d-b2aa-06e9f5a71704', 'bahan_baku', 'edd5487d-872f-5292-b382-c660963a5d86', 100.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('b61125ca-27d0-556d-b2aa-06e9f5a71704', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 100.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('b61125ca-27d0-556d-b2aa-06e9f5a71704', 'bahan_baku', '3c76dd05-f098-5106-9c44-f8d09adb4aad', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('34607233-9b32-5d5a-8b0b-bea5d2b3e0e3', 'bahan_baku', 'b53a0445-d1e4-5f35-99b5-1583c7116027', 18.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('34607233-9b32-5d5a-8b0b-bea5d2b3e0e3', 'bahan_baku', '2940adb8-6925-5932-8338-005c9b985064', 160.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('9c1b3a62-552f-544d-900f-c3124e904405', 'bahan_baku', 'daca4832-dc4f-509b-85d6-7a70166e61f8', 18.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('9c1b3a62-552f-544d-900f-c3124e904405', 'bahan_baku', '2940adb8-6925-5932-8338-005c9b985064', 170.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('9002a9f7-9468-5b0e-9eb8-886e2b9b1d24', 'bahan_baku', '1036880a-16c2-5823-af87-f1c7c2f77b0d', 8.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('9002a9f7-9468-5b0e-9eb8-886e2b9b1d24', 'bahan_baku', 'edd5487d-872f-5292-b382-c660963a5d86', 150.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('f7f731dd-98b3-5e15-a3ba-3980ea1496b3', 'bahan_baku', 'fda89241-fa4b-52e1-9562-c2aa9e56f688', 13.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('f7f731dd-98b3-5e15-a3ba-3980ea1496b3', 'bahan_baku', 'bd410122-cf10-5a38-8b93-5a2ee8b599ad', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('f7f731dd-98b3-5e15-a3ba-3980ea1496b3', 'bahan_baku', 'edd5487d-872f-5292-b382-c660963a5d86', 200.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('779693c4-cde0-5878-b41a-9ce860327dc4', 'bahan_baku', 'fda89241-fa4b-52e1-9562-c2aa9e56f688', 15.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('779693c4-cde0-5878-b41a-9ce860327dc4', 'bahan_baku', 'bd410122-cf10-5a38-8b93-5a2ee8b599ad', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('779693c4-cde0-5878-b41a-9ce860327dc4', 'bahan_baku', 'edd5487d-872f-5292-b382-c660963a5d86', 130.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('779693c4-cde0-5878-b41a-9ce860327dc4', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 100.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1c89595f-a625-5875-ad49-296f2dcbf221', 'bahan_baku', '3b1458df-05a5-5636-986d-f074692e1647', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1c89595f-a625-5875-ad49-296f2dcbf221', 'bahan_baku', '9a703cd7-c828-58bc-b3f6-85c6d619a62c', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1c89595f-a625-5875-ad49-296f2dcbf221', 'bahan_baku', '2940adb8-6925-5932-8338-005c9b985064', 60.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1c89595f-a625-5875-ad49-296f2dcbf221', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 100.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1c89595f-a625-5875-ad49-296f2dcbf221', 'bahan_baku', 'a100bdf4-913d-55d3-b12e-84d2a0438d59', 10.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1c89595f-a625-5875-ad49-296f2dcbf221', 'bahan_baku', '3c76dd05-f098-5106-9c44-f8d09adb4aad', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1c89595f-a625-5875-ad49-296f2dcbf221', 'bahan_baku', 'af69f638-7b58-5b5a-944a-4e66333d01f8', 1.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('6064e70a-ba29-5211-a92b-33525e9ea34d', 'bahan_baku', '3b1458df-05a5-5636-986d-f074692e1647', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('6064e70a-ba29-5211-a92b-33525e9ea34d', 'bahan_baku', '9a703cd7-c828-58bc-b3f6-85c6d619a62c', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('6064e70a-ba29-5211-a92b-33525e9ea34d', 'bahan_baku', '2940adb8-6925-5932-8338-005c9b985064', 60.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('6064e70a-ba29-5211-a92b-33525e9ea34d', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 100.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('6064e70a-ba29-5211-a92b-33525e9ea34d', 'bahan_baku', 'f202263a-4b29-50c6-8ac2-3c053478252b', 10.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('6064e70a-ba29-5211-a92b-33525e9ea34d', 'bahan_baku', '3c76dd05-f098-5106-9c44-f8d09adb4aad', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1e50f184-3aa9-508f-8470-21ae8c93a858', 'bahan_baku', '3b1458df-05a5-5636-986d-f074692e1647', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1e50f184-3aa9-508f-8470-21ae8c93a858', 'bahan_baku', '9a703cd7-c828-58bc-b3f6-85c6d619a62c', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1e50f184-3aa9-508f-8470-21ae8c93a858', 'bahan_baku', '2940adb8-6925-5932-8338-005c9b985064', 60.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1e50f184-3aa9-508f-8470-21ae8c93a858', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 100.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1e50f184-3aa9-508f-8470-21ae8c93a858', 'bahan_baku', '46f1eee2-886f-5a82-ace9-5c0a8522a7df', 5.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1e50f184-3aa9-508f-8470-21ae8c93a858', 'bahan_baku', '8b660e64-1fbc-5991-81d1-d9fd3d074536', 0.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1e50f184-3aa9-508f-8470-21ae8c93a858', 'bahan_baku', '3c76dd05-f098-5106-9c44-f8d09adb4aad', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('1e50f184-3aa9-508f-8470-21ae8c93a858', 'bahan_baku', 'af69f638-7b58-5b5a-944a-4e66333d01f8', 1.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d945e31c-4138-526c-8f79-17d74c0a2306', 'bahan_baku', '3b1458df-05a5-5636-986d-f074692e1647', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d945e31c-4138-526c-8f79-17d74c0a2306', 'bahan_baku', '9a703cd7-c828-58bc-b3f6-85c6d619a62c', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d945e31c-4138-526c-8f79-17d74c0a2306', 'bahan_baku', '2940adb8-6925-5932-8338-005c9b985064', 60.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d945e31c-4138-526c-8f79-17d74c0a2306', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 100.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d945e31c-4138-526c-8f79-17d74c0a2306', 'bahan_baku', '93e7d04c-f8de-5259-91d2-541be2e4607f', 5.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d945e31c-4138-526c-8f79-17d74c0a2306', 'bahan_baku', '8b660e64-1fbc-5991-81d1-d9fd3d074536', 0.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d945e31c-4138-526c-8f79-17d74c0a2306', 'bahan_baku', '3c76dd05-f098-5106-9c44-f8d09adb4aad', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d945e31c-4138-526c-8f79-17d74c0a2306', 'bahan_baku', 'af69f638-7b58-5b5a-944a-4e66333d01f8', 5.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('63607ae9-40d5-53c7-8faf-b11049f858bd', 'bahan_baku', '3b1458df-05a5-5636-986d-f074692e1647', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('63607ae9-40d5-53c7-8faf-b11049f858bd', 'bahan_baku', '9a703cd7-c828-58bc-b3f6-85c6d619a62c', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('63607ae9-40d5-53c7-8faf-b11049f858bd', 'bahan_baku', '2940adb8-6925-5932-8338-005c9b985064', 60.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('63607ae9-40d5-53c7-8faf-b11049f858bd', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 100.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('63607ae9-40d5-53c7-8faf-b11049f858bd', 'bahan_baku', '62e2748a-135a-588c-a602-026b3bbf7f51', 10.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('63607ae9-40d5-53c7-8faf-b11049f858bd', 'bahan_baku', '8b660e64-1fbc-5991-81d1-d9fd3d074536', 0.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('63607ae9-40d5-53c7-8faf-b11049f858bd', 'bahan_baku', '3c76dd05-f098-5106-9c44-f8d09adb4aad', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('63607ae9-40d5-53c7-8faf-b11049f858bd', 'bahan_baku', 'af69f638-7b58-5b5a-944a-4e66333d01f8', 1.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('63607ae9-40d5-53c7-8faf-b11049f858bd', 'bahan_baku', '4977413e-33fb-535c-95af-a7589d153a20', 2.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('0a2ab3d9-3834-5ab2-8eb6-9237682c80ca', 'bahan_baku', '3b1458df-05a5-5636-986d-f074692e1647', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('0a2ab3d9-3834-5ab2-8eb6-9237682c80ca', 'bahan_baku', '9a703cd7-c828-58bc-b3f6-85c6d619a62c', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('0a2ab3d9-3834-5ab2-8eb6-9237682c80ca', 'bahan_baku', '2940adb8-6925-5932-8338-005c9b985064', 60.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('0a2ab3d9-3834-5ab2-8eb6-9237682c80ca', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 100.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('0a2ab3d9-3834-5ab2-8eb6-9237682c80ca', 'bahan_baku', '4977413e-33fb-535c-95af-a7589d153a20', 12.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('0a2ab3d9-3834-5ab2-8eb6-9237682c80ca', 'bahan_baku', '3c76dd05-f098-5106-9c44-f8d09adb4aad', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('9d4b986e-170e-58a1-8b2f-e18ca4ef60b5', 'bahan_baku', '3b1458df-05a5-5636-986d-f074692e1647', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('9d4b986e-170e-58a1-8b2f-e18ca4ef60b5', 'bahan_baku', '9a703cd7-c828-58bc-b3f6-85c6d619a62c', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('9d4b986e-170e-58a1-8b2f-e18ca4ef60b5', 'bahan_baku', '2940adb8-6925-5932-8338-005c9b985064', 60.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('9d4b986e-170e-58a1-8b2f-e18ca4ef60b5', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 100.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('9d4b986e-170e-58a1-8b2f-e18ca4ef60b5', 'bahan_baku', 'e9328f32-d2a8-5c25-a29f-83e34633b702', 10.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('9d4b986e-170e-58a1-8b2f-e18ca4ef60b5', 'bahan_baku', '8b660e64-1fbc-5991-81d1-d9fd3d074536', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('9d4b986e-170e-58a1-8b2f-e18ca4ef60b5', 'bahan_baku', '3c76dd05-f098-5106-9c44-f8d09adb4aad', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('287bf069-9312-5057-aa47-dd50748549ba', 'bahan_baku', '3b1458df-05a5-5636-986d-f074692e1647', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('287bf069-9312-5057-aa47-dd50748549ba', 'bahan_baku', '9a703cd7-c828-58bc-b3f6-85c6d619a62c', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('287bf069-9312-5057-aa47-dd50748549ba', 'bahan_baku', '2940adb8-6925-5932-8338-005c9b985064', 60.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('287bf069-9312-5057-aa47-dd50748549ba', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 100.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('287bf069-9312-5057-aa47-dd50748549ba', 'bahan_baku', '9320ce51-9034-59cd-9498-c1e8d1b7a3dd', 10.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('287bf069-9312-5057-aa47-dd50748549ba', 'bahan_baku', '8b660e64-1fbc-5991-81d1-d9fd3d074536', 0.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('287bf069-9312-5057-aa47-dd50748549ba', 'bahan_baku', '3c76dd05-f098-5106-9c44-f8d09adb4aad', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('287bf069-9312-5057-aa47-dd50748549ba', 'bahan_baku', 'af69f638-7b58-5b5a-944a-4e66333d01f8', 1.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('f4c5094f-79dd-5b7f-9284-6f0cae7f124a', 'bahan_baku', '1036880a-16c2-5823-af87-f1c7c2f77b0d', 18.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('f4c5094f-79dd-5b7f-9284-6f0cae7f124a', 'bahan_baku', '2940adb8-6925-5932-8338-005c9b985064', 120.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('f4c5094f-79dd-5b7f-9284-6f0cae7f124a', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 100.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d656d26d-e27d-5bda-a284-f42ec76423c8', 'bahan_baku', 'a100bdf4-913d-55d3-b12e-84d2a0438d59', 10.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d656d26d-e27d-5bda-a284-f42ec76423c8', 'bahan_baku', '1036880a-16c2-5823-af87-f1c7c2f77b0d', 18.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d656d26d-e27d-5bda-a284-f42ec76423c8', 'bahan_baku', 'eeac9c5f-4fa8-5aa7-a1fc-fd5e2a3f8158', 100.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d656d26d-e27d-5bda-a284-f42ec76423c8', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 80.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('d656d26d-e27d-5bda-a284-f42ec76423c8', 'bahan_baku', 'db8749aa-9fdb-541c-bb11-fb7fe8e95c7f', 1.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('546231b0-911c-5f69-8ec2-f1a5992a5aca', 'bahan_baku', '1036880a-16c2-5823-af87-f1c7c2f77b0d', 18.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('546231b0-911c-5f69-8ec2-f1a5992a5aca', 'bahan_baku', '2254ae58-90c2-51c9-904f-e98346248a8c', 100.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('546231b0-911c-5f69-8ec2-f1a5992a5aca', 'bahan_baku', '9b0e8c81-19d3-5c5a-8778-e20cd368f806', 5.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('546231b0-911c-5f69-8ec2-f1a5992a5aca', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 80.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('546231b0-911c-5f69-8ec2-f1a5992a5aca', 'bahan_baku', '3c76dd05-f098-5106-9c44-f8d09adb4aad', 1.0, '85177af5-f652-5bec-928b-9e3c34b9c77c');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('af0b4ae9-4e91-587f-86f6-a7cde1d6b95c', 'bahan_baku', '1036880a-16c2-5823-af87-f1c7c2f77b0d', 18.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('af0b4ae9-4e91-587f-86f6-a7cde1d6b95c', 'bahan_baku', '90df09a0-dbff-5c14-9f82-7d8320c3fbfd', 15.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('af0b4ae9-4e91-587f-86f6-a7cde1d6b95c', 'bahan_baku', 'fc344281-c0d2-5cf0-9b84-848c2b6509d1', 80.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('aad1a6dc-3849-52b7-847c-6c8f625b25f4', 'bahan_baku', '1036880a-16c2-5823-af87-f1c7c2f77b0d', 18.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('aad1a6dc-3849-52b7-847c-6c8f625b25f4', 'bahan_baku', 'e9328f32-d2a8-5c25-a29f-83e34633b702', 10.0, '05774b34-444d-5c35-af15-67ffa120d4de');
insert into public.product_recipe_components (product_id, component_type, raw_material_id, quantity, unit_id) values ('aad1a6dc-3849-52b7-847c-6c8f625b25f4', 'bahan_baku', '48ee7de2-40cd-5ecf-a6bf-2efc9fcd400e', 15.0, '6fc3bddf-2dcc-540d-a8d8-60010f60cb00');

-- Icon kategori (key sesuai src/constants/categoryIcons.ts)
update public.categories set icon = case name
  when 'BASIC COFFEE'    then 'coffee-cup'
  when 'AMERICANO BASED' then 'coffee-cup'
  when 'COKLAT BASED'    then 'coffee-cup'
  when 'ICE COFFEE'      then 'iced-coffee'
  when 'TEA BASED'       then 'tea'
  when 'MATCHA BASED'    then 'tea'
  when 'APPETIZER'       then 'pastry'
  when 'MAIN COURSE'     then 'main-course'
  when 'ADD ON'          then 'add-on'
  else icon
end
where icon is null;

-- Visibilitas kategori di Web Customer, mengikuti frame "Kategori Menu Online"
update public.categories
set show_online = true
where name in ('BASIC COFFEE', 'AMERICANO BASED', 'TEA BASED', 'ICE COFFEE', 'MATCHA BASED', 'APPETIZER', 'MAIN COURSE');

-- Tidak tampil sebagai tab di Web Customer
update public.categories
set show_online = false
where name = 'ADD ON';

-- Jenis bahan: satuan gr/ml dipakai sebagian per porsi (menyusut),
-- satuan pcs dipakai utuh per porsi (tetap)
update public.raw_materials rm
set material_type = case when u.name in ('gr', 'ml') then 'menyusut' else 'tetap' end
from public.units u
where u.id = rm.base_unit_id;

-- ============================================================
-- DATA CONTOH DEVELOPMENT — jangan dibawa ke production
-- Tujuan: memunculkan semua kondisi tampilan di Daftar Produk
-- ============================================================

-- 1. Produk contoh untuk tiap kondisi
insert into public.products (
  name, category_id, unit, sku, available_offline, available_online,
  recipe_status, base_cost, add_cost_percentage, selling_price, is_active, deactivated_manually
)
select
  v.name, c.id, v.unit, v.sku, v.offline, v.online,
  v.status, v.base_cost, 0, v.price, v.active, v.manual
from (values
  ('Croissant Almond Butter', 'APPETIZER',    'pcs', 'IRN-APP-01',   true,  false, 'belum_lengkap', null::numeric, null::numeric, false, false),
  ('Mineral Water 600ml',     'ADD ON',       'botol', 'IRN-ADD-01', true,  true,  'tanpa_resep',   4000,          10000,         true,  false),
  ('Nasi Ayam Sambal Matah',  'MAIN COURSE',  'porsi', 'IRN-MAI-01', true,  true,  'tanpa_resep',   12000,         32000,         true,  false),
  ('Matcha Latte Uji',        'MATCHA BASED', 'cup', 'IRN-MAT-01',   true,  false, 'tanpa_resep',   6000,          24000,         false, true),
  ('Cookies Box Online',      'APPETIZER',    'box', 'IRN-APP-02',   false, true,  'tanpa_resep',   15000,         35000,         true,  false)
) as v(name, category, unit, sku, offline, online, status, base_cost, price, active, manual)
join public.categories c on c.name = v.category
on conflict (name) do nothing;

-- 2. Produk HPP dibuat berselang-seling: separuh Online + Offline, separuh Offline saja
with ranked as (
  select id, row_number() over (order by name) as rn
  from public.products
  where name not in (
    'Croissant Almond Butter', 'Mineral Water 600ml', 'Nasi Ayam Sambal Matah',
    'Matcha Latte Uji', 'Cookies Box Online'
  )
)
update public.products p
set available_online = (r.rn % 2 = 1)
from ranked r
where p.id = r.id;

-- ============================================================
-- DATA CONTOH DEVELOPMENT — stok bahan baku & produk resep belum diisi
-- ============================================================

-- 1. Stok & alert minimum untuk semua bahan baku
--    (langsung diubah untuk keperluan development; aslinya lewat Stok Masuk di Kelola Stok)
update public.raw_materials rm
set current_stock = case when u.name = 'pcs' then 200 else 5000 end,
    min_stock_alert = case when u.name = 'pcs' then 20 else 500 end
from public.units u
where u.id = rm.base_unit_id;

-- 2. Dua bahan yang paling sedikit dipakai resep dibuat menipis (25% dari alert minimum)
with usage as (
  select raw_material_id, count(distinct product_id) as used_by
  from public.product_recipe_components
  where raw_material_id is not null
  group by raw_material_id
),
picked as (
  select raw_material_id from usage order by used_by asc, raw_material_id limit 2
)
update public.raw_materials
set current_stock = min_stock_alert * 0.25
where id in (select raw_material_id from picked);

-- 3. Produk tambahan dengan resep belum diisi
insert into public.products (
  name, category_id, unit, sku, available_offline, available_online,
  recipe_status, add_cost_percentage, is_active
)
select v.name, c.id, v.unit, v.sku, v.offline, v.online, 'belum_lengkap', 0, false
from (values
  ('Banana Bread Slice', 'APPETIZER',    'Pcs', 'IRN-APP-03',         true, false),
  ('Kopi Susu Pandan',   'BASIC COFFEE', 'Cup (Gelas)', 'IRN-BAS-09', true, true)
) as v(name, category, unit, sku, offline, online)
join public.categories c on c.name = v.category
on conflict (name) do nothing;

-- Aset contoh
insert into public.assets (name, purchase_price, quantity, purchase_date, status, notes)
values
  ('Mesin Espresso La Marzocco Linea Mini', 25000000, 1, '2025-01-12', 'aktif',  'Garansi 2 tahun'),
  ('Grinder Kopi Mahlkonig EK43',            8500000, 1, '2025-01-15', 'aktif',  null),
  ('AC Ruangan Daikin Inverter 2 PK',        3500000, 1, '2025-02-03', 'rusak',  null),
  ('Meja Kayu Solid Jati (4 Kursi)',          750000, 4, '2025-01-20', 'aktif',  'Dibeli di Mebel Sido Makmur'),
  ('Kursi Bar Besi Industrial',               300000, 6, '2025-01-22', 'aktif',  null),
  ('Tablet iPad 9th Gen 64GB',               1700000, 1, '2025-02-10', 'hilang', 'Kasir cadangan'),
  ('Showcase Chiller Minuman 1 Pintu',       1500000, 1, '2025-01-05', 'dijual', null)
on conflict do nothing;
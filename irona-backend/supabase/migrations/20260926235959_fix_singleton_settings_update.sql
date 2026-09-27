-- Perbaikan: pg_safeupdate menolak UPDATE tanpa WHERE lewat API.
-- Tabel pengaturan singleton (id = true) sekarang di-update dengan 'where id'.

CREATE OR REPLACE FUNCTION public.save_delivery_settings(p_free_radius_km numeric, p_fee_per_step numeric, p_step_km numeric, p_fee_per_100m numeric, p_max_distance_km numeric)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur order online.' using errcode = '42501';
  end if;
  if p_free_radius_km is null or p_free_radius_km < 0 then raise exception 'Radius gratis tidak boleh kosong/minus.'; end if;
  if p_fee_per_step is null or p_fee_per_step < 0 then raise exception 'Tarif per kelipatan tidak boleh kosong/minus.'; end if;
  if coalesce(p_step_km, 0) <= 0 then raise exception 'Kelipatan jarak harus lebih dari 0 km.'; end if;
  if p_fee_per_100m is null or p_fee_per_100m < 0 then raise exception 'Tarif per 100 m tidak boleh kosong/minus.'; end if;
  if coalesce(p_max_distance_km, 0) <= 0 then raise exception 'Jarak maksimal harus lebih dari 0 km.'; end if;
  if p_max_distance_km < p_free_radius_km then
    raise exception 'Jarak maksimal tidak boleh lebih kecil dari radius gratis.';
  end if;

  select jsonb_build_object('free_radius_km', free_radius_km, 'fee_per_step', fee_per_step, 'step_km', step_km,
                            'fee_per_100m', fee_per_100m, 'max_distance_km', max_distance_km)
    into v_before from online_order_settings;

  update online_order_settings set
    free_radius_km = p_free_radius_km, fee_per_step = p_fee_per_step, step_km = p_step_km,
    fee_per_100m = p_fee_per_100m, max_distance_km = p_max_distance_km,
    updated_at = now(), updated_by = auth.uid()
  where id;

  v_after := jsonb_build_object('free_radius_km', p_free_radius_km, 'fee_per_step', p_fee_per_step, 'step_km', p_step_km,
                                'fee_per_100m', p_fee_per_100m, 'max_distance_km', p_max_distance_km);

  insert into online_order_history (section, description, before_data, after_data, changed_by)
  values ('ongkir', 'Mengubah skema ongkir', v_before, v_after, auth.uid());
end;
$function$

;

CREATE OR REPLACE FUNCTION public.save_service_fee(p_service_fee numeric)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_before numeric;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur order online.' using errcode = '42501';
  end if;
  if p_service_fee is null or p_service_fee < 0 then raise exception 'Biaya layanan tidak boleh kosong/minus.'; end if;

  select service_fee into v_before from online_order_settings;
  update online_order_settings set service_fee = p_service_fee, updated_at = now(), updated_by = auth.uid()
  where id;

  insert into online_order_history (section, description, before_data, after_data, changed_by)
  values ('biaya_layanan', 'Mengubah biaya layanan',
          jsonb_build_object('service_fee', v_before), jsonb_build_object('service_fee', p_service_fee), auth.uid());
end;
$function$

;

CREATE OR REPLACE FUNCTION public.save_point_rules(p_tiers jsonb, p_rounding_threshold numeric)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_before jsonb := point_rules_snapshot();
  v_count int;
  v_distinct int;
  v_smallest numeric;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengubah aturan poin.' using errcode = '42501';
  end if;

  select count(*), count(distinct (t ->> 'min_amount')::numeric), min((t ->> 'min_amount')::numeric)
    into v_count, v_distinct, v_smallest
  from jsonb_array_elements(coalesce(p_tiers, '[]'::jsonb)) t;

  if v_count = 0 then
    raise exception 'Minimal harus ada 1 tingkat poin.';
  end if;
  if v_count <> v_distinct then
    raise exception 'Nominal tiap tingkat tidak boleh sama.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_tiers) t
    where coalesce((t ->> 'min_amount')::numeric, 0) <= 0 or coalesce((t ->> 'points')::numeric, 0) <= 0
       or (t ->> 'points')::numeric <> floor((t ->> 'points')::numeric)
  ) then
    raise exception 'Nominal dan poin setiap tingkat harus lebih dari 0 (poin bilangan bulat).';
  end if;
  if coalesce(p_rounding_threshold, 0) < 0 or coalesce(p_rounding_threshold, 0) >= v_smallest then
    raise exception 'Batas pembulatan harus di bawah nominal tingkat terkecil (%). Isi 0 kalau tanpa pembulatan.',
      replace(to_char(v_smallest, 'FM999G999G999'), ',', '.');
  end if;

  delete from point_earning_tiers where true;
  insert into point_earning_tiers (min_amount, points)
  select (t ->> 'min_amount')::numeric, (t ->> 'points')::integer from jsonb_array_elements(p_tiers) t;

  update point_earning_settings
  set rounding_threshold = coalesce(p_rounding_threshold, 0), updated_at = now(), updated_by = auth.uid()
  where id;

  insert into point_rule_history (before_data, after_data, changed_by)
  values (v_before, point_rules_snapshot(), auth.uid());
end;
$function$

;


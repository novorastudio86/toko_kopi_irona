-- ============================================================
-- ONGKIR: HAPUS RADIUS GRATIS
--
-- Tidak ada gratis ongkir berdasarkan jarak. Ongkir dihitung dari 0 km:
--   tiap kelipatan penuh × tarif per kelipatan + sisa jarak per 100 m (dibulatkan ke atas).
-- Semua potongan / gratis ongkir diatur lewat Promosi › Diskon (target ongkir).
-- ============================================================

drop function public.calc_delivery_fee(numeric);
drop function public.save_delivery_settings(numeric, numeric, numeric, numeric, numeric);

alter table public.online_order_settings drop column free_radius_km;


create function public.calc_delivery_fee(p_distance_km numeric)
returns table (is_deliverable boolean, fee numeric, full_steps integer, step_fee numeric,
               remainder_m integer, remainder_fee numeric)
language plpgsql
stable
set search_path = public
as $$
declare
  s record;
  v_distance_m integer;
  v_step_m integer;
  v_steps integer;
  v_rem_m integer;
  v_units integer;
begin
  select * into s from online_order_settings;

  if p_distance_km is null or p_distance_km < 0 then
    raise exception 'Jarak tidak valid.';
  end if;
  if p_distance_km > s.max_distance_km then
    return query select false, null::numeric, 0, 0::numeric, 0, 0::numeric;
    return;
  end if;

  -- Hitung dalam meter supaya tidak ada selisih pembulatan desimal
  v_distance_m := round(p_distance_km * 1000);
  v_step_m := round(s.step_km * 1000);
  v_steps := v_distance_m / v_step_m;
  v_rem_m := v_distance_m - v_steps * v_step_m;
  v_units := ceil(v_rem_m / 100.0);

  return query select
    true,
    v_steps * s.fee_per_step + v_units * s.fee_per_100m,
    v_steps,
    v_steps * s.fee_per_step,
    v_rem_m,
    v_units * s.fee_per_100m;
end;
$$;


create function public.save_delivery_settings(
  p_fee_per_step numeric,
  p_step_km numeric,
  p_fee_per_100m numeric,
  p_max_distance_km numeric
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not is_admin() then
    raise exception 'Hanya Admin/Owner yang boleh mengatur order online.' using errcode = '42501';
  end if;
  if p_fee_per_step is null or p_fee_per_step < 0 then raise exception 'Tarif per kelipatan tidak boleh kosong/minus.'; end if;
  if coalesce(p_step_km, 0) <= 0 then raise exception 'Kelipatan jarak harus lebih dari 0 km.'; end if;
  if p_fee_per_100m is null or p_fee_per_100m < 0 then raise exception 'Tarif per 100 m tidak boleh kosong/minus.'; end if;
  if coalesce(p_max_distance_km, 0) <= 0 then raise exception 'Jarak maksimal harus lebih dari 0 km.'; end if;

  select jsonb_build_object('fee_per_step', fee_per_step, 'step_km', step_km,
                            'fee_per_100m', fee_per_100m, 'max_distance_km', max_distance_km)
    into v_before from online_order_settings;

  update online_order_settings set
    fee_per_step = p_fee_per_step, step_km = p_step_km,
    fee_per_100m = p_fee_per_100m, max_distance_km = p_max_distance_km,
    updated_at = now(), updated_by = auth.uid()
  where id;

  v_after := jsonb_build_object('fee_per_step', p_fee_per_step, 'step_km', p_step_km,
                                'fee_per_100m', p_fee_per_100m, 'max_distance_km', p_max_distance_km);

  insert into online_order_history (section, description, before_data, after_data, changed_by)
  values ('ongkir', 'Mengubah skema ongkir', v_before, v_after, auth.uid());
end;
$$;

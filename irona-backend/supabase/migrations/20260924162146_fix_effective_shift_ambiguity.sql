-- Perbaikan: subquery "(select v_swap_id) s" bikin nama v_swap_id ambigu
-- (dianggap variabel PL/pgSQL sekaligus kolom subquery). Subquery-nya tidak perlu.
create or replace function public.get_effective_shift(p_employee_id uuid, p_date date)
returns table (
  has_schedule boolean,
  is_libur boolean,
  shift_pattern_id uuid,
  shift_name text,
  start_time time,
  end_time time,
  is_swap boolean,
  swap_with_employee_id uuid,
  swap_with_name text
)
language plpgsql
stable
as $$
declare
  v_has_exception boolean := false;
  v_has_schedule boolean := false;
  v_pattern_id uuid;
  v_swap_id uuid;
  v_swap_name text;
  v_dow int := extract(dow from p_date)::int;
begin
  select true, ss.shift_pattern_id, ss.swap_with_employee_id
    into v_has_exception, v_pattern_id, v_swap_id
  from public.shift_schedules ss
  where ss.employee_id = p_employee_id and ss.schedule_date = p_date;

  if v_has_exception then
    v_has_schedule := true;
  else
    v_swap_id := null;
    select true, esd.shift_pattern_id
      into v_has_schedule, v_pattern_id
    from public.employee_shift_defaults esd
    where esd.employee_id = p_employee_id and esd.day_of_week = v_dow;
  end if;

  if not v_has_schedule then
    return query select false, false, null::uuid, null::text, null::time, null::time, false, null::uuid, null::text;
    return;
  end if;

  -- Nama partner tukar diambil lebih dulu ke variabel, bukan lewat join di subquery
  if v_swap_id is not null then
    select e.full_name into v_swap_name from public.employees e where e.id = v_swap_id;
  end if;

  if v_pattern_id is null then
    return query select true, true, null::uuid, null::text, null::time, null::time,
                        v_swap_id is not null, v_swap_id, v_swap_name;
    return;
  end if;

  return query
    select
      true, false, sp.id, sp.name,
      coalesce(sdo.start_time, sp.start_time),
      coalesce(sdo.end_time, sp.end_time),
      v_swap_id is not null, v_swap_id, v_swap_name
    from public.shift_patterns sp
    left join public.shift_date_overrides sdo
      on sdo.shift_pattern_id = sp.id and sdo.override_date = p_date
    where sp.id = v_pattern_id;
end;
$$;
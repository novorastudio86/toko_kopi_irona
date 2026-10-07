-- Poin tanpa pembulatan sisa: 10rb = 1 poin → 9rb = 0, 19rb = 1, 20rb = 2.
-- calc_points melewati pembulatan saat rounding_threshold = 0.
alter table public.point_earning_settings alter column rounding_threshold set default 0;
update public.point_earning_settings set rounding_threshold = 0;

-- Kode tampilan karyawan (EMP-001, EMP-002, ...), terisi otomatis
create sequence if not exists public.employee_code_seq;

alter table public.employees add column code text;

with ordered as (
  select id, row_number() over (order by created_at) as rn
  from public.employees
)
update public.employees e
set code = 'EMP-' || lpad(o.rn::text, 3, '0')
from ordered o
where e.id = o.id;

select setval(
  'public.employee_code_seq',
  greatest((select count(*) from public.employees), 1),
  (select count(*) from public.employees) > 0
);

alter table public.employees
  alter column code set default 'EMP-' || lpad(nextval('public.employee_code_seq')::text, 3, '0'),
  alter column code set not null,
  add constraint employees_code_key unique (code);
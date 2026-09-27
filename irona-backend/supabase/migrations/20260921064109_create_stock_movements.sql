create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null check (movement_type in ('stok_masuk', 'penyesuaian', 'produksi_racikan')),
  item_type text not null check (item_type in ('bahan_baku', 'racikan')),
  raw_material_id uuid references public.raw_materials(id),
  racikan_id uuid references public.racikan(id),
  quantity numeric(14,3) not null,
  unit_id uuid not null references public.units(id),
  purchase_unit_id uuid references public.units(id),
  purchase_qty numeric(12,3),
  qty_per_package numeric(12,3),
  total_price numeric(14,2),
  unit_price numeric(14,4),
  adjustment_reason text check (adjustment_reason in ('opname', 'penyusutan', 'rusak', 'hilang', 'lainnya')),
  batch_qty numeric(12,3),
  notes text,
  movement_date date not null default current_date,
  created_by uuid references public.employees(id),
  created_at timestamptz not null default now(),
  constraint stock_movements_source_check check (
    (item_type = 'bahan_baku' and raw_material_id is not null and racikan_id is null)
    or (item_type = 'racikan' and racikan_id is not null and raw_material_id is null)
  )
);

create or replace function public.apply_stock_movement()
returns trigger language plpgsql as $$
begin
  if new.item_type = 'bahan_baku' then
    update public.raw_materials
      set current_stock = current_stock + new.quantity,
          unit_price = coalesce(new.unit_price, unit_price)
      where id = new.raw_material_id;
  else
    update public.racikan set current_stock = current_stock + new.quantity
      where id = new.racikan_id;
  end if;
  return new;
end; $$;

create trigger stock_movements_apply
after insert on public.stock_movements
for each row execute function public.apply_stock_movement();

alter table public.stock_movements enable row level security;
create policy "stock_movements_select" on public.stock_movements for select to authenticated using (true);
create policy "stock_movements_admin_write" on public.stock_movements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
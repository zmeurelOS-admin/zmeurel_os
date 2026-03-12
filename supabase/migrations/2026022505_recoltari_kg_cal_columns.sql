alter table public.recoltari
  add column if not exists kg_cal1 numeric not null default 0,
  add column if not exists kg_cal2 numeric not null default 0;

alter table public.recoltari
  alter column cantitate_kg set default 0;

create or replace function public.recoltari_sync_cantitate_kg()
returns trigger
language plpgsql
as $$
begin
  new.kg_cal1 := coalesce(new.kg_cal1, 0);
  new.kg_cal2 := coalesce(new.kg_cal2, 0);
  new.cantitate_kg := coalesce(new.kg_cal1, 0) + coalesce(new.kg_cal2, 0);
  return new;
end;
$$;

drop trigger if exists trg_recoltari_sync_cantitate_kg on public.recoltari;
create trigger trg_recoltari_sync_cantitate_kg
before insert or update on public.recoltari
for each row
execute function public.recoltari_sync_cantitate_kg();

select pg_notify('pgrst', 'reload schema');

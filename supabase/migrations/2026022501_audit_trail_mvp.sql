do $$
begin
  if to_regclass('public.cheltuieli') is not null then
    execute 'alter table public.cheltuieli
      add column if not exists created_at timestamptz default now(),
      add column if not exists updated_at timestamptz default now(),
      add column if not exists created_by uuid,
      add column if not exists updated_by uuid';
  end if;

  if to_regclass('public.cheltuieli_diverse') is not null then
    execute 'alter table public.cheltuieli_diverse
      add column if not exists created_at timestamptz default now(),
      add column if not exists updated_at timestamptz default now(),
      add column if not exists created_by uuid,
      add column if not exists updated_by uuid';
  end if;
end
$$;

alter table public.recoltari
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

alter table public.vanzari
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

alter table public.activitati_agricole
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

alter table public.clienti
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

alter table public.parcele
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

update public.recoltari set created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now());
update public.vanzari set created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now());
update public.activitati_agricole set created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now());
update public.clienti set created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now());
update public.parcele set created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now());

do $$
begin
  if to_regclass('public.cheltuieli') is not null then
    execute 'update public.cheltuieli set created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now())';
  end if;

  if to_regclass('public.cheltuieli_diverse') is not null then
    execute 'update public.cheltuieli_diverse set created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now())';
  end if;
end
$$;

alter table public.recoltari alter column created_at set default now();
alter table public.recoltari alter column updated_at set default now();
alter table public.recoltari alter column created_at set not null;
alter table public.recoltari alter column updated_at set not null;

alter table public.vanzari alter column created_at set default now();
alter table public.vanzari alter column updated_at set default now();
alter table public.vanzari alter column created_at set not null;
alter table public.vanzari alter column updated_at set not null;

alter table public.activitati_agricole alter column created_at set default now();
alter table public.activitati_agricole alter column updated_at set default now();
alter table public.activitati_agricole alter column created_at set not null;
alter table public.activitati_agricole alter column updated_at set not null;

alter table public.clienti alter column created_at set default now();
alter table public.clienti alter column updated_at set default now();
alter table public.clienti alter column created_at set not null;
alter table public.clienti alter column updated_at set not null;

alter table public.parcele alter column created_at set default now();
alter table public.parcele alter column updated_at set default now();
alter table public.parcele alter column created_at set not null;
alter table public.parcele alter column updated_at set not null;

do $$
begin
  if to_regclass('public.cheltuieli') is not null then
    execute 'alter table public.cheltuieli alter column created_at set default now()';
    execute 'alter table public.cheltuieli alter column updated_at set default now()';
    execute 'alter table public.cheltuieli alter column created_at set not null';
    execute 'alter table public.cheltuieli alter column updated_at set not null';
  end if;

  if to_regclass('public.cheltuieli_diverse') is not null then
    execute 'alter table public.cheltuieli_diverse alter column created_at set default now()';
    execute 'alter table public.cheltuieli_diverse alter column updated_at set default now()';
    execute 'alter table public.cheltuieli_diverse alter column created_at set not null';
    execute 'alter table public.cheltuieli_diverse alter column updated_at set not null';
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recoltari_created_by_fkey') then
    alter table public.recoltari add constraint recoltari_created_by_fkey foreign key (created_by) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recoltari_updated_by_fkey') then
    alter table public.recoltari add constraint recoltari_updated_by_fkey foreign key (updated_by) references auth.users(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'vanzari_created_by_fkey') then
    alter table public.vanzari add constraint vanzari_created_by_fkey foreign key (created_by) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vanzari_updated_by_fkey') then
    alter table public.vanzari add constraint vanzari_updated_by_fkey foreign key (updated_by) references auth.users(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'activitati_agricole_created_by_fkey') then
    alter table public.activitati_agricole add constraint activitati_agricole_created_by_fkey foreign key (created_by) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activitati_agricole_updated_by_fkey') then
    alter table public.activitati_agricole add constraint activitati_agricole_updated_by_fkey foreign key (updated_by) references auth.users(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clienti_created_by_fkey') then
    alter table public.clienti add constraint clienti_created_by_fkey foreign key (created_by) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clienti_updated_by_fkey') then
    alter table public.clienti add constraint clienti_updated_by_fkey foreign key (updated_by) references auth.users(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'parcele_created_by_fkey') then
    alter table public.parcele add constraint parcele_created_by_fkey foreign key (created_by) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'parcele_updated_by_fkey') then
    alter table public.parcele add constraint parcele_updated_by_fkey foreign key (updated_by) references auth.users(id);
  end if;

  if to_regclass('public.cheltuieli') is not null then
    if not exists (select 1 from pg_constraint where conname = 'cheltuieli_created_by_fkey') then
      execute 'alter table public.cheltuieli add constraint cheltuieli_created_by_fkey foreign key (created_by) references auth.users(id)';
    end if;
    if not exists (select 1 from pg_constraint where conname = 'cheltuieli_updated_by_fkey') then
      execute 'alter table public.cheltuieli add constraint cheltuieli_updated_by_fkey foreign key (updated_by) references auth.users(id)';
    end if;
  end if;

  if to_regclass('public.cheltuieli_diverse') is not null then
    if not exists (select 1 from pg_constraint where conname = 'cheltuieli_diverse_created_by_fkey') then
      execute 'alter table public.cheltuieli_diverse add constraint cheltuieli_diverse_created_by_fkey foreign key (created_by) references auth.users(id)';
    end if;
    if not exists (select 1 from pg_constraint where conname = 'cheltuieli_diverse_updated_by_fkey') then
      execute 'alter table public.cheltuieli_diverse add constraint cheltuieli_diverse_updated_by_fkey foreign key (updated_by) references auth.users(id)';
    end if;
  end if;
end
$$;

create or replace function public.set_audit_fields_minimal()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), old.updated_by, old.created_by);
  end if;
  return new;
end;
$$;

drop trigger if exists recoltari_set_audit_fields_minimal on public.recoltari;
create trigger recoltari_set_audit_fields_minimal
before insert or update on public.recoltari
for each row execute function public.set_audit_fields_minimal();

drop trigger if exists vanzari_set_audit_fields_minimal on public.vanzari;
create trigger vanzari_set_audit_fields_minimal
before insert or update on public.vanzari
for each row execute function public.set_audit_fields_minimal();

drop trigger if exists activitati_agricole_set_audit_fields_minimal on public.activitati_agricole;
create trigger activitati_agricole_set_audit_fields_minimal
before insert or update on public.activitati_agricole
for each row execute function public.set_audit_fields_minimal();

drop trigger if exists clienti_set_audit_fields_minimal on public.clienti;
create trigger clienti_set_audit_fields_minimal
before insert or update on public.clienti
for each row execute function public.set_audit_fields_minimal();

drop trigger if exists parcele_set_audit_fields_minimal on public.parcele;
create trigger parcele_set_audit_fields_minimal
before insert or update on public.parcele
for each row execute function public.set_audit_fields_minimal();

do $$
begin
  if to_regclass('public.cheltuieli') is not null then
    execute 'drop trigger if exists cheltuieli_set_audit_fields_minimal on public.cheltuieli';
    execute 'create trigger cheltuieli_set_audit_fields_minimal before insert or update on public.cheltuieli for each row execute function public.set_audit_fields_minimal()';
  end if;

  if to_regclass('public.cheltuieli_diverse') is not null then
    execute 'drop trigger if exists cheltuieli_diverse_set_audit_fields_minimal on public.cheltuieli_diverse';
    execute 'create trigger cheltuieli_diverse_set_audit_fields_minimal before insert or update on public.cheltuieli_diverse for each row execute function public.set_audit_fields_minimal()';
  end if;
end
$$;

do $$
declare
  tbl text;
  tenant_check text := 'tenant_id = (select id from public.tenants where owner_user_id = auth.uid())';
begin
  foreach tbl in array array['recoltari', 'vanzari', 'activitati_agricole', 'clienti', 'parcele', 'cheltuieli_diverse'] loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_select', tbl);
    execute format('create policy %I on public.%I for select using (%s)', tbl || '_tenant_select', tbl, tenant_check);

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_insert', tbl);
    execute format('create policy %I on public.%I for insert with check (%s)', tbl || '_tenant_insert', tbl, tenant_check);

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_update', tbl);
    execute format('create policy %I on public.%I for update using (%s) with check (%s)', tbl || '_tenant_update', tbl, tenant_check, tenant_check);
  end loop;
end
$$;

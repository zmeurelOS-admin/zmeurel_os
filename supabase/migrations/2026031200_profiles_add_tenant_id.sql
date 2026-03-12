alter table public.profiles
add column if not exists tenant_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_tenant_fk'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_tenant_fk
    foreign key (tenant_id)
    references public.tenants(id)
    on delete set null;
  end if;
end
$$;

create index if not exists profiles_tenant_id_idx
on public.profiles(tenant_id);

notify pgrst, 'reload schema';

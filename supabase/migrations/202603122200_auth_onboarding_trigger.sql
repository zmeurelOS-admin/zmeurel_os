create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  created_tenant_id uuid;
  farm_name text;
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  farm_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'farm_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '') || '''s Farm',
    'Ferma mea'
  );

  insert into public.tenants (nume_ferma, owner_user_id)
  values (farm_name, new.id)
  returning id into created_tenant_id;

  update public.profiles
  set tenant_id = created_tenant_id,
      updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

notify pgrst, 'reload schema';

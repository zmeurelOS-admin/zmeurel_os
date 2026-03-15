create or replace function public.prevent_privileged_profile_changes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  request_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    current_user
  );
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if request_role in ('service_role', 'postgres') then
    return new;
  end if;

  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'profiles.tenant_id cannot be changed directly';
  end if;

  if new.is_superadmin is distinct from old.is_superadmin then
    raise exception 'profiles.is_superadmin cannot be changed directly';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_privileged_changes on public.profiles;
create trigger profiles_prevent_privileged_changes
before update on public.profiles
for each row
execute function public.prevent_privileged_profile_changes();

notify pgrst, 'reload schema';

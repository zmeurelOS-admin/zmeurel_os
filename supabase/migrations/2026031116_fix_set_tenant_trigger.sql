create or replace function public.set_tenant_id_from_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_tenant uuid;
begin

  if new.tenant_id is not null then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  select id
  into resolved_tenant
  from tenants
  where owner_user_id = auth.uid()
  order by created_at asc
  limit 1;

  new.tenant_id := resolved_tenant;

  return new;

end;
$$;

create or replace function public.set_tenant_id_from_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenant_id is not null then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  select id
  into new.tenant_id
  from tenants
  where owner_user_id = auth.uid()
  order by created_at asc
  limit 1;

  return new;
end;
$$;

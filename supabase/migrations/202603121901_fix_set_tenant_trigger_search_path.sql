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

  select tenant_id
  into new.tenant_id
  from profiles
  where id = auth.uid();

  return new;
end;
$$;

notify pgrst, 'reload schema';

do $$
declare
  profile_row record;
  resolved_tenant_id uuid;
begin
  for profile_row in
    select p.id
    from public.profiles p
    where p.tenant_id is null
  loop
    select t.id
    into resolved_tenant_id
    from public.tenants t
    where t.owner_user_id = profile_row.id
    order by t.created_at asc nulls last, t.id asc
    limit 1;

    if resolved_tenant_id is null then
      insert into public.tenants (nume_ferma, owner_user_id)
      values ('Ferma Mea', profile_row.id)
      returning id into resolved_tenant_id;
    end if;

    update public.profiles
    set tenant_id = resolved_tenant_id,
        updated_at = now()
    where id = profile_row.id
      and tenant_id is null;
  end loop;
end
$$;

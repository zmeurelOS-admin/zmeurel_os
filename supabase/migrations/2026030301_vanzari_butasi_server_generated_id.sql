create or replace function public.set_vanzari_butasi_tenant_and_public_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_tenant uuid;
  next_number bigint;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if new.tenant_id is null then
    select t.id
    into resolved_tenant
    from public.tenants t
    where t.owner_user_id = auth.uid()
    limit 1;

    new.tenant_id := resolved_tenant;
  end if;

  if new.tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if new.id_vanzare_butasi is null or btrim(new.id_vanzare_butasi) = '' then
    -- Serialize per-tenant ID generation to avoid race conditions.
    perform 1
    from public.tenants t
    where t.id = new.tenant_id
    for update;

    select
      coalesce(
        max(
          case
            when vb.id_vanzare_butasi ~ '^VB[0-9]+$'
              then substring(vb.id_vanzare_butasi from 3)::bigint
            else null
          end
        ),
        0
      ) + 1
    into next_number
    from public.vanzari_butasi vb
    where vb.tenant_id = new.tenant_id;

    new.id_vanzare_butasi := 'VB' || lpad(next_number::text, 3, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists vanzari_butasi_set_tenant_and_public_id on public.vanzari_butasi;
create trigger vanzari_butasi_set_tenant_and_public_id
before insert on public.vanzari_butasi
for each row execute function public.set_vanzari_butasi_tenant_and_public_id();

notify pgrst, 'reload schema';

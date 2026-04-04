-- Magazin asociație: aprobare explicită din admin (DB), cu fallback temporar pe allowlist env.

alter table public.tenants
  add column if not exists is_association_approved boolean not null default false;

comment on column public.tenants.is_association_approved is
  'Dacă true, fermă inclusă în catalogul magazinului asociației (în plus față de allowlist-ul legacy din env).';

-- admin_list_tenants: include flag pentru UI superadmin
drop function if exists public.admin_list_tenants();

create function public.admin_list_tenants()
returns table (
  tenant_id uuid,
  tenant_name text,
  owner_email text,
  plan text,
  created_at timestamptz,
  parcels_count bigint,
  users_count bigint,
  is_association_approved boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    t.id::uuid as tenant_id,
    t.nume_ferma::text as tenant_name,
    u.email::text as owner_email,
    t.plan::text,
    t.created_at::timestamptz,
    (
      select count(*)::bigint
      from public.parcele p
      where p.tenant_id = t.id
    ) as parcels_count,
    (
      select count(*)::bigint
      from auth.users ux
      where ux.id = t.owner_user_id
    ) as users_count,
    coalesce(t.is_association_approved, false) as is_association_approved
  from public.tenants t
  left join auth.users u on u.id = t.owner_user_id
  order by t.created_at desc nulls last;
end;
$$;

grant execute on function public.admin_list_tenants() to authenticated;
grant execute on function public.admin_list_tenants() to service_role;

notify pgrst, 'reload schema';
